import type { SupabaseClient } from '@supabase/supabase-js'
import type { SuggestionCandidate } from './types'
import { getLocalDateString } from '@/lib/date'
import { getEffectiveTarget, type TrainingIntensity, type TrainingPhase } from '@/lib/nutrition'

const LATE_DAY_HOUR = 18 // after 6pm, the day is mostly over
const NOTABLE_DEVIATION_RATIO = 0.15 // >15% away from target counts as "notably" over/under

// Deterministic, real (non-hallucinated) candidate suggestions for the
// nutrition module. Two signals only: whether today has been logged at all,
// and whether today's logged intake is notably over/under the effective
// target - the same "did you do the thing today, and how's it going"
// questions gym already asks, applied to nutrition. These are mutually
// exclusive (the deviation check only runs once an entry exists), so at
// most one candidate fires per call.
export async function getNutritionSuggestionCandidates(
  supabase: SupabaseClient,
  userId: string
): Promise<SuggestionCandidate[]> {
  const today = getLocalDateString()
  const isLateInDay = new Date().getHours() >= LATE_DAY_HOUR

  const { data: entry } = await supabase
    .from('nutrition_entries')
    .select('calories, activity_adjustment_kcal')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  if (!entry) {
    if (!isLateInDay) return []
    return [
      {
        module: 'nutrition',
        text: "No nutrition logged today yet.",
        action: { label: 'Log today', href: '/nutrition' },
      },
    ]
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('maintenance_calories, training_phase, training_intensity')
    .eq('user_id', userId)
    .maybeSingle()

  const maintenanceCalories: number | null = settings?.maintenance_calories ?? null
  const trainingPhase: TrainingPhase | null = (settings?.training_phase as TrainingPhase) ?? null
  const trainingIntensity: TrainingIntensity | null = (settings?.training_intensity as TrainingIntensity) ?? null

  const target = getEffectiveTarget(
    maintenanceCalories,
    trainingPhase,
    trainingIntensity,
    entry.activity_adjustment_kcal ?? null
  )
  if (target == null) return []

  const deviation = (entry.calories - target) / target

  // Over target is worth flagging any time of day - under target is only
  // notable once most of the day has already happened, otherwise every
  // partial day looks "under" and the nudge is just noise.
  if (deviation > NOTABLE_DEVIATION_RATIO) {
    return [
      {
        module: 'nutrition',
        text: `You're at ${entry.calories} kcal today, ${Math.round(deviation * 100)}% over your ${target} kcal target.`,
        action: { label: 'View nutrition', href: '/nutrition' },
      },
    ]
  }

  if (deviation < -NOTABLE_DEVIATION_RATIO && isLateInDay) {
    return [
      {
        module: 'nutrition',
        text: `You're at ${entry.calories} kcal today, ${Math.round(Math.abs(deviation) * 100)}% under your ${target} kcal target.`,
        action: { label: 'View nutrition', href: '/nutrition' },
      },
    ]
  }

  return []
}
