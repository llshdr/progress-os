import type { Discipline } from '@/lib/race-plan/self-assessment'

// Sport-appropriate units, not one unit forced onto all three - run pace,
// swim pace, and bike speed are conventionally different kinds of
// numbers to a real athlete. Everything converts through sec/km
// internally, the same unit CardioActivity/averagePace already use
// (cardio-stats.ts), so self-reported pace and logged-activity pace can
// be compared/pre-filled without a second conversion layer.
export type PaceUnit = 'min_per_km' | 'min_per_100m' | 'km_per_h'

export const DISCIPLINE_PACE_UNIT: Record<Discipline, PaceUnit> = {
  run: 'min_per_km',
  swim: 'min_per_100m',
  bike: 'km_per_h',
}

export function toSecPerKm(value: number, unit: PaceUnit): number {
  if (unit === 'min_per_km') return value * 60
  if (unit === 'min_per_100m') return value * 60 * 10
  return 3600 / value // km_per_h -> sec/km
}

export function fromSecPerKm(secPerKm: number, unit: PaceUnit): number {
  if (unit === 'min_per_km') return secPerKm / 60
  if (unit === 'min_per_100m') return secPerKm / 60 / 10
  return 3600 / secPerKm // sec/km -> km_per_h
}

export function formatPaceForDiscipline(secPerKm: number, discipline: Discipline): string {
  const unit = DISCIPLINE_PACE_UNIT[discipline]
  if (unit === 'km_per_h') return `${fromSecPerKm(secPerKm, unit).toFixed(1)} km/h`

  const minutes = fromSecPerKm(secPerKm, unit)
  const wholeMinutes = Math.floor(minutes)
  const seconds = Math.round((minutes - wholeMinutes) * 60)
  return `${wholeMinutes}:${String(seconds).padStart(2, '0')} /${unit === 'min_per_100m' ? '100m' : 'km'}`
}
