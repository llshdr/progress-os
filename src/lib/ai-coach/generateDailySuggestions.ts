import { GoogleGenAI, Type } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getGymSuggestionCandidates } from './gymSuggestions'
import type { Suggestion, SuggestionCandidate } from './types'
import { getLocalDateString } from '@/lib/date'

const MODEL = 'gemini-2.5-flash'
const MAX_SUGGESTIONS = 4
const MIN_SUGGESTIONS = 2

// Asks the model to pick and rephrase a subset of the deterministic
// candidates. The model never invents links or numbers: it returns an index
// into the candidate list plus rewritten text, and we resolve module/action
// from the original candidate server-side. Falls back to the raw candidates
// (already full, readable sentences) if anything goes wrong.
async function pickAndRephrase(candidates: SuggestionCandidate[]): Promise<Suggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return candidates.slice(0, MAX_SUGGESTIONS)
  }

  const candidateList = candidates.map((c, i) => `${i}. [${c.module}] ${c.text}`).join('\n')

  const prompt = `You are a supportive fitness coach. Below are candidate suggestions for a user's dashboard today, each with an index.

${candidateList}

Pick the ${MIN_SUGGESTIONS}-${MAX_SUGGESTIONS} most useful and motivating ones for today. For each, keep all facts and numbers exactly as given, but you may rephrase the wording to sound warmer and more natural. Return them ordered by importance.`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER },
              text: { type: Type.STRING },
            },
            required: ['index', 'text'],
          },
        },
      },
    })

    const parsed = JSON.parse(response.text ?? '[]')
    if (!Array.isArray(parsed)) throw new Error('Malformed model response')

    const suggestions: Suggestion[] = []
    for (const item of parsed) {
      const candidate = candidates[item?.index]
      if (!candidate || typeof item.text !== 'string') continue
      suggestions.push({
        module: candidate.module,
        text: item.text,
        action: candidate.action ?? null,
      })
      if (suggestions.length >= MAX_SUGGESTIONS) break
    }

    return suggestions.length > 0 ? suggestions : candidates.slice(0, MAX_SUGGESTIONS)
  } catch (err) {
    console.error('AI Coach daily suggestions generation failed, falling back to raw candidates:', err)
    return candidates.slice(0, MAX_SUGGESTIONS)
  }
}

export async function generateDailySuggestions(
  supabase: SupabaseClient,
  userId: string
): Promise<Suggestion[]> {
  const today = getLocalDateString()

  const { data: cached } = await supabase
    .from('daily_suggestions')
    .select('suggestions')
    .eq('user_id', userId)
    .eq('suggestion_date', today)
    .maybeSingle()

  if (cached?.suggestions) {
    return cached.suggestions as Suggestion[]
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('weekly_workout_goal')
    .eq('user_id', userId)
    .maybeSingle()

  const weeklyGoal = settings?.weekly_workout_goal ?? 5

  // Gather candidates from every module that has one. Only gym exists today;
  // future modules (nutrition, business, ...) append their own candidates
  // here without changing anything else in this pipeline.
  const candidates: SuggestionCandidate[] = [
    ...(await getGymSuggestionCandidates(supabase, userId, weeklyGoal)),
  ]

  const suggestions = candidates.length > 0 ? await pickAndRephrase(candidates) : []

  await supabase.from('daily_suggestions').upsert(
    {
      user_id: userId,
      suggestion_date: today,
      suggestions,
    },
    { onConflict: 'user_id,suggestion_date' }
  )

  return suggestions
}
