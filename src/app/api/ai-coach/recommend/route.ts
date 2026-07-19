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

  if (!exerciseLibraryId && !exerciseName) {
    return NextResponse.json({ status: 'error', error: 'Missing exercise identifier' }, { status: 400 })
  }

  const history = await getExerciseHistory(supabase, exerciseLibraryId, exerciseName)
  const sessionCount = new Set(history.map((h) => h.workoutDate)).size

  if (sessionCount < MIN_SESSIONS_FOR_RECOMMENDATION) {
    return NextResponse.json({ status: 'not_enough_history' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return NextResponse.json({ status: 'error', error: 'AI Coach is not configured' }, { status: 500 })
  }

  const historyText = history
    .slice(0, MAX_SETS_IN_PROMPT)
    .map((set) => `${set.workoutDate}: ${set.weight}kg x ${set.reps}${set.rpe ? ` @RPE ${set.rpe}` : ''}`)
    .join('\n')

  const prompt = `You are a strength training coach helping a lifter plan their next set.

Below is their recent set history for one exercise, most recent session first (weight in kg):

${historyText}

Recommend the weight and reps for their NEXT set on this exercise. Keep the reasoning to one short sentence.`

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

    if (
      typeof parsed.weight !== 'number' ||
      typeof parsed.reps !== 'number' ||
      typeof parsed.reasoning !== 'string'
    ) {
      throw new Error('Malformed model response')
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
