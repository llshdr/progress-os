import { getLocalWeekStart, getLocalDateString } from '@/lib/date'

// Ordered race-focused -> muscle-focused, so a slider can index directly
// into this array (0..4) rather than needing a separate mapping table.
export const RACE_APPROACHES = ['race_focused', 'race_leaning', 'balanced', 'muscle_leaning', 'muscle_focused'] as const
export type RaceApproach = (typeof RACE_APPROACHES)[number]

export const RACE_APPROACH_LABELS: Record<RaceApproach, string> = {
  race_focused: 'Race-Focused',
  race_leaning: 'Race-Leaning',
  balanced: 'Balanced',
  muscle_leaning: 'Muscle-Leaning',
  muscle_focused: 'Muscle-Focused',
}

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

// One preset per spectrum stop, replacing what used to be a two-branch
// if/else. race_focused/balanced match the old full_send/balanced numbers
// exactly - this is a superset, not a behavior change for those two.
// peakMultiplier drives the cardio ramp target (see computeTrainingWeeks);
// the two strength functions take the user's current weekly baseline and
// return a target for "steady" (base/build) vs. "winding down" (peak/
// taper) weeks.
interface ApproachPreset {
  peakMultiplier: number
  strengthSteadySessions: (baseline: number) => number
  strengthWindingDownSessions: (baseline: number) => number
}

const APPROACH_PRESETS: Record<RaceApproach, ApproachPreset> = {
  race_focused: {
    peakMultiplier: 1.9,
    strengthSteadySessions: (b) => Math.min(2, b),
    strengthWindingDownSessions: () => 1,
  },
  race_leaning: {
    peakMultiplier: 1.55,
    strengthSteadySessions: (b) => Math.min(3, b),
    strengthWindingDownSessions: () => 1,
  },
  balanced: {
    peakMultiplier: 1.25,
    strengthSteadySessions: (b) => b,
    strengthWindingDownSessions: (b) => Math.max(1, b - 1),
  },
  muscle_leaning: {
    peakMultiplier: 1.1,
    strengthSteadySessions: (b) => b,
    strengthWindingDownSessions: (b) => Math.max(1, b - 1),
  },
  muscle_focused: {
    peakMultiplier: 1.0,
    strengthSteadySessions: (b) => b,
    strengthWindingDownSessions: (b) => b,
  },
}

function strengthSessionsForWeek(phase: TrainingPhase, approach: RaceApproach, currentStrengthSessionsPerWeek: number): number {
  // Never invent a strength habit the user doesn't already have.
  if (currentStrengthSessionsPerWeek <= 0) return 0

  const baseline = Math.max(1, Math.round(currentStrengthSessionsPerWeek))
  const windingDown = phase === 'peak' || phase === 'taper'
  const preset = APPROACH_PRESETS[approach]

  return windingDown ? preset.strengthWindingDownSessions(baseline) : preset.strengthSteadySessions(baseline)
}

// Cheap, pure preview for the client's live spectrum slider - no race date
// needed, just today's baseline numbers. Mirrors the "steady" (base/build)
// shape of computeTrainingWeeks below without needing a full skeleton.
export function previewApproachEffect(
  approach: RaceApproach,
  currentWeeklyCardioKm: number,
  currentStrengthSessionsPerWeek: number
): { previewPeakCardioKm: number; previewSteadyStrengthSessions: number } {
  const cardioBaseline = Math.max(currentWeeklyCardioKm, 5)
  const preset = APPROACH_PRESETS[approach]
  return {
    previewPeakCardioKm: Math.round(cardioBaseline * preset.peakMultiplier * 10) / 10,
    previewSteadyStrengthSessions: strengthSessionsForWeek('build', approach, currentStrengthSessionsPerWeek),
  }
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
  const peakMultiplier = APPROACH_PRESETS[approach].peakMultiplier
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
