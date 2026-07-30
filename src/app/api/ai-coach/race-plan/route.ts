import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { analyzeCurrentFitness } from '@/lib/race-plan/analyze-fitness'
import { computeTrainingWeeks, type RaceApproach, type TrainingPhase } from '@/lib/race-plan/periodization'
import { raceTypeLabel } from '@/lib/race-constants'
import { getLocalDateString } from '@/lib/date'
import { daysBetween } from '@/lib/goals'

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

  if (!raceId || (approach !== 'full_send' && approach !== 'balanced')) {
    return NextResponse.json({ status: 'error', error: 'Missing raceId or approach' }, { status: 400 })
  }

  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('id, race_type, location, course_id, race_date')
    .eq('id', raceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (raceError || !race) {
    return NextResponse.json({ status: 'not_found' })
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

  const facts = await analyzeCurrentFitness(supabase, user.id)

  // Unlike the per-exercise recommend route, this deliberately has no
  // "not enough history" gate - the periodization math below has explicit
  // floors so it still produces a sensible starter plan at zero history,
  // rather than refusing to generate anything for a new user.
  const skeleton = computeTrainingWeeks(
    race.race_date,
    approach,
    facts.cardio.recentAvgWeeklyKm,
    facts.cardio.recentAvgSessionsPerWeek,
    facts.strength.recentSessionsPerWeek
  )

  const daysUntilRace = daysBetween(race.race_date, getLocalDateString())

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

  const weeksTable = skeleton
    .map((w) => `${w.weekStartDate} (${w.phase}): ${w.targetCardioKm}km cardio across ${w.targetCardioSessions} session(s), ${w.targetStrengthSessions} strength session(s)`)
    .join('\n')

  const approachLabel =
    approach === 'full_send' ? 'Full send - fully prioritize race prep' : 'Balanced - race prep alongside continued strength work'

  const prompt = `You are an elite endurance and strength coach who has reviewed this athlete's real training data before writing this plan. Be specific and direct - reference the actual numbers below rather than generic encouragement. No filler like "stay consistent" or "you've got this" - every sentence should carry a concrete observation or instruction.

Athlete is training for: ${raceTypeLabel(race.race_type)}${courseOrLocation ? ` (${courseOrLocation})` : ''} on ${race.race_date}, ${daysUntilRace} days away. Chosen approach: "${approachLabel}".

Current fitness snapshot:
${cardioSummary}
${strengthSummary}
${volumeSummary}
${consistencySummary}
${phaseSummary}
${goalsSummary}

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
