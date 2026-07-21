import { GoogleGenAI, Type } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getGymSuggestionCandidates } from './gymSuggestions'
import { getProjectsSuggestionCandidates } from './projectsSuggestions'
import { getNutritionSuggestionCandidates } from './nutritionSuggestions'
import type { Suggestion, SuggestionCandidate } from './types'
import { getLocalDateString } from '@/lib/date'

// Combined fingerprint of every contributing signal across gym, nutrition,
// and projects, plus every setting these prompts/candidates depend on -
// regenerates when any of it actually changes, not on a calendar-day timer.
async function buildDailySuggestionsFingerprint(supabase: SupabaseClient, userId: string) {
  const [
    { data: latestSet },
    { data: latestWorkout },
    { data: latestNutritionEntry },
    { count: nutritionEntryCount },
    { data: latestGoal },
    { data: latestProject },
    { data: settings },
  ] = await Promise.all([
    supabase.from('sets').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from('workouts')
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('nutrition_entries')
      .select('id')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('nutrition_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase
      .from('goals')
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('projects')
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('user_settings')
      .select('maintenance_calories, training_phase, training_intensity, weekly_workout_goal')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const parts = [
    latestSet?.id,
    latestWorkout?.updated_at,
    latestNutritionEntry?.id,
    nutritionEntryCount,
    latestGoal?.updated_at,
    latestProject?.updated_at,
    settings?.maintenance_calories,
    settings?.training_phase,
    settings?.training_intensity,
    settings?.weekly_workout_goal,
  ]

  return { fingerprint: parts.map((p) => String(p ?? 'null')).join('|'), weeklyGoal: settings?.weekly_workout_goal ?? 5 }
}

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
  const { fingerprint, weeklyGoal } = await buildDailySuggestionsFingerprint(supabase, userId)

  const { data: cached } = await supabase
    .from('daily_suggestions')
    .select('suggestions, fingerprint')
    .eq('user_id', userId)
    .maybeSingle()

  if (cached && cached.fingerprint === fingerprint) {
    return cached.suggestions as Suggestion[]
  }

  // Gather candidates from every module that has one. Future modules append
  // their own candidates here without changing anything else in this pipeline.
  const candidates: SuggestionCandidate[] = [
    ...(await getGymSuggestionCandidates(supabase, userId, weeklyGoal)),
    ...(await getProjectsSuggestionCandidates(supabase, userId)),
    ...(await getNutritionSuggestionCandidates(supabase, userId)),
  ]

  const suggestions = candidates.length > 0 ? await pickAndRephrase(candidates) : []

  await supabase.from('daily_suggestions').upsert(
    {
      user_id: userId,
      suggestion_date: getLocalDateString(),
      fingerprint,
      generated_at: new Date().toISOString(),
      suggestions,
    },
    { onConflict: 'user_id' }
  )

  return suggestions
}
