import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { analyzeCurrentFitness } from '@/lib/race-plan/analyze-fitness'
import { computeTrainingWeeks, RACE_APPROACHES, RACE_APPROACH_LABELS, type RaceApproach, type TrainingPhase } from '@/lib/race-plan/periodization'
import { raceTypeLabel, type RaceType } from '@/lib/race-constants'
import { getLocalDateString } from '@/lib/date'
import { daysBetween } from '@/lib/goals'
import { computeTensionFlags } from '@/lib/race-plan/tension'
import { estimateProjectedFinishSeconds, assessGoalRealism } from '@/lib/race-plan/finish-time'
import { raceCategoryFor, type SelfAssessment, type Discipline } from '@/lib/race-plan/self-assessment'
import { computeDisciplineActivityFacts, assessMultisportReadiness } from '@/lib/race-plan/discipline-weakness'

const MODEL = 'gemini-2.5-flash'

const PHASE_FALLBACK_NOTES: Record<TrainingPhase, string> = {
  base: 'Base phase: build your aerobic foundation and keep strength sessions steady.',
  build: 'Build phase: push weekly volume up and let intensity follow.',
  peak: 'Peak phase: hold near your highest volume this cycle, dial in race-pace effort.',
  taper: 'Taper: cut volume back and arrive fresh and ready.',
}

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

function buildSelfAssessmentSummary(assessment: SelfAssessment | null): string {
  if (!assessment) return ''

  if (assessment.kind === 'simple') {
    const parts: string[] = []
    if (assessment.perceivedFitness != null) parts.push(`self-rated fitness ${assessment.perceivedFitness}/5`)
    if (assessment.longestRecentDistanceKm != null) parts.push(`longest comfortable recent run: ${assessment.longestRecentDistanceKm}km`)
    if (assessment.recentTimeTrial) {
      parts.push(`recent time trial: ${assessment.recentTimeTrial.distanceKm}km in ${formatDuration(assessment.recentTimeTrial.timeSeconds)}`)
    }
    if (assessment.limiters.length > 0 && !assessment.limiters.includes('none')) {
      parts.push(`self-reported limiters: ${assessment.limiters.join(', ')}`)
    }
    if (assessment.notes) parts.push(`athlete notes: "${assessment.notes}"`)
    return parts.length > 0 ? `\n\nAthlete self-report: ${parts.join('; ')}.` : ''
  }

  const disciplineParts = (['swim', 'bike', 'run'] as Discipline[])
    .map((discipline) => {
      const d = assessment[discipline]
      const bits: string[] = []
      if (d.comfortLevel != null) bits.push(`comfort ${d.comfortLevel}/5`)
      if (d.longestRecentSessionKm != null) bits.push(`longest recent session ${d.longestRecentSessionKm}km`)
      if (d.recentTimeTrial) bits.push(`time trial ${d.recentTimeTrial.distanceKm}km in ${formatDuration(d.recentTimeTrial.timeSeconds)}`)
      if (d.limiters.length > 0 && !d.limiters.includes('none')) bits.push(`limiters: ${d.limiters.join(', ')}`)
      return `${discipline} (${bits.length > 0 ? bits.join(', ') : 'no details given'})`
    })
    .join('; ')

  const extras: string[] = []
  if (assessment.perceivedStrength != null) extras.push(`self-rated strength ${assessment.perceivedStrength}/5`)
  if (assessment.pastMultisportExperience && assessment.pastMultisportExperience !== 'none') {
    extras.push(`past multi-sport experience: ${assessment.pastMultisportExperience}`)
  }
  if (assessment.notes) extras.push(`athlete notes: "${assessment.notes}"`)

  return `\n\nAthlete self-report by discipline: ${disciplineParts}.${extras.length > 0 ? ` Also: ${extras.join('; ')}.` : ''}`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: 'error', error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const raceId: string | null = body?.raceId ?? null
  const approach: RaceApproach | null = body?.approach ?? null

  if (!raceId || !approach || !RACE_APPROACHES.includes(approach)) {
    return NextResponse.json({ status: 'error', error: 'Missing raceId or approach' }, { status: 400 })
  }

  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('id, race_type, location, course_id, race_date, self_assessment, target_finish_seconds, discipline_weakness')
    .eq('id', raceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (raceError || !race) {
    return NextResponse.json({ status: 'not_found' })
  }

  const selfAssessment = (race.self_assessment ?? null) as SelfAssessment | null
  const category = raceCategoryFor(race.race_type as RaceType)
  const disciplineWeakness = (race.discipline_weakness ?? null) as { order: Discipline[]; notes: Record<Discipline, string> } | null

  let courseName: string | null = null
  if (race.course_id) {
    const { data: course } = await supabase.from('race_courses').select('name').eq('id', race.course_id).maybeSingle()
    courseName = course?.name ?? null
  }
  const courseOrLocation = courseName ?? race.location

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return NextResponse.json({ status: 'error', error: 'AI Coach is not configured' }, { status: 500 })
  }

  const facts = await analyzeCurrentFitness(supabase, user.id, raceId)

  // Computed once, reused for both the periodization ramp and the
  // readiness check below - real per-discipline activity, not the
  // aggregate cross-discipline number (that conflation was the root
  // cause of the bike/swim target bugs). The ranking order itself comes
  // from the STORED weakness analysis, never recomputed here, so the
  // split the athlete already saw and the split the plan actually uses
  // can't drift.
  const disciplineActivityFacts = category === 'multisport' ? await computeDisciplineActivityFacts(supabase) : null
  const disciplineInputs =
    category === 'multisport' && disciplineWeakness && disciplineActivityFacts
      ? { activityFacts: disciplineActivityFacts, order: disciplineWeakness.order }
      : undefined

  // Unlike the per-exercise recommend route, this deliberately has no
  // "not enough history" gate - the periodization math below has explicit
  // floors so it still produces a sensible starter plan at zero history,
  // rather than refusing to generate anything for a new user.
  const skeleton = computeTrainingWeeks(
    race.race_date,
    approach,
    facts.cardio.recentAvgWeeklyKm,
    facts.cardio.recentAvgSessionsPerWeek,
    facts.strength.recentSessionsPerWeek,
    disciplineInputs
  )

  const daysUntilRace = daysBetween(race.race_date, getLocalDateString())

  const readinessFlags = disciplineActivityFacts ? assessMultisportReadiness(disciplineActivityFacts, daysUntilRace) : []
  const readinessSummary = readinessFlags.length > 0 ? `\n\nReadiness check: ${readinessFlags.join(' ')}` : ''

  const cardioSummary = `Cardio: averaging ${facts.cardio.recentAvgWeeklyKm.toFixed(1)}km/week across ${facts.cardio.recentAvgSessionsPerWeek.toFixed(1)} sessions/week over the last 4 weeks, active in ${facts.cardio.weeksActive} of the last 8 weeks. Longest recent session: ${facts.cardio.longestSessionKm}km.${
    facts.cardio.avgPaceSecPerKmRecent != null && facts.cardio.avgPaceSecPerKmPrior != null
      ? ` Pace over the last 4 weeks is ${formatPace(facts.cardio.avgPaceSecPerKmRecent)} vs ${formatPace(facts.cardio.avgPaceSecPerKmPrior)} the 4 weeks before that.`
      : ''
  }`

  const strengthSummary =
    facts.strength.muscleGroupTrends.length > 0
      ? `Strength (current best est. 1RM, recent trend): ${facts.strength.muscleGroupTrends
          .map((t) => `${t.muscleGroup} ${t.currentBestEst1RM}kg (${t.trend})`)
          .join(', ')}. Training ${facts.strength.recentSessionsPerWeek.toFixed(1)} strength session(s)/week recently.`
      : 'No recent strength training history.'

  const overTrained = facts.muscleVolume.filter((v) => v.status === 'over')
  const volumeSummary =
    overTrained.length > 0
      ? `Already above the ~10-20 sets/week guideline this week for: ${overTrained.map((v) => v.muscle).join(', ')} - don't pile more strength volume onto these.`
      : ''

  const consistencySummary = `Consistency over the last 90 days: gym activity in ${facts.gymConsistencyWeeks} distinct weeks, nutrition logged in ${facts.nutritionConsistencyWeeks} distinct weeks.`

  const phaseSummary = facts.trainingPhase
    ? `Self-reported training phase: "${facts.trainingPhase}" at "${facts.trainingIntensity}" intensity.`
    : ''

  const goalsSummary =
    facts.competingGoalsCount > 0
      ? `Also has ${facts.competingGoalsCount} other active goal(s) competing for attention alongside this race.`
      : ''

  const selfAssessmentSummary = buildSelfAssessmentSummary(selfAssessment)

  const tensionFlags = selfAssessment ? computeTensionFlags(selfAssessment, facts) : []
  const tensionSummary =
    tensionFlags.length > 0
      ? `\n\nNote: ${tensionFlags.join(' ')} Treat the logged data as primary in all cases above - the self-report is context/color only.`
      : ''

  const pastResultsSummary =
    facts.pastRaceResults.length > 0
      ? `\n\nPast race results: ${facts.pastRaceResults
          .slice(0, 3)
          .map((r) => `${raceTypeLabel(r.raceType)}${r.courseOrLocation ? ` (${r.courseOrLocation})` : ''} on ${r.raceDate}: ${formatDuration(r.resultSeconds)}`)
          .join('; ')}.`
      : ''

  const weightTrendSummary = facts.weightTrend
    ? `\n\nBody weight: ${facts.weightTrend.currentWeightKg}kg currently${
        facts.weightTrend.changeKgLast90Days != null
          ? ` (${facts.weightTrend.changeKgLast90Days >= 0 ? '+' : ''}${facts.weightTrend.changeKgLast90Days.toFixed(1)}kg over the last 90 days)`
          : ''
      }${
        facts.weightTrend.currentBodyFatPct != null
          ? `, body fat ${facts.weightTrend.currentBodyFatPct}%${
              facts.weightTrend.changeBodyFatPctLast90Days != null
                ? ` (${facts.weightTrend.changeBodyFatPctLast90Days >= 0 ? '+' : ''}${facts.weightTrend.changeBodyFatPctLast90Days.toFixed(1)}pp over 90 days)`
                : ''
            }`
          : ''
      }.`
    : ''

  const projectedFinishSeconds = estimateProjectedFinishSeconds(race.race_type as RaceType, facts)
  const realismFlag = race.target_finish_seconds != null && projectedFinishSeconds != null ? assessGoalRealism(race.target_finish_seconds, projectedFinishSeconds) : null
  const finishTimeSummary =
    race.target_finish_seconds != null
      ? `\n\nThe athlete has set a target finish time of ${formatDuration(race.target_finish_seconds)} - treat this as the goal to build the plan's intensity around.${realismFlag ? ` ${realismFlag}` : ''}`
      : projectedFinishSeconds != null
        ? `\n\nData-estimated finish time (not a guarantee, just a data-based reference point): ${formatDuration(projectedFinishSeconds)}.`
        : ''

  const weaknessSummary =
    category === 'multisport' && disciplineWeakness
      ? `\n\nDiscipline weakness analysis (weakest first: ${disciplineWeakness.order.join(', ')}): ${(['swim', 'bike', 'run'] as Discipline[])
          .map((d) => `${d} - ${disciplineWeakness.notes[d]}`)
          .join(' ')} The weekly schedule below already allocates more volume to the weaker discipline(s) - explain this bias in your weekly notes rather than treating the split as arbitrary.`
      : ''

  const weeksTable = skeleton
    .map((w) => {
      if (w.disciplines) {
        return `${w.weekStartDate} (${w.phase}): swim ${w.disciplines.swim.km}km/${w.disciplines.swim.sessions} session(s), bike ${w.disciplines.bike.km}km/${w.disciplines.bike.sessions} session(s), run ${w.disciplines.run.km}km/${w.disciplines.run.sessions} session(s), ${w.targetStrengthSessions} strength session(s)`
      }
      return `${w.weekStartDate} (${w.phase}): ${w.targetCardioKm}km cardio across ${w.targetCardioSessions} session(s), ${w.targetStrengthSessions} strength session(s)`
    })
    .join('\n')

  const approachLabel = RACE_APPROACH_LABELS[approach]

  const prompt = `You are an elite endurance and strength coach who has reviewed this athlete's real training data before writing this plan. Be specific and direct - reference the actual numbers below rather than generic encouragement. No filler like "stay consistent" or "you've got this" - every sentence should carry a concrete observation or instruction.

Athlete is training for: ${raceTypeLabel(race.race_type)}${courseOrLocation ? ` (${courseOrLocation})` : ''} on ${race.race_date}, ${daysUntilRace} days away. Chosen approach: "${approachLabel}".

Current fitness snapshot:
${cardioSummary}
${strengthSummary}
${volumeSummary}
${consistencySummary}
${phaseSummary}
${goalsSummary}${selfAssessmentSummary}${tensionSummary}${pastResultsSummary}${weightTrendSummary}${finishTimeSummary}${weaknessSummary}${readinessSummary}

Here is the week-by-week schedule already computed for this athlete (the numbers are fixed - do not change or restate them numerically, just write about them):
${weeksTable}

For each week listed above, write ONE short, specific sentence (its "focus_note") explaining what to prioritize that week and why - ground it in the numbers already given, especially early weeks where you should reference the athlete's actual current fitness. Also write one short overview paragraph (2-4 sentences) summarizing the plan's overall shape and how it reconciles the athlete's current situation (training phase, consistency, any competing goals) with the chosen approach.`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            weeks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  weekStartDate: { type: Type.STRING },
                  focusNote: { type: Type.STRING },
                },
                required: ['weekStartDate', 'focusNote'],
              },
            },
          },
          required: ['overview', 'weeks'],
        },
      },
    })

    const parsed = JSON.parse(response.text ?? '{}')

    if (typeof parsed.overview !== 'string' || !Array.isArray(parsed.weeks)) {
      throw new Error('Malformed model response')
    }

    const focusNoteByWeek = new Map<string, string>()
    for (const entry of parsed.weeks) {
      if (typeof entry?.weekStartDate === 'string' && typeof entry?.focusNote === 'string') {
        focusNoteByWeek.set(entry.weekStartDate, entry.focusNote)
      }
    }

    const mergedWeeks = skeleton.map((week) => ({
      ...week,
      focusNote: focusNoteByWeek.get(week.weekStartDate) ?? PHASE_FALLBACK_NOTES[week.phase],
    }))

    const { error: upsertError } = await supabase.from('race_training_plans').upsert(
      {
        race_id: raceId,
        user_id: user.id,
        approach,
        overview: parsed.overview,
        weeks: mergedWeeks,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'race_id' }
    )

    if (upsertError) {
      console.error('Error saving race training plan:', upsertError)
      return NextResponse.json({ status: 'error', error: 'Failed to save plan' }, { status: 500 })
    }

    return NextResponse.json({
      status: 'ok',
      plan: { approach, overview: parsed.overview, weeks: mergedWeeks },
    })
  } catch (err) {
    console.error('Race plan generation failed:', err)
    return NextResponse.json({ status: 'error', error: 'Failed to generate plan' }, { status: 502 })
  }
}
