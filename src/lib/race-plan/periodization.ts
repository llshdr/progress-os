import { getLocalWeekStart, getLocalDateString } from '@/lib/date'

export type RaceApproach = 'full_send' | 'balanced'
export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper'

export interface TrainingWeekSkeleton {
  weekStartDate: string
  phase: TrainingPhase
  targetCardioKm: number
  targetCardioSessions: number
  targetStrengthSessions: number
}

interface PhaseAllocation {
  base: number
  build: number
  peak: number
  taper: number
}

// Simple, explicitly-not-real-sports-science phase split. Always sums to
// totalWeeks exactly and never goes negative, including very short
// runways (a 1-2 week "plan" is basically all taper/rest).
function allocatePhases(totalWeeks: number): PhaseAllocation {
  if (totalWeeks <= 2) {
    return { base: 0, build: 0, peak: 0, taper: totalWeeks }
  }
  if (totalWeeks <= 4) {
    const taper = 1
    const peak = 1
    const build = totalWeeks - taper - peak
    return { base: 0, build, peak, taper }
  }

  const taper = totalWeeks <= 8 ? 1 : 2
  const afterTaper = totalWeeks - taper
  const peak = Math.max(1, Math.round(afterTaper * 0.2))
  const afterPeak = afterTaper - peak
  const build = Math.max(1, Math.round(afterPeak * 0.4))
  const base = Math.max(0, afterPeak - build)

  return { base, build, peak, taper }
}

// The race week itself is always the last taper week - always meaningfully
// cut back from peak, never a fresh volume push right before the race.
const TAPER_FRACTIONS: Record<number, number[]> = {
  1: [0.4],
  2: [0.6, 0.35],
}

function taperFraction(taperWeeks: number, indexWithinTaper: number): number {
  const fractions = TAPER_FRACTIONS[taperWeeks]
  if (fractions) return fractions[indexWithinTaper] ?? fractions[fractions.length - 1]
  // Fallback for an unexpectedly long taper (shouldn't happen given
  // allocatePhases above, but keep this safe rather than throwing).
  const t = taperWeeks <= 1 ? 0 : indexWithinTaper / (taperWeeks - 1)
  return 0.7 - t * 0.4
}

function strengthSessionsForWeek(phase: TrainingPhase, approach: RaceApproach, currentStrengthSessionsPerWeek: number): number {
  // Never invent a strength habit the user doesn't already have.
  if (currentStrengthSessionsPerWeek <= 0) return 0

  const baseline = Math.max(1, Math.round(currentStrengthSessionsPerWeek))
  const windingDown = phase === 'peak' || phase === 'taper'

  if (approach === 'full_send') {
    // Deliberately deprioritized: maintenance-only, capped low, cut further
    // right before the race so cardio recovery isn't compromised.
    return windingDown ? 1 : Math.min(2, baseline)
  }

  // Balanced: hold close to the user's current baseline throughout, only a
  // small step down late to protect race-week freshness.
  return windingDown ? Math.max(1, baseline - 1) : baseline
}

// All date/phase/number arithmetic lives here, never in the AI prompt -
// the model only ever writes the per-week focus_note and overview text on
// top of these already-decided numbers (see race-plan/route.ts).
export function computeTrainingWeeks(
  raceDate: string,
  approach: RaceApproach,
  currentWeeklyCardioKm: number,
  currentCardioSessionsPerWeek: number,
  currentStrengthSessionsPerWeek: number
): TrainingWeekSkeleton[] {
  const startMonday = getLocalWeekStart()
  const raceMonday = getLocalWeekStart(new Date(raceDate + 'T00:00:00'))
  const diffWeeks = Math.round((raceMonday.getTime() - startMonday.getTime()) / (7 * 86400000))
  const totalWeeks = Math.max(1, diffWeeks + 1)

  const allocation = allocatePhases(totalWeeks)
  const phases: TrainingPhase[] = [
    ...Array(allocation.base).fill('base' as const),
    ...Array(allocation.build).fill('build' as const),
    ...Array(allocation.peak).fill('peak' as const),
    ...Array(allocation.taper).fill('taper' as const),
  ]

  // Floors avoid multiplying a zero baseline into a permanently-zero ramp
  // for someone with little/no logged cardio history yet.
  const cardioBaseline = Math.max(currentWeeklyCardioKm, 5)
  const peakMultiplier = approach === 'full_send' ? 1.8 : 1.25
  const peakTargetKm = cardioBaseline * peakMultiplier
  const rampWeeks = allocation.base + allocation.build
  const sessionsBaseline = Math.max(currentCardioSessionsPerWeek, 2)

  let taperIndex = 0

  return phases.map((phase, i) => {
    const weekStart = new Date(startMonday)
    weekStart.setDate(weekStart.getDate() + i * 7)
    const weekStartDate = getLocalDateString(weekStart)

    let targetCardioKm: number
    if (phase === 'base' || phase === 'build') {
      // i is 0-based across ALL phases, but base+build always occupy the
      // first rampWeeks slots, so (i+1)/rampWeeks is exactly this week's
      // position within the ramp.
      targetCardioKm = cardioBaseline + (peakTargetKm - cardioBaseline) * ((i + 1) / Math.max(rampWeeks, 1))
    } else if (phase === 'peak') {
      targetCardioKm = peakTargetKm
    } else {
      targetCardioKm = peakTargetKm * taperFraction(allocation.taper, taperIndex)
      taperIndex += 1
    }
    targetCardioKm = Math.round(targetCardioKm * 10) / 10

    const targetCardioSessions = Math.min(7, Math.max(2, Math.round(sessionsBaseline * (targetCardioKm / cardioBaseline))))
    const targetStrengthSessions = strengthSessionsForWeek(phase, approach, currentStrengthSessionsPerWeek)

    return { weekStartDate, phase, targetCardioKm, targetCardioSessions, targetStrengthSessions }
  })
}
