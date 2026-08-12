import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { analyzeCurrentFitness } from '@/lib/race-plan/analyze-fitness'
import { computeTrainingWeeks, RACE_APPROACHES, RACE_APPROACH_LABELS, type RaceApproach, type TrainingPhase } from '@/lib/race-plan/periodization'
import { raceTypeLabel, type RaceType } from '@/lib/race-constants'
import { getLocalDateString } from '@/lib/date'
import { formatDuration } from '@/lib/format'
import { daysBetween } from '@/lib/goals'
import { computeTensionFlags } from '@/lib/race-plan/tension'
import {
  estimateProjectedFinishSeconds,
  assessGoalRealism,
  estimateCourseFinishRange,
  assessCutoffRisk,
  assessGoalRealismForRange,
} from '@/lib/race-plan/finish-time'
import { raceCategoryFor, experienceLevelFor, type SelfAssessment, type Discipline } from '@/lib/race-plan/self-assessment'
import { computeDisciplineActivityFacts, assessMultisportReadiness, describePaceTrend } from '@/lib/race-plan/discipline-weakness'
import { formatPaceForDiscipline } from '@/lib/race-plan/pace-units'
import { fetchCourseProfile, fetchCourseTimeBand, fetchCourseCutoffs, describeCourseDifficulty } from '@/lib/race-plan/course-data'
import { assessNutritionPhaseTension } from '@/lib/race-plan/nutrition-phase'
import { computeDayByDayTemplates } from '@/lib/race-plan/day-template'
import { deriveCurrentFormLevel } from '@/lib/race-plan/current-form'

const MODEL = 'gemini-2.5-flash'

const PHASE_FALLBACK_NOTES: Record<TrainingPhase, string> = {
  base: 'Base phase: build your aerobic foundation and keep strength sessions steady.',
  build: 'Build phase: push weekly volume up and let intensity follow.',
  peak: 'Peak phase: hold near your highest volume this cycle, dial in race-pace effort.',
  taper: 'Taper: cut volume back and arrive fresh and ready.',
}

// Acclimation weeks are phase: 'base' underneath (see periodization.ts's
// TrainingWeekSkeleton.isAcclimation) but are NOT about building fitness -
// PHASE_FALLBACK_NOTES.base's "build your aerobic foundation" framing
// directly contradicts ACCLIMATION_GUIDANCE (race-day-prep.ts), which the
// UI already shows once per acclimation block. Used unconditionally for
// every isAcclimation week below - never the model's own note for these
// specific weeks - so this can't drift from that framing regardless of
// what the model writes, the same "never trust the model with a fact it
// could get wrong" discipline as the rest of this route.
const ACCLIMATION_FALLBACK_NOTE = "Acclimation, not fitness-building yet - keep everything easy and focus on making training across three disciplines plus strength feel routine."

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
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
      if (d.comfortableEffort) {
        bits.push(`comfortable pace ~${formatPaceForDiscipline(d.comfortableEffort.paceSecPerKm, discipline)}, sustainable ~${d.comfortableEffort.sustainedMinutes}min`)
      }
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
    .select('id, race_type, location, course_id, race_date, self_assessment, target_finish_seconds, discipline_weakness, training_start_date')
    .eq('id', raceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (raceError || !race) {
    return NextResponse.json({ status: 'not_found' })
  }

  const selfAssessment = (race.self_assessment ?? null) as SelfAssessment | null
  const category = raceCategoryFor(race.race_type as RaceType)
  const disciplineWeakness = (race.discipline_weakness ?? null) as { order: Discipline[]; notes: Record<Discipline, string> } | null

  // Defensive guard: a multisport race must have completed discipline-
  // weakness analysis before generation. Without it, disciplineInputs
  // below would silently be undefined and computeTrainingWeeks would
  // silently fall back to the single-discipline cardio path - a plan
  // that LOOKS complete but is missing the discipline split/brick
  // sessions with no warning to the athlete. Fail loudly instead (the
  // client's own weakness-step flow is the primary place this is now
  // prevented from happening at all - this is the last line of defense).
  if (category === 'multisport' && !disciplineWeakness) {
    return NextResponse.json(
      { status: 'error', error: 'Discipline analysis is missing for this race - go back to the assessment step and complete it before generating a plan.' },
      { status: 400 }
    )
  }

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
  const baselineLevel = category === 'multisport' && selfAssessment?.kind === 'multisport' ? experienceLevelFor(selfAssessment.pastMultisportExperience) : 'beginner'
  const disciplineActivityFacts = category === 'multisport' ? await computeDisciplineActivityFacts(supabase) : null
  // Re-derived from real, sustained recent activity rather than trusting
  // the self-report forever - feeds BOTH the volume model below and the
  // course-band fetch/projection, since generating a plan is already the
  // consent-gated moment for incorporating new evidence (see
  // current-form.ts).
  const currentForm = deriveCurrentFormLevel(baselineLevel, disciplineActivityFacts)
  const level = currentForm.level

  // Course data (Phase 2) - fetched once, reused for the finish-time range,
  // cutoff risk, and qualitative prompt context below. Gracefully absent
  // (all null/empty) for races with no course_id or an un-seeded course.
  let courseProfile = null as Awaited<ReturnType<typeof fetchCourseProfile>>
  let courseTimeBand = null as Awaited<ReturnType<typeof fetchCourseTimeBand>>
  let courseCutoffs: Awaited<ReturnType<typeof fetchCourseCutoffs>> = []
  if (category === 'multisport' && race.course_id) {
    ;[courseProfile, courseTimeBand, courseCutoffs] = await Promise.all([
      fetchCourseProfile(supabase, race.course_id),
      fetchCourseTimeBand(supabase, race.course_id, level),
      fetchCourseCutoffs(supabase, race.course_id),
    ])
  }

  // Hoisted above disciplineInputs (moved up from its previous position
  // further down, alongside finishTimeSummary/cutoffSummary) - the
  // weakest-discipline emphasis below needs to know about real cutoff
  // risk before the volume model runs, not after.
  const courseRangeForGeneration =
    category === 'multisport'
      ? estimateCourseFinishRange(race.race_type as RaceType, level, facts.pastRaceResults, race.course_id, courseTimeBand)
      : null
  const cutoffFlags = courseRangeForGeneration ? assessCutoffRisk(courseRangeForGeneration, courseCutoffs) : []
  // Real risk of missing a cutoff, not just a "watch" - this needs to be
  // impossible for the model to bury among everything else it's told,
  // and is what the weakest-discipline emphasis below reacts to.
  const hasCutoffRisk = cutoffFlags.some((f) => f.risk === 'risk')

  const disciplineInputs =
    category === 'multisport' && disciplineWeakness && disciplineActivityFacts
      ? { activityFacts: disciplineActivityFacts, order: disciplineWeakness.order, level, hasCutoffRisk }
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
    disciplineInputs,
    race.training_start_date
  )

  // Deterministic, code-computed - never involves the model. Sized
  // against each phase's own highest-session-count week (see
  // day-template.ts for why that isn't simply "the last week").
  const phaseTemplates = computeDayByDayTemplates(skeleton, approach)

  // Current-week phase - skeleton always starts at today's week, so
  // skeleton[0] is always "the phase the athlete is in right now" at
  // generation time.
  const nutritionTensionFlag = assessNutritionPhaseTension(skeleton[0].phase, facts.trainingPhase, facts.trainingIntensity, facts.maintenanceCalories)
  const nutritionTensionSummary = nutritionTensionFlag ? `\n\n${nutritionTensionFlag}` : ''

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
  // courseRange/cutoffFlags/hasCutoffRisk are computed earlier now (see
  // courseRangeForGeneration above) - reused here under the name the
  // rest of this prompt-building section already expects.
  const courseRange = courseRangeForGeneration

  const realismFlag =
    race.target_finish_seconds != null && projectedFinishSeconds != null
      ? assessGoalRealism(race.target_finish_seconds, projectedFinishSeconds)
      : race.target_finish_seconds != null && courseRange != null
        ? assessGoalRealismForRange(race.target_finish_seconds, courseRange)
        : null
  const finishTimeSummary =
    race.target_finish_seconds != null
      ? `\n\nThe athlete has set a target finish time of ${formatDuration(race.target_finish_seconds)} - treat this as the goal to build the plan's intensity around.${realismFlag ? ` ${realismFlag}` : ''}`
      : projectedFinishSeconds != null
        ? `\n\nData-estimated finish time (not a guarantee, just a data-based reference point): ${formatDuration(projectedFinishSeconds)}.`
        : courseRange != null
          ? `\n\nData-estimated finish time range (${courseRange.sourceNote}): ${formatDuration(courseRange.totalSecondsLow)}-${formatDuration(courseRange.totalSecondsHigh)}.`
          : ''

  const courseContextSummary = courseProfile
    ? `\n\nCourse context (informational, not factored into the numeric plan): ${[
        describeCourseDifficulty(courseProfile.difficultyFactor),
        courseProfile.elevationGainM != null ? `~${courseProfile.elevationGainM}m of elevation gain.` : null,
        courseProfile.swimNotes,
        courseProfile.bikeNotes,
        courseProfile.runNotes,
      ]
        .filter(Boolean)
        .join(' ')}`
    : ''

  const cutoffSummary = cutoffFlags.length > 0 ? `\n\nCutoff check: ${cutoffFlags.map((f) => f.message).join(' ')}` : ''

  const weaknessSummary =
    category === 'multisport' && disciplineWeakness
      ? `\n\nDiscipline weakness analysis (weakest first: ${disciplineWeakness.order.join(', ')}): ${(['swim', 'bike', 'run'] as Discipline[])
          .map((d) => {
            const facts = disciplineActivityFacts?.[d]
            const trend = facts ? describePaceTrend(facts.avgPaceSecPerKmRecent, facts.avgPaceSecPerKmPrior) : 'insufficient_data'
            const trendNote = trend !== 'insufficient_data' ? ` (logged pace trend: ${trend})` : ''
            return `${d} - ${disciplineWeakness.notes[d]}${trendNote}`
          })
          .join(' ')} The weekly schedule below already allocates more volume to the weaker discipline(s) - explain this bias in your weekly notes rather than treating the split as arbitrary.${
          hasCutoffRisk
            ? ` Because there's real cutoff risk, ${disciplineWeakness.order[0]} (the weakest discipline) is getting an EXTRA emphasis on top of the usual weakness bias - mention this explicitly, don't just describe the normal weakness split.`
            : ''
        }`
      : ''

  const currentFormSummary = currentForm.changed
    ? `\n\n${currentForm.reason}`
    : ''

  // Labeled distinctly from real Base weeks (never just "(base)") so the
  // model has a real signal that these are different, even though its
  // per-week note for them is discarded anyway (see ACCLIMATION_FALLBACK_NOTE)
  // - this still matters for the model's OVERVIEW paragraph, which
  // shouldn't imply fitness-building starts on day one when it doesn't.
  const weeksTable = skeleton
    .map((w) => {
      const phaseLabel = w.isAcclimation ? 'acclimation' : w.phase
      if (w.disciplines) {
        const brick = w.brickSessions ? `, ${w.brickSessions} brick (bike-run) session(s)` : ''
        return `${w.weekStartDate} (${phaseLabel}): swim ${w.disciplines.swim.km}km/${w.disciplines.swim.sessions} session(s), bike ${w.disciplines.bike.km}km/${w.disciplines.bike.sessions} session(s), run ${w.disciplines.run.km}km/${w.disciplines.run.sessions} session(s), ${w.targetStrengthSessions} strength session(s)${brick}`
      }
      return `${w.weekStartDate} (${phaseLabel}): ${w.targetCardioKm}km cardio across ${w.targetCardioSessions} session(s), ${w.targetStrengthSessions} strength session(s)`
    })
    .join('\n')

  const acclimationWeeksCount = skeleton.filter((w) => w.isAcclimation).length
  const acclimationSummary =
    acclimationWeeksCount > 0
      ? `\n\nThis plan opens with a ${acclimationWeeksCount}-week Acclimation block (weeks labeled "(acclimation)" below) - light volume, zero intensity, purely about adapting to training across three disciplines plus strength before real Base training begins. If your overview paragraph mentions the plan's early stages, reflect this honestly rather than implying fitness-building starts immediately.`
      : ''

  const approachLabel = RACE_APPROACH_LABELS[approach]

  const prompt = `You are an elite endurance and strength coach who has reviewed this athlete's real training data before writing this plan. Be specific and direct - reference the actual numbers below rather than generic encouragement. No filler like "stay consistent" or "you've got this" - every sentence should carry a concrete observation or instruction.

Athlete is training for: ${raceTypeLabel(race.race_type)}${courseOrLocation ? ` (${courseOrLocation})` : ''} on ${race.race_date}, ${daysUntilRace} days away. Chosen approach: "${approachLabel}".

Current fitness snapshot:
${cardioSummary}
${strengthSummary}
${volumeSummary}
${consistencySummary}
${phaseSummary}
${goalsSummary}${selfAssessmentSummary}${tensionSummary}${pastResultsSummary}${weightTrendSummary}${currentFormSummary}${finishTimeSummary}${courseContextSummary}${cutoffSummary}${weaknessSummary}${readinessSummary}${nutritionTensionSummary}${acclimationSummary}

Here is the week-by-week schedule already computed for this athlete (the numbers are fixed - do not change or restate them numerically, just write about them):
${weeksTable}

For each week listed above, write ONE short, specific sentence (its "focus_note") explaining what to prioritize that week and why - ground it in the numbers already given, especially early weeks where you should reference the athlete's actual current fitness. When a week includes brick (bike-run) session(s), mention what they're for (practicing race-day transitions and running on tired legs), not just that they exist.${
      acclimationWeeksCount > 0
        ? ' Weeks labeled "(acclimation)" get a fixed explanation instead of your note (see above for why) - write something brief for them if you like, or skip them, but never describe them as building fitness or aerobic base.'
        : ''
    } Also write one short overview paragraph (2-4 sentences) summarizing the plan's overall shape and how it reconciles the athlete's current situation (training phase, consistency, any competing goals) with the chosen approach.${
      hasCutoffRisk
        ? ' The athlete has a real risk of missing a course cutoff at their current projected pace (see the cutoff check above) - open the overview by naming this plainly, then explain whether the chosen approach actually pushes hard enough to close that gap or whether it does not.'
        : ''
    }`

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
      focusNote: week.isAcclimation ? ACCLIMATION_FALLBACK_NOTE : (focusNoteByWeek.get(week.weekStartDate) ?? PHASE_FALLBACK_NOTES[week.phase]),
    }))

    const { error: upsertError } = await supabase.from('race_training_plans').upsert(
      {
        race_id: raceId,
        user_id: user.id,
        approach,
        overview: parsed.overview,
        weeks: mergedWeeks,
        phase_templates: phaseTemplates,
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
      plan: { approach, overview: parsed.overview, weeks: mergedWeeks, phaseTemplates },
    })
  } catch (err) {
    console.error('Race plan generation failed:', err)
    return NextResponse.json({ status: 'error', error: 'Failed to generate plan' }, { status: 502 })
  }
}
