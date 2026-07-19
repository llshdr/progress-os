export type WeightUnit = 'kg' | 'lbs'

const KG_TO_LB = 2.20462

// weight_entries.weight and user_settings.goal_weight are always stored in kg.
// weight_unit only controls conversion for display and input — never what's
// persisted — so switching units later never corrupts existing data.

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lbs' ? kg * KG_TO_LB : kg
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'lbs' ? value / KG_TO_LB : value
}

export function formatWeight(kg: number, unit: WeightUnit, fractionDigits = 1): string {
  return kgToDisplay(kg, unit).toFixed(fractionDigits)
}
