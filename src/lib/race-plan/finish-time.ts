import { RACE_TYPE_DISTANCE_KM, type RaceType } from '@/lib/race-constants'
import type { FitnessSnapshot } from '@/lib/race-plan/analyze-fitness'

// Riegel's formula - a standard, widely-cited endurance race-time
// prediction (T2 = T1 * (D2/D1)^1.06), same "cite a real formula"
// discipline as estimateOneRepMax's Epley formula.
export function projectFinishTimeSeconds(knownDistanceKm: number, knownTimeSeconds: number, targetDistanceKm: number): number {
  return Math.round(knownTimeSeconds * Math.pow(targetDistanceKm / knownDistanceKm, 1.06))
}

// Only for run-dominant race types (RACE_TYPE_DISTANCE_KM) - deliberately
// returns null for Ironman/Xtri/ultra/other rather than fabricating a
// multi-discipline estimate. Prefers an actual past race result (any
// run-type distance, via Riegel) over pace-extrapolation from the longest
// recent logged session, since a real result is a much better anchor.
export function estimateProjectedFinishSeconds(raceType: RaceType, facts: FitnessSnapshot): number | null {
  const targetDistanceKm = RACE_TYPE_DISTANCE_KM[raceType]
  if (!targetDistanceKm) return null

  const pastRunResult = facts.pastRaceResults.find((r) => RACE_TYPE_DISTANCE_KM[r.raceType] != null)
  if (pastRunResult) {
    const knownDistanceKm = RACE_TYPE_DISTANCE_KM[pastRunResult.raceType]!
    return projectFinishTimeSeconds(knownDistanceKm, pastRunResult.resultSeconds, targetDistanceKm)
  }

  if (facts.cardio.avgPaceSecPerKmRecent != null && facts.cardio.longestSessionKm > 0) {
    const knownTimeSeconds = facts.cardio.avgPaceSecPerKmRecent * facts.cardio.longestSessionKm
    return projectFinishTimeSeconds(facts.cardio.longestSessionKm, knownTimeSeconds, targetDistanceKm)
  }

  return null
}

// Basic, data-only realism check for run-type races (the only ones with a
// projection at all). A target more than ~10% faster than the data
// estimate is flagged as an ambitious stretch, not silently accepted as
// achievable - course-calibrated realism (factoring in course difficulty)
// is Phase 2, this is deliberately simpler.
const AMBITIOUS_TARGET_RATIO = 0.9

export function assessGoalRealism(targetFinishSeconds: number, projectedFinishSeconds: number): string | null {
  const ratio = targetFinishSeconds / projectedFinishSeconds
  if (ratio < AMBITIOUS_TARGET_RATIO) {
    return `Your target finish time is notably faster than your data-estimated pace suggests — an ambitious stretch goal, not a guarantee at this fitness level.`
  }
  return null
}
