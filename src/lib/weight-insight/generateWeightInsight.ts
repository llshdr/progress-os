import { GoogleGenAI } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeMovingAverage } from '@/lib/weight-trend'
import { kgToDisplay, type WeightUnit } from '@/lib/weight'

const MODEL = 'gemini-2.5-flash'
const MIN_ENTRIES = 3

export type WeightInsightResult =
  | { status: 'not_enough_data' }
  | { status: 'ok'; text: string }
  | { status: 'error' }

export async function generateWeightInsight(
  supabase: SupabaseClient,
  userId: string
): Promise<WeightInsightResult> {
  const { data: entries } = await supabase
    .from('weight_entries')
    .select('id, weight, recorded_at')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: true })

  if (!entries || entries.length < MIN_ENTRIES) {
    return { status: 'not_enough_data' }
  }

  const latestEntry = entries[entries.length - 1]

  // Cache is keyed by the latest entry id + total count, so both new entries
  // and edits/deletes anywhere in the history correctly invalidate it.
  const { data: cached } = await supabase
    .from('weight_insight_cache')
    .select('latest_entry_id, entry_count, insight_text')
    .eq('user_id', userId)
    .maybeSingle()

  if (cached && cached.latest_entry_id === latestEntry.id && cached.entry_count === entries.length) {
    return { status: 'ok', text: cached.insight_text }
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('weight_unit, goal_weight')
    .eq('user_id', userId)
    .maybeSingle()

  const unit: WeightUnit = settings?.weight_unit === 'lbs' ? 'lbs' : 'kg'
  const goalWeightKg: number | null = settings?.goal_weight ?? null

  const movingAverage = computeMovingAverage(
    entries.map((e) => ({
      weight: typeof e.weight === 'string' ? parseFloat(e.weight) : e.weight,
      recordedAt: e.recorded_at,
    }))
  )

  const latestAvgKg = movingAverage[movingAverage.length - 1].averageKg
  const earliestAvgKg = movingAverage[0].averageKg
  const trendDeltaKg = latestAvgKg - earliestAvgKg

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return { status: 'error' }
  }

  // Pre-format every number in the user's unit — the model only writes the
  // sentence, it never does unit conversion or arithmetic itself.
  const latestAvgDisplay = kgToDisplay(latestAvgKg, unit).toFixed(1)
  const trendDeltaDisplay = Math.abs(kgToDisplay(trendDeltaKg, unit)).toFixed(1)
  const trendDirection = trendDeltaKg > 0.05 ? 'up' : trendDeltaKg < -0.05 ? 'down' : 'flat'

  const goalLine = goalWeightKg
    ? (() => {
        const distanceKg = latestAvgKg - goalWeightKg
        const distanceDisplay = Math.abs(kgToDisplay(distanceKg, unit)).toFixed(1)
        const direction = distanceKg > 0 ? 'above' : distanceKg < 0 ? 'below' : 'at'
        return `Goal weight: ${kgToDisplay(goalWeightKg, unit).toFixed(1)} ${unit}. The current trend is ${distanceDisplay} ${unit} ${direction} goal.`
      })()
    : 'No goal weight is set.'

  const prompt = `You are a supportive fitness coach describing a weight trend to someone tracking their weight.

Trend data (based on a 7-day moving average, not raw day-to-day weigh-ins):
- Current trend: ${latestAvgDisplay} ${unit}
- Since the start of this data, the trend has moved ${trendDeltaDisplay} ${unit} ${trendDirection}
- ${goalLine}

Write one short, encouraging, plain-language sentence describing the trend. Do not invent numbers or mention raw daily fluctuations — only reference the trend and goal distance given above.`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    })

    const text = response.text?.trim()
    if (!text) throw new Error('Empty model response')

    await supabase.from('weight_insight_cache').upsert(
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
    console.error('Weight insight generation failed:', err)
    return { status: 'error' }
  }
}
