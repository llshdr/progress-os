export type RaceType =
  | 'ironman'
  | 'norseman'
  | 'swedeman'
  | 'marathon'
  | 'half_marathon'
  | '10k'
  | '5k'
  | 'ultra_run'
  | 'other'

export const RACE_TYPES: { value: RaceType; label: string }[] = [
  { value: 'ironman', label: 'Ironman' },
  { value: 'norseman', label: 'Norseman' },
  { value: 'swedeman', label: 'Swedeman' },
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
  norseman: '3.8km swim · 180.2km bike · 42.2km run',
  swedeman: '3.8km swim · 180.2km bike · 42.2km run',
  marathon: '42.2km',
  half_marathon: '21.1km',
  '10k': '10km',
  '5k': '5km',
}

export function raceTypeLabel(raceType: string): string {
  return RACE_TYPES.find((t) => t.value === raceType)?.label ?? raceType
}
