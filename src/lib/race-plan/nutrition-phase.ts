import { getEffectiveTarget, getPhaseAdjustmentKcal, type TrainingPhase as NutritionPhase, type TrainingIntensity as NutritionIntensity } from '@/lib/nutrition'
import type { TrainingPhase as RacePhase } from '@/lib/race-plan/periodization'

// Static per-race-phase note, same shape/precedent as PHASE_FALLBACK_NOTES
// (race-plan/route.ts) and STRENGTH_SEQUENCING_NOTES (periodization.ts).
export const PHASE_NUTRITION_GUIDANCE: Record<RacePhase, string> = {
  base: 'Foundation volume - no special nutrition adjustment beyond whatever bulk/cut/maintain is already set.',
  build: 'Volume is ramping across the board - watch for an unplanned deficit creeping in as training load rises.',
  peak: 'Highest volume of the cycle - carbohydrate availability around long/brick sessions matters most. An aggressive cut is the highest-risk combination here.',
  taper: 'Volume drops sharply - calories tuned for peak load likely now run a surplus unless deliberately pulled back.',
}

// Only flags the clearest, most defensible mismatch (mirrors
// computeTensionFlags' "clearest mismatches only" precedent) - an
// active calorie deficit during the two highest-load training phases.
// Never writes to user_settings; a read-only comparison, and reuses
// getEffectiveTarget/getPhaseAdjustmentKcal rather than duplicating the
// kcal math.
export function assessNutritionPhaseTension(
  racePhase: RacePhase,
  nutritionPhase: NutritionPhase | null,
  nutritionIntensity: NutritionIntensity | null,
  maintenanceCalories: number | null
): string | null {
  if (nutritionPhase !== 'cut') return null
  if (racePhase !== 'peak' && !(racePhase === 'build' && nutritionIntensity === 'aggressive')) return null

  const effective = getEffectiveTarget(maintenanceCalories, nutritionPhase, nutritionIntensity, null)
  const deficitNote =
    effective != null
      ? ` At your current settings, that's an effective target of ~${effective}kcal/day (${getPhaseAdjustmentKcal(nutritionPhase, nutritionIntensity)}kcal/day vs. maintenance).`
      : ''

  const phaseLabel = racePhase === 'peak' ? 'Peak' : 'Build'
  return `You're in the ${phaseLabel} phase of this race's training - your highest training load - but nutrition is set to Cut/${nutritionIntensity ?? 'mild'}.${deficitNote} Worth reconsidering under Nutrition settings until after the race.`
}
