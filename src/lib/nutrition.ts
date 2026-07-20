export type TrainingPhase = 'bulk' | 'cut' | 'maintain'
export type TrainingIntensity = 'mild' | 'aggressive'

// Standard, widely-cited nutrition-coaching ranges (not invented numbers) -
// roughly 3500 kcal ≈ 1 lb, so these map to about 0.5 lb/week (mild) vs.
// ~1 lb/week (aggressive) rate of change. Maintain applies no adjustment
// regardless of intensity.
const PHASE_ADJUSTMENT_KCAL: Record<TrainingPhase, Record<TrainingIntensity, number>> = {
  bulk: { mild: 275, aggressive: 600 },
  cut: { mild: -275, aggressive: -600 },
  maintain: { mild: 0, aggressive: 0 },
}

export function getPhaseAdjustmentKcal(phase: TrainingPhase | null, intensity: TrainingIntensity | null): number {
  if (!phase) return 0
  return PHASE_ADJUSTMENT_KCAL[phase][intensity ?? 'mild']
}

// Today's effective calorie target: baseline maintenance, adjusted for the
// user's training phase/intensity, plus whatever extra activity (if any) was
// logged for the day.
export function getEffectiveTarget(
  maintenanceCalories: number | null,
  phase: TrainingPhase | null,
  intensity: TrainingIntensity | null,
  activityAdjustmentKcal: number | null
): number | null {
  if (maintenanceCalories == null) return null
  return maintenanceCalories + getPhaseAdjustmentKcal(phase, intensity) + (activityAdjustmentKcal ?? 0)
}
