import { GoogleGenAI } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeMuscleVolume, type MuscleVolume } from '@/lib/volume-analysis'
import { fetchScheduleSlots, slotDisplayName } from '@/lib/gym-schedule'

const MODEL = 'gemini-2.5-flash'

export type VolumeInsightResult =
  | { status: 'not_enough_data' }
  | { status: 'ok'; volumes: MuscleVolume[]; text: string | null }
  | { status: 'error' }

export async function generateVolumeInsight(supabase: SupabaseClient, userId: string): Promise<VolumeInsightResult> {
  const volumes = await computeMuscleVolume(supabase)
  if (volumes.length === 0) {
    return { status: 'not_enough_data' }
  }

  const underTrained = volumes.filter((v) => v.status === 'under')
  const overTrained = volumes.filter((v) => v.status === 'over')

  // The deterministic numbers are the whole point and stand on their own -
  // only bother with an AI sentence when there's actually something
  // notable to say, same gating discipline as the nutrition insight's
  // variety/meal-timing reads.
  if (underTrained.length === 0 && overTrained.length === 0) {
    return { status: 'ok', volumes, text: null }
  }

  const slots = await fetchScheduleSlots(supabase, userId)

  // Fingerprint covers both the volume facts themselves and the schedule's
  // composition, so editing the rotation (not just logging a new set)
  // correctly invalidates the cached sentence.
  const volumeFingerprint = volumes.map((v) => `${v.muscle}:${v.sets}`).join('|')
  const scheduleFingerprint = slots.map((s) => `${s.id}:${slotDisplayName(s)}`).join('|')
  const fingerprint = `${volumeFingerprint}::${scheduleFingerprint}`

  const { data: cached } = await supabase
    .from('schedule_volume_insight_cache')
    .select('fingerprint, insight_text')
    .eq('user_id', userId)
    .maybeSingle()

  if (cached && cached.fingerprint === fingerprint) {
    return { status: 'ok', volumes, text: cached.insight_text }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    // The deterministic bars are still useful without the AI sentence.
    return { status: 'ok', volumes, text: null }
  }

  const facts: string[] = []
  if (underTrained.length > 0) {
    facts.push(
      `Under the ~10-20 sets/week guideline: ${underTrained.map((v) => `${v.muscle} (${v.sets} sets)`).join(', ')}.`
    )
  }
  if (overTrained.length > 0) {
    facts.push(`Above the guideline: ${overTrained.map((v) => `${v.muscle} (${v.sets} sets)`).join(', ')}.`)
  }

  const prompt = `You are a supportive strength-training coach summarizing this week's training volume per muscle group.

Facts (rolling 7-day completed sets per muscle, compared to a standard ~10-20 working sets/week guideline):
${facts.join('\n')}

Write exactly ONE short, plain-language, non-judgmental sentence highlighting the most notable pattern. Do not invent numbers or muscles — only reference the facts given above.`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({ model: MODEL, contents: prompt })

    const text = response.text?.trim()
    if (!text) throw new Error('Empty model response')

    await supabase.from('schedule_volume_insight_cache').upsert(
      {
        user_id: userId,
        fingerprint,
        insight_text: text,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    return { status: 'ok', volumes, text }
  } catch (err) {
    console.error('Volume insight generation failed:', err)
    return { status: 'ok', volumes, text: null }
  }
}
