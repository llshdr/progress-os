import { GoogleGenAI } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeCalorieMovingAverage, type CaloriePoint } from '@/lib/nutrition-trend'
import { getEffectiveTarget, type TrainingIntensity, type TrainingPhase } from '@/lib/nutrition'
import { MEAL_TAGS, mealTagLabel } from '@/lib/food-constants'

const MODEL = 'gemini-2.5-flash'
const MIN_ENTRIES = 3
const MIN_FOOD_ITEMS_FOR_QUALITY_READ = 5
// Matches the existing variety gate - meal-timing is only worth mentioning
// once there's enough tagged data for a pattern to actually mean something.
const MIN_TAGGED_ITEMS_FOR_TIMING_READ = 5

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

  const { data: settings } = await supabase
    .from('user_settings')
    .select('maintenance_calories, training_phase, training_intensity')
    .eq('user_id', userId)
    .maybeSingle()

  const maintenanceCalories: number | null = settings?.maintenance_calories ?? null
  const trainingPhase: TrainingPhase | null = (settings?.training_phase as TrainingPhase) ?? null
  const trainingIntensity: TrainingIntensity | null = (settings?.training_intensity as TrainingIntensity) ?? null

  // A settings change (maintenance calories, training phase/intensity)
  // changes the target the trend is compared against, so it has to
  // invalidate the cache alongside the entry id/count below.
  const settingsFingerprint = `${maintenanceCalories ?? 'null'}|${trainingPhase ?? 'null'}|${trainingIntensity ?? 'null'}`

  // Cache is keyed by the latest entry id + total count, so both new entries
  // and edits/deletes anywhere in the history correctly invalidate it.
  const { data: cached } = await supabase
    .from('nutrition_insight_cache')
    .select('latest_entry_id, entry_count, settings_fingerprint, insight_text')
    .eq('user_id', userId)
    .maybeSingle()

  if (
    cached &&
    cached.latest_entry_id === latestEntry.id &&
    cached.entry_count === entries.length &&
    cached.settings_fingerprint === settingsFingerprint
  ) {
    return { status: 'ok', text: cached.insight_text }
  }

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
  let hasVarietySignal = false
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

    foodQualityContext = `\n\nFood items logged recently: ${foodList}`
    hasVarietySignal = true
  }

  // Only bring up meal timing when there's enough tagged data for the
  // pattern to mean something - same threshold discipline as variety above.
  const { count: taggedItemCount } = await supabase
    .from('nutrition_food_items')
    .select('id', { count: 'exact', head: true })
    .in('entry_id', entryIds)
    .not('meal_tag', 'is', null)

  let mealTimingContext = ''
  let hasMealTimingSignal = false
  if ((taggedItemCount ?? 0) >= MIN_TAGGED_ITEMS_FOR_TIMING_READ) {
    const { data: taggedItems } = await supabase
      .from('nutrition_food_items')
      .select('meal_tag')
      .in('entry_id', entryIds)
      .not('meal_tag', 'is', null)

    const counts: Record<string, number> = {}
    for (const tag of MEAL_TAGS) counts[tag.value] = 0
    for (const item of taggedItems ?? []) {
      if (item.meal_tag && item.meal_tag in counts) counts[item.meal_tag]++
    }

    // All computed deterministically in code - the model only ever sees the
    // finished facts below, never a raw table to draw its own conclusions from.
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const mostFrequentTag =
      sorted[0][1] > 0 && sorted[0][1] > sorted[1][1] ? mealTagLabel(sorted[0][0]) : null
    const skippedTags = Object.entries(counts)
      .filter(([, count]) => count === 0)
      .map(([tag]) => mealTagLabel(tag))

    const facts: string[] = []
    if (mostFrequentTag) facts.push(`most items logged were tagged "${mostFrequentTag}"`)
    if (skippedTags.length > 0) facts.push(`no items were tagged as: ${skippedTags.join(', ')}`)

    if (facts.length > 0) {
      mealTimingContext = `\n\nMeal-timing pattern: ${facts.join('; ')}.`
      hasMealTimingSignal = true
    }
  }

  const secondarySignals: string[] = []
  if (hasVarietySignal) secondarySignals.push('the variety/whole-food pattern of what has been logged')
  if (hasMealTimingSignal) secondarySignals.push('the meal-timing pattern described above')

  const secondaryInstruction =
    secondarySignals.length > 0
      ? ` Then write exactly ONE additional sentence combining ${secondarySignals.join(
          ' and '
        )} into a single observation — never one sentence per signal, always combined, brief and non-judgmental.`
      : ''

  const prompt = `You are a supportive nutrition coach describing a calorie trend to someone tracking their intake.

Trend data (based on a 7-day moving average, not raw day-to-day totals):
- Current trend: ${Math.round(latestAvg)} kcal/day
- Since the start of this data, the trend has moved ${Math.abs(Math.round(trendDelta))} kcal/day ${trendDirection}
- ${targetLine}${foodQualityContext}${mealTimingContext}

Write 1-2 short, plain-language sentences total: first describing the calorie trend versus target.${secondaryInstruction} Do not invent numbers or mention raw daily fluctuations — only reference the facts given above.`

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
        settings_fingerprint: settingsFingerprint,
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
