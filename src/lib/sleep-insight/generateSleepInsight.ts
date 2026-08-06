import { GoogleGenAI } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeSleepMovingAverage } from '@/lib/sleep-trend'
import { celsiusToDisplay, OPTIMAL_ROOM_TEMP_C, RECOMMENDED_SLEEP_HOURS, type TemperatureUnit } from '@/lib/sleep'

const MODEL = 'gemini-2.5-flash'
const MIN_ENTRIES = 3

export type SleepInsightResult =
  | { status: 'not_enough_data' }
  | { status: 'ok'; text: string }
  | { status: 'error' }

export async function generateSleepInsight(supabase: SupabaseClient, userId: string): Promise<SleepInsightResult> {
  const { data: entries } = await supabase
    .from('sleep_entries')
    .select('id, date, hours_slept, room_temp_c')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (!entries || entries.length < MIN_ENTRIES) {
    return { status: 'not_enough_data' }
  }

  const latestEntry = entries[entries.length - 1]

  // Same cache-invalidation shape as weight: keyed by the latest
  // contributing entry id + total count.
  const { data: cached } = await supabase
    .from('sleep_insight_cache')
    .select('latest_entry_id, entry_count, insight_text')
    .eq('user_id', userId)
    .maybeSingle()

  if (cached && cached.latest_entry_id === latestEntry.id && cached.entry_count === entries.length) {
    return { status: 'ok', text: cached.insight_text }
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('temperature_unit')
    .eq('user_id', userId)
    .maybeSingle()

  const unit: TemperatureUnit = settings?.temperature_unit === 'f' ? 'f' : 'c'

  const movingAverage = computeSleepMovingAverage(
    entries.map((e: any) => ({
      hoursSlept: typeof e.hours_slept === 'string' ? parseFloat(e.hours_slept) : e.hours_slept,
      date: e.date,
    }))
  )
  const latestAvgHours = movingAverage[movingAverage.length - 1].averageHours

  const loggedTemps = entries
    .map((e: any) => (e.room_temp_c != null ? (typeof e.room_temp_c === 'string' ? parseFloat(e.room_temp_c) : e.room_temp_c) : null))
    .filter((t: number | null): t is number => t != null)
  const avgTempC = loggedTemps.length > 0 ? loggedTemps.reduce((sum: number, t: number) => sum + t, 0) / loggedTemps.length : null

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return { status: 'error' }
  }

  // Pre-format every number and pre-state both cited ranges - the model
  // only writes the sentence, it never does unit conversion, arithmetic,
  // or invents a threshold of its own.
  const unitLabel = unit === 'f' ? '°F' : '°C'
  const recommendedHoursLine = `Recommended sleep duration for adults: ${RECOMMENDED_SLEEP_HOURS.min}-${RECOMMENDED_SLEEP_HOURS.max} hours/night (National Sleep Foundation / AASM consensus).`
  const durationLine = `Current 7-day trend: ${latestAvgHours.toFixed(1)} hours/night.`

  const optimalTempDisplay = `${celsiusToDisplay(OPTIMAL_ROOM_TEMP_C.min, unit).toFixed(1)}-${celsiusToDisplay(OPTIMAL_ROOM_TEMP_C.max, unit).toFixed(1)}${unitLabel}`
  const tempLine =
    avgTempC != null
      ? `Average logged bedroom temperature: ${celsiusToDisplay(avgTempC, unit).toFixed(1)}${unitLabel}. Cited optimal range: ${optimalTempDisplay}.`
      : 'No bedroom temperature has been logged, so no comparison is possible for that.'

  const prompt = `You are a supportive sleep coach describing sleep data to someone tracking hours slept and bedroom temperature.

${durationLine}
${recommendedHoursLine}
${tempLine}

Write one or two short, plain-language, encouraging sentences comparing the logged data to the cited guidance above. Do not invent numbers, thresholds, or ranges beyond what's given here - only reference the figures above.`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    })

    const text = response.text?.trim()
    if (!text) throw new Error('Empty model response')

    await supabase.from('sleep_insight_cache').upsert(
      {
        user_id: userId,
        latest_entry_id: latestEntry.id,
        entry_count: entries.length,
        insight_text: text,
      },
      { onConflict: 'user_id' }
    )

    return { status: 'ok', text }
  } catch (err) {
    console.error('Sleep insight generation failed:', err)
    return { status: 'error' }
  }
}
