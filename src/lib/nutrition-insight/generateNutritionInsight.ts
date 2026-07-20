import { GoogleGenAI } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeCalorieMovingAverage, type CaloriePoint } from '@/lib/nutrition-trend'
import { getEffectiveTarget, type TrainingIntensity, type TrainingPhase } from '@/lib/nutrition'

const MODEL = 'gemini-2.5-flash'
const MIN_ENTRIES = 3
const MIN_FOOD_ITEMS_FOR_QUALITY_READ = 5

export type NutritionInsightResult =
  | { status: 'not_enough_data' }
  | { status: 'ok'; text: string }
  | { status: 'error' }

export async function generateNutritionInsight(
  supabase: SupabaseClient,
  userId: string
): Promise<NutritionInsightResult> {
  const { data: entries } = await supabase
    .from('nutrition_entries')
    .select('id, date, calories, protein_g, fat_g, carbs_g, activity_adjustment_kcal')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (!entries || entries.length < MIN_ENTRIES) {
    return { status: 'not_enough_data' }
  }

  const latestEntry = entries[entries.length - 1]

  // Cache is keyed by the latest entry id + total count, so both new entries
  // and edits/deletes anywhere in the history correctly invalidate it.
  const { data: cached } = await supabase
    .from('nutrition_insight_cache')
    .select('latest_entry_id, entry_count, insight_text')
    .eq('user_id', userId)
    .maybeSingle()

  if (cached && cached.latest_entry_id === latestEntry.id && cached.entry_count === entries.length) {
    return { status: 'ok', text: cached.insight_text }
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('maintenance_calories, training_phase, training_intensity')
    .eq('user_id', userId)
    .maybeSingle()

  const maintenanceCalories: number | null = settings?.maintenance_calories ?? null
  const trainingPhase: TrainingPhase | null = (settings?.training_phase as TrainingPhase) ?? null
  const trainingIntensity: TrainingIntensity | null = (settings?.training_intensity as TrainingIntensity) ?? null

  const points: CaloriePoint[] = entries.map((e) => ({
    date: e.date,
    calories: e.calories,
    targetCalories: getEffectiveTarget(
      maintenanceCalories,
      trainingPhase,
      trainingIntensity,
      e.activity_adjustment_kcal ?? null
    ),
  }))

  const movingAverage = computeCalorieMovingAverage(points)
  const latestAvg = movingAverage[movingAverage.length - 1].averageCalories
  const earliestAvg = movingAverage[0].averageCalories
  const trendDelta = latestAvg - earliestAvg

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set')
    return { status: 'error' }
  }

  const trendDirection = trendDelta > 25 ? 'up' : trendDelta < -25 ? 'down' : 'flat'
  const latestTarget = points[points.length - 1].targetCalories

  const targetLine =
    latestTarget != null
      ? `Effective daily target as of the most recent log: ${Math.round(latestTarget)} kcal. The trend is ${Math.abs(
          Math.round(latestAvg - latestTarget)
        )} kcal ${latestAvg > latestTarget ? 'above' : latestAvg < latestTarget ? 'below' : 'at'} that target.`
      : 'No maintenance calories target is set.'

  const entryIds = entries.map((e) => e.id)

  // Only bring up food quality/variety when there's actually enough optional
  // detail logged to say something real — never inferred from bare macros.
  const { count: foodItemCount } = await supabase
    .from('nutrition_food_items')
    .select('id', { count: 'exact', head: true })
    .in('entry_id', entryIds)

  let foodQualityContext = ''
  if ((foodItemCount ?? 0) >= MIN_FOOD_ITEMS_FOR_QUALITY_READ) {
    const { data: foodItems } = await supabase
      .from('nutrition_food_items')
      .select('name, ingredients')
      .in('entry_id', entryIds)
      .order('logged_at', { ascending: true })
      .limit(30)

    const foodList = (foodItems ?? [])
      .map((item) => (item.ingredients ? `${item.name} (${item.ingredients})` : item.name))
      .join(', ')

    foodQualityContext = `\n\nFood items logged recently: ${foodList}\n\nBriefly and non-judgmentally comment on the variety/whole-food pattern of what's been logged, as a secondary point after the calorie trend — not a diet-shaming assessment, just an observation.`
  }

  const prompt = `You are a supportive nutrition coach describing a calorie trend to someone tracking their intake.

Trend data (based on a 7-day moving average, not raw day-to-day totals):
- Current trend: ${Math.round(latestAvg)} kcal/day
- Since the start of this data, the trend has moved ${Math.abs(Math.round(trendDelta))} kcal/day ${trendDirection}
- ${targetLine}${foodQualityContext}

Write 1-2 short, plain-language sentences: first describing the calorie trend versus target, then (only if food items were provided above) a brief non-judgmental note on variety. Do not invent numbers or mention raw daily fluctuations — only reference the trend/target given above.`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    })

    const text = response.text?.trim()
    if (!text) throw new Error('Empty model response')

    await supabase.from('nutrition_insight_cache').upsert(
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
    console.error('Nutrition insight generation failed:', err)
    return { status: 'error' }
  }
}
