export type RaceType =
  | 'ironman'
  | 'xtri'
  | 'marathon'
  | 'half_marathon'
  | '10k'
  | '5k'
  | 'ultra_run'
  | 'other'

export const RACE_TYPES: { value: RaceType; label: string }[] = [
  { value: 'ironman', label: 'Ironman' },
  { value: 'xtri', label: 'Xtri' },
  { value: 'marathon', label: 'Marathon' },
  { value: 'half_marathon', label: 'Half Marathon' },
  { value: '10k', label: '10K' },
  { value: '5k', label: '5K' },
  { value: 'ultra_run', label: 'Ultra Run' },
  { value: 'other', label: 'Other' },
]

// Display-only, derived from race_type - never stored per-row.
export const RACE_TYPE_DISTANCE: Partial<Record<RaceType, string>> = {
  ironman: '3.8km swim · 180.2km bike · 42.2km run',
  xtri: '3.8km swim · 180.2km bike · 42.2km run',
  marathon: '42.2km',
  half_marathon: '21.1km',
  '10k': '10km',
  '5k': '5km',
}

// Numeric single-discipline distance, for finish-time projection math
// (src/lib/race-plan/finish-time.ts). Deliberately excludes ironman/xtri
// (multi-discipline, no credible single-number projection) and ultra_run
// (too variable a distance to treat as one standard number).
export const RACE_TYPE_DISTANCE_KM: Partial<Record<RaceType, number>> = {
  marathon: 42.2,
  half_marathon: 21.1,
  '10k': 10,
  '5k': 5,
}

export function raceTypeLabel(raceType: string): string {
  return RACE_TYPES.find((t) => t.value === raceType)?.label ?? raceType
}
