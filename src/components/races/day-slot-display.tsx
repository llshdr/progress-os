import { Waves, Bike, Footprints, Dumbbell, type LucideIcon } from 'lucide-react'
import type { EnduranceSlotType, SlotRole } from '@/lib/race-plan/day-template'

// Shared, presentational-only metadata - imported by both the read-only
// per-week day list and the phase-level edit dialog so the two never
// drift into different visual languages for the same underlying data.
export const SLOT_TYPE_ICON: Record<EnduranceSlotType, LucideIcon> = {
  swim: Waves,
  bike: Bike,
  run: Footprints,
  cardio: Footprints,
}

export const STRENGTH_ICON: LucideIcon = Dumbbell

export const TYPE_LABEL: Record<EnduranceSlotType, string> = {
  swim: 'Swim',
  bike: 'Bike',
  run: 'Run',
  cardio: 'Cardio',
}

export const ROLE_LABEL: Record<SlotRole, string> = {
  key: 'Key',
  easy: 'Easy',
  technique: 'Technique',
  threshold: 'Threshold',
  vo2max: 'VO2max',
}

export function formatSlotKm(km: number): string {
  return `${Math.round(km * 10) / 10}km`
}

export const DAY_ABBREVIATIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
