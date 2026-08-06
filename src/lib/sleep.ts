export type TemperatureUnit = 'c' | 'f'

// sleep_entries.room_temp_c is always stored in Celsius — temperature_unit
// only controls conversion for display and input, never what's persisted,
// same "one canonical unit, converted for display" rule as weight.ts.

export function celsiusToDisplay(celsius: number, unit: TemperatureUnit): number {
  return unit === 'f' ? celsius * (9 / 5) + 32 : celsius
}

export function displayToCelsius(value: number, unit: TemperatureUnit): number {
  return unit === 'f' ? (value - 32) * (5 / 9) : value
}

export function formatTemperature(celsius: number, unit: TemperatureUnit, fractionDigits = 1): string {
  return celsiusToDisplay(celsius, unit).toFixed(fractionDigits)
}

// Sleep Foundation / Cleveland Clinic / NSF consensus range, cited
// directly rather than invented - see generateSleepInsight.ts for how
// it's used in the AI comparison.
export const OPTIMAL_ROOM_TEMP_C = { min: 15.5, max: 19.4 }

// National Sleep Foundation / AASM / CDC consensus for adults - a range,
// not a single "8 hours" target.
export const RECOMMENDED_SLEEP_HOURS = { min: 7, max: 9 }
