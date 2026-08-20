import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { getExerciseHistory } from '@/lib/ai-coach/getExerciseHistory'
import { getEffectiveTarget, type TrainingPhase, type TrainingIntensity } from '@/lib/nutrition'
import { computeMuscleVolume } from '@/lib/volume-analysis'
import { getLocalDateString } from '@/lib/date'
import { raceTypeLabel } from '@/lib/race-constants'
import { daysBetween } from '@/lib/goals'
import { DELOAD_CONTEXT } from '@/lib/deload'

const MIN_SESSIONS_FOR_RECOMMENDATION = 2
const MAX_SETS_IN_PROMPT = 20
const MODEL = 'gemini-2.5-flash'
// Matches the "notable" deviation threshold nutritionSuggestions.ts already
// uses for its own over/under-target read - same discipline, not a new number.
const NOTABLE_NUTRITION_DEVIATION_RATIO = 0.15

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: 'error', error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const exerciseLibraryId: string | null = body?.exerciseLibraryId ?? null
  const exerciseName: string | null = body?.exerciseName ?? null
  const variantLabel: string | null = body?.variantLabel ?? null
  // The client already fetched the user's saved default to seed its toggle
  // UI, so it always sends an explicit value - this is just a safe fallback.
  const includeNutrition: boolean = body?.includeNutrition ?? true

  if (!exerciseLibraryId && !exerciseName) {
    return NextResponse.json({ status: 'error', error: 'Missing exercise identifier' }, { status: 400 })
  }

  const history = await getExerciseHistory(supabase, exerciseLibraryId, exerciseName)

  // Gate on total sessions across all variants — cross-variant history is now
  // potentially usable input (see variantContext below) rather than being
  // discarded upfront, so it counts toward "enough data" too.
  const sessionCount = new Set(history.map((h) => h.workoutDate)).size
  if (sessionCount < MIN_SESSIONS_FOR_RECOMMENDATION) {
    return NextResponse.json({ status: 'not_enough_history' })
  }

  // history is sorted most-recent-first (see getExerciseHistory), so this is
  // the single most recent completed set for this exercise(+variant lookup).
  const latestSetId = history[0]?.id ?? null

  // Race-aware context: the soonest upcoming race with a generated training
  // plan, if any - fetched before the cache key so a newly (re)generated
  // plan or a new week starting produces a distinct cache key instead of
  // silently serving a stale recommendation (this cache otherwise only
  // invalidates on a new logged set, same as before this addition).
  const today = getLocalDateString()
  const { data: activeRace } = await supabase
    .from('races')
    .select('id, race_type, race_date')
    .eq('user_id', user.id)
    .gte('race_date', today)
    .order('race_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  let activePlan: { approach: string; weeks: { weekStartDate: string; phase: string }[] } | null = null
  if (activeRace) {
    const { data: planRow } = await supabase
      .from('race_training_plans')
      .select('approach, weeks')
      .eq('race_id', activeRace.id)
      .maybeSingle()
    activePlan = planRow ?? null
  }

  // weeks is stored chronologically, so the last entry starting on/before
  // today is the current week.
  let currentWeek: { weekStartDate: string; phase: string } | null = null
  if (activePlan) {
    for (const week of activePlan.weeks) {
      if (week.weekStartDate <= today) currentWeek = week
      else break
    }
  }

  let raceContext = ''
  let cacheRaceSuffix = 'race=none'
  if (activeRace && activePlan && currentWeek) {
    const daysUntilRace = daysBetween(activeRace.race_date, today)
    const approachInstruction =
      activePlan.approach === 'full_send'
        ? "Favor recovery and freshness for cardio over chasing a new strength PR right now - small, safe progression is fine, don't push to failure."
        : "Continue normal strength progression, but ease off slightly if this week's logged cardio volume has been unusually high."
    raceContext = `\n\nThis lifter is ${daysUntilRace} days out from a ${raceTypeLabel(activeRace.race_type)}, currently in the "${currentWeek.phase}" phase of a "${activePlan.approach}" training plan. ${approachInstruction}`
    cacheRaceSuffix = `race=${activeRace.id}:${currentWeek.weekStartDate}`
  }

  // Ad-hoc deload-aware context - same "code derives the fact, model
  // reasons about it" pattern as raceContext above (see src/lib/deload.ts
  // for the full reasoning behind the fixed instruction text).
  const { data: deloadSettings } = await supabase
    .from('user_settings')
    .select('active_deload_started_at')
    .eq('user_id', user.id)
    .maybeSingle()
  const isDeloadActive = deloadSettings?.active_deload_started_at != null

  const deloadContext = isDeloadActive ? `\n\n${DELOAD_CONTEXT}` : ''
  const cacheDeloadSuffix = isDeloadActive ? 'deload=active' : 'deload=none'

  // session_feedback can be set (or changed) on the most recent workout
  // AFTER its sets were already logged - latestSetId alone wouldn't catch
  // that, so this cache key includes it explicitly, same "extra suffix so
  // a fact that isn't a new set still invalidates the cache" pattern as
  // cacheRaceSuffix/cacheDeloadSuffix above.
  const cacheSessionFeedbackSuffix = `feedback=${history[0]?.sessionFeedback ?? 'none'}`

  const cacheKey = `${exerciseLibraryId || exerciseName}::${variantLabel ?? ''}::nutrition=${includeNutrition}::${cacheRaceSuffix}::${cacheDeloadSuffix}::${cacheSessionFeedbackSuffix}`

  const { data: cachedRow } = await supabase
    .from('ai_coach_recommendations')
    .select('weight, reps, reasoning, latest_set_id')
    .eq('user_id', user.id)
    .eq('cache_key', cacheKey)
    .maybeSingle()

  // Only regenerate when there's no cached recommendation yet, or a set has
  // been logged since the cached one was generated. Simply reopening the
  // page/workout never triggers a new Gemini call on its own.
  if (cachedRow && cachedRow.latest_set_id === latestSetId) {
    return NextResponse.json({
      status: 'ok',
      weight: cachedRow.weight,
      reps: cachedRow.reps,
      reasoning: cachedRow.reasoning,
    })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return NextResponse.json({ status: 'error', error: 'AI Coach is not configured' }, { status: 500 })
  }

  let primaryMuscleGroup: string | null = null
  let muscleTargets: string[] | null = null
  let isUnilateral = false
  if (exerciseLibraryId) {
    const { data } = await supabase
      .from('exercise_library')
      .select('primary_muscle_group, muscle_targets, is_unilateral')
      .eq('id', exerciseLibraryId)
      .maybeSingle()
    primaryMuscleGroup = data?.primary_muscle_group ?? null
    muscleTargets = data?.muscle_targets ?? null
    isUnilateral = data?.is_unilateral ?? false
  }

  const { data: settingsData } = await supabase
    .from('user_settings')
    .select('training_phase, training_intensity, maintenance_calories')
    .eq('user_id', user.id)
    .maybeSingle()
  const trainingPhase: string | null = settingsData?.training_phase ?? null
  const trainingIntensity: string | null = settingsData?.training_intensity ?? null
  const maintenanceCalories: number | null = settingsData?.maintenance_calories ?? null

  const hasVariantInfo = history.some((h) => h.variantLabel !== null)
  const promptHistory = history.slice(0, MAX_SETS_IN_PROMPT)
  const hasTechniqueInfo = promptHistory.some((h) => h.technique !== null)
  const hasRirInfo = promptHistory.some((h) => h.rir !== null)
  const hasSessionFeedbackInfo = promptHistory.some((h) => h.sessionFeedback !== null)
  const TECHNIQUE_TAG: Record<'drop' | 'myo', string> = { drop: 'drop set', myo: 'myo-rep' }
  const SESSION_FEEDBACK_TAG: Record<'too_easy' | 'just_right' | 'could_not_complete', string> = {
    too_easy: 'felt too easy',
    just_right: 'felt just right',
    could_not_complete: "couldn't complete as planned",
  }

  const historyText = promptHistory
    .map((set) => {
      const variantSuffix = hasVariantInfo ? ` [${set.variantLabel ?? 'no variant specified'}]` : ''
      const techniqueSuffix = set.technique ? ` [${TECHNIQUE_TAG[set.technique]}]` : ''
      const rirSuffix = set.rir != null ? ` @RIR ${set.rir}` : ''
      const sessionFeedbackSuffix = set.sessionFeedback ? ` [session ${SESSION_FEEDBACK_TAG[set.sessionFeedback]}]` : ''
      return `${set.workoutDate}: ${set.weight}kg x ${set.reps}${set.rpe ? ` @RPE ${set.rpe}` : ''}${rirSuffix}${variantSuffix}${techniqueSuffix}${sessionFeedbackSuffix}`
    })
    .join('\n')

  let variantContext = ''
  if (hasVariantInfo) {
    variantContext = `\n\nThe currently selected equipment variant for this session is "${
      variantLabel ?? 'none specified'
    }". Some of the history above may be on different equipment variants (different machine brands or cable/pulley ratios). If you can reasonably estimate a numeric conversion between variants (e.g. cable ratios like 1:1 vs 2:1), use it to inform your recommendation and briefly mention the conversion. If you cannot reasonably estimate a conversion (e.g. different machine brands with unknown leverage/ROM differences), rely primarily on same-variant history and note in your reasoning that you're hedging due to limited directly-comparable data.`
  }

  // Lines tagged [drop set]/[myo-rep] are follow-on/burnout sets at
  // reduced weight (drop set) or rest-pause mini-sets (myo-rep) - extra
  // stimulus after a real top set, not a sign the lifter's top-set
  // strength has changed. Only added when the shown history actually
  // contains a tagged row, same "only speak up when relevant" precedent
  // as the other optional context blocks here.
  let techniqueContext = ''
  if (hasTechniqueInfo) {
    techniqueContext = `\n\nLines tagged [drop set] or [myo-rep] are follow-on/burnout sets, not independent top sets - a drop set continues at reduced weight after reaching near-failure, and a myo-rep is a rest-pause mini-set at the same weight. Don't undervalue this lifter's progression because one of these shows a lighter weight or fewer reps than a normal set - base your recommendation on the untagged (normal) sets as the real top-set signal.`
  }

  // @RIR tags are per-set (migration 075), not a session average - a real,
  // more specific signal than @RPE (which nothing currently writes to).
  // Only added when the shown history actually contains a tagged row,
  // same "only speak up when relevant" precedent as the other optional
  // context blocks here. Facts in, model reasons about it - no
  // pre-computed "last set was X" summary; the history is already
  // ordered most-recent-first, so the model can read that directly.
  let rirContext = ''
  if (hasRirInfo) {
    rirContext = `\n\nLines tagged @RIR show reps in reserve at the time (0 = trained to failure, higher numbers mean it felt easier, on a 0-10 scale). This is the lifter's own real-time read of how hard a set was, not a derived estimate - weight the most recent sets' RIR more heavily than older ones as the freshest signal of how much they have left in the tank right now.`
  }

  // Lines tagged [session ...] carry the lifter's own post-WORKOUT rating
  // (migration 087) - the same value repeats across every set from that
  // workout, since it's a whole-session judgment, not a per-set one
  // (distinct from @RIR above: this asks "was the session as prescribed
  // calibrated right," not "how hard was this specific set"). Only added
  // when the shown history actually contains a tagged row, same
  // "only speak up when relevant" precedent as the other optional context
  // blocks here.
  let sessionFeedbackContext = ''
  if (hasSessionFeedbackInfo) {
    sessionFeedbackContext = `\n\nLines tagged [session ...] carry the lifter's own rating of that ENTIRE workout, not this specific set - "felt too easy" means the whole session was underdosed, so a more assertive jump is reasonable if this exercise's own sets support it; "couldn't complete as planned" means something in that session didn't go as prescribed (fatigue, time, injury caution), so read that day's sets more conservatively even if the numbers alone look fine. "felt just right" needs no special caution either way.`
  }

  // Same "code derives the fact, model reasons about it" pattern as
  // raceContext/deloadContext - no ratio math (there's no clean,
  // universal "unilateral load as % of bilateral load" formula, it
  // varies by exercise and person), just qualitative framing plus the
  // one real, citable piece of evidence available.
  let unilateralContext = ''
  if (isUnilateral) {
    unilateralContext = `\n\nThis is a unilateral (one side at a time) exercise. Do not assume its load is simply half of an equivalent bilateral exercise's load, or calculate any such ratio - that relationship varies too much by exercise and by individual to estimate reliably. Progress the weight more conservatively than you would for a comparable bilateral exercise: real evidence shows unilateral strength gains tend to accumulate more slowly than bilateral ones (one study found ~8.4% 1RM growth for bilateral training vs. ~5.15% for unilateral training over the same period). Let that inform a generally more measured pace of increase here, not a fixed percentage-per-week rule.`
  }

  let muscleGroupContext = ''
  if (primaryMuscleGroup) {
    // Granular targets (e.g. "Triceps (Long Head)"), when available, sharpen
    // this from a broad-group guess to the actual muscle(s) worked - but
    // this degrades gracefully to the broad group alone for the many
    // exercises that don't have granular data yet.
    const targetDescription =
      muscleTargets && muscleTargets.length > 0 ? muscleTargets.join(', ') : primaryMuscleGroup
    muscleGroupContext = `\n\nThis exercise primarily targets: ${targetDescription}. Apply general resistance-training principles for expected progression pace for this muscle group (smaller/faster-recovering muscle groups like arms or calves can often progress faster session-to-session than large/slower-recovering groups like quads or back) — reason about this yourself rather than treating all muscle groups the same.`
  }

  let phaseContext = ''
  if (trainingPhase) {
    phaseContext = `\n\nThe lifter's current self-reported training phase is "${trainingPhase}" at "${trainingIntensity}" intensity. Factor this into how aggressive to be: a bulk supports more aggressive progression. A cut does NOT mean progression should stop — a beginner/intermediate lifter can often still gain strength/muscle even while cutting, especially at "mild" intensity, so don't default to "hold the same weight" just because they're cutting. Only pull back meaningfully for an "aggressive" cut.`
  }

  // Optional (toggleable) - only speaks up when today's nutrition is
  // actually logged and notably off target; otherwise stays silent rather
  // than manufacturing a signal from nothing.
  let nutritionContext = ''
  if (includeNutrition) {
    const { data: todayEntry } = await supabase
      .from('nutrition_entries')
      .select('calories, activity_adjustment_kcal')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()

    if (todayEntry) {
      const target = getEffectiveTarget(
        maintenanceCalories,
        trainingPhase as TrainingPhase | null,
        trainingIntensity as TrainingIntensity | null,
        todayEntry.activity_adjustment_kcal ?? null
      )

      if (target != null) {
        const deviation = (todayEntry.calories - target) / target
        if (deviation < -NOTABLE_NUTRITION_DEVIATION_RATIO) {
          nutritionContext = `\n\nToday's logged nutrition (${todayEntry.calories} kcal) is notably under the lifter's effective target (${Math.round(target)} kcal). Let this nudge you toward a more rep-focused, same-weight target today rather than a fresh weight jump — don't abandon progression, just favor reps over load on a lower-fuel day.`
        } else if (deviation > NOTABLE_NUTRITION_DEVIATION_RATIO) {
          nutritionContext = `\n\nToday's logged nutrition (${todayEntry.calories} kcal) is comfortably above the lifter's effective target (${Math.round(target)} kcal) - well-fueled today, no need for caution here.`
        }
      }
    }
  }

  // Muscle-specific weekly volume (from the optional gym schedule/volume
  // feature) - only relevant when this exercise resolves to a muscle that
  // actually has logged volume data this week.
  let volumeContext = ''
  const resolvedMuscles = muscleTargets && muscleTargets.length > 0 ? muscleTargets : primaryMuscleGroup ? [primaryMuscleGroup] : []
  if (resolvedMuscles.length > 0) {
    const volumes = await computeMuscleVolume(supabase)
    const relevant = volumes.filter((v) => resolvedMuscles.includes(v.muscle))
    const overTrained = relevant.filter((v) => v.status === 'over')
    const underTrained = relevant.filter((v) => v.status === 'under')

    if (overTrained.length > 0) {
      volumeContext = `\n\nThis muscle (${overTrained.map((v) => `${v.muscle}: ${v.sets} sets`).join(', ')}) is already above the ~10-20 sets/week volume guideline for this week. Still push for progress, but a technical/rep-quality emphasis is just as valid as another aggressive jump today.`
    } else if (underTrained.length > 0) {
      volumeContext = `\n\nThis muscle (${underTrained.map((v) => `${v.muscle}: ${v.sets} sets`).join(', ')}) is under the ~10-20 sets/week volume guideline for this week - no reason to hold back, plenty of room for an ambitious push.`
    }
  }

  // Future hook: once sleep tracking exists, build a context string here the
  // same way nutritionContext/volumeContext do above, and it'll already be
  // spliced into the prompt below - no other restructuring needed.
  const sleepContext = ''

  const prompt = `You are an experienced strength training coach helping a lifter plan their next set. Be direct and appropriately ambitious, not overly conservative — if recent sets were all completed cleanly (full reps, no signs of failure), recommend a real jump rather than a token +1 rep increase.

Below is their recent set history for one exercise, most recent session first (weight in kg):

${historyText}${variantContext}${techniqueContext}${rirContext}${sessionFeedbackContext}${muscleGroupContext}${unilateralContext}${phaseContext}${nutritionContext}${volumeContext}${raceContext}${deloadContext}${sleepContext}

Recommend the weight and reps for their NEXT set on this exercise as an ambitious target to attempt. Keep the reasoning to one short sentence covering your main rationale — if multiple factors above are relevant, mention at most the one or two most decision-relevant ones rather than trying to reference everything.`

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
            weight: { type: Type.NUMBER },
            reps: { type: Type.INTEGER },
            reasoning: { type: Type.STRING },
          },
          required: ['weight', 'reps', 'reasoning'],
        },
      },
    })

    const parsed = JSON.parse(response.text ?? '{}')

    if (typeof parsed.weight !== 'number' || typeof parsed.reps !== 'number' || typeof parsed.reasoning !== 'string') {
      throw new Error('Malformed model response')
    }

    const { error: upsertError } = await supabase.from('ai_coach_recommendations').upsert(
      {
        user_id: user.id,
        cache_key: cacheKey,
        exercise_library_id: exerciseLibraryId,
        exercise_name: exerciseName,
        variant_label: variantLabel,
        weight: parsed.weight,
        reps: parsed.reps,
        reasoning: parsed.reasoning,
        latest_set_id: latestSetId,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,cache_key' }
    )

    if (upsertError) {
      console.error('Error caching AI Coach recommendation:', upsertError)
    }

    return NextResponse.json({
      status: 'ok',
      weight: parsed.weight,
      reps: parsed.reps,
      reasoning: parsed.reasoning,
    })
  } catch (err) {
    console.error('AI Coach recommendation failed:', err)
    return NextResponse.json({ status: 'error', error: 'Failed to generate recommendation' }, { status: 502 })
  }
}
