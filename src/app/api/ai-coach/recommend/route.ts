import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { getExerciseHistory } from '@/lib/ai-coach/getExerciseHistory'

const MIN_SESSIONS_FOR_RECOMMENDATION = 2
const MAX_SETS_IN_PROMPT = 20
const MODEL = 'gemini-2.5-flash'

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
  const cacheKey = `${exerciseLibraryId || exerciseName}::${variantLabel ?? ''}`

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
  if (exerciseLibraryId) {
    const { data } = await supabase
      .from('exercise_library')
      .select('primary_muscle_group, muscle_targets')
      .eq('id', exerciseLibraryId)
      .maybeSingle()
    primaryMuscleGroup = data?.primary_muscle_group ?? null
    muscleTargets = data?.muscle_targets ?? null
  }

  const { data: settingsData } = await supabase
    .from('user_settings')
    .select('training_phase, training_intensity')
    .eq('user_id', user.id)
    .maybeSingle()
  const trainingPhase: string | null = settingsData?.training_phase ?? null
  const trainingIntensity: string | null = settingsData?.training_intensity ?? null

  const hasVariantInfo = history.some((h) => h.variantLabel !== null)

  const historyText = history
    .slice(0, MAX_SETS_IN_PROMPT)
    .map((set) => {
      const variantSuffix = hasVariantInfo ? ` [${set.variantLabel ?? 'no variant specified'}]` : ''
      return `${set.workoutDate}: ${set.weight}kg x ${set.reps}${set.rpe ? ` @RPE ${set.rpe}` : ''}${variantSuffix}`
    })
    .join('\n')

  let variantContext = ''
  if (hasVariantInfo) {
    variantContext = `\n\nThe currently selected equipment variant for this session is "${
      variantLabel ?? 'none specified'
    }". Some of the history above may be on different equipment variants (different machine brands or cable/pulley ratios). If you can reasonably estimate a numeric conversion between variants (e.g. cable ratios like 1:1 vs 2:1), use it to inform your recommendation and briefly mention the conversion. If you cannot reasonably estimate a conversion (e.g. different machine brands with unknown leverage/ROM differences), rely primarily on same-variant history and note in your reasoning that you're hedging due to limited directly-comparable data.`
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

  const prompt = `You are an experienced strength training coach helping a lifter plan their next set. Be direct and appropriately ambitious, not overly conservative — if recent sets were all completed cleanly (full reps, no signs of failure), recommend a real jump rather than a token +1 rep increase.

Below is their recent set history for one exercise, most recent session first (weight in kg):

${historyText}${variantContext}${muscleGroupContext}${phaseContext}

Recommend the weight and reps for their NEXT set on this exercise as an ambitious target to attempt. Keep the reasoning to one short sentence covering your main rationale.`

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
