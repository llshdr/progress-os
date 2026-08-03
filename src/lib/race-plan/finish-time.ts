import { RACE_TYPE_DISTANCE_KM, type RaceType } from '@/lib/race-constants'
import type { FitnessSnapshot, PastRaceResult } from '@/lib/race-plan/analyze-fitness'
import type { ExperienceLevel } from '@/lib/race-plan/self-assessment'
import type { RaceCourseTimeBand, RaceCourseCutoff, CutoffSegment } from '@/lib/race-plan/course-data'

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

// ─── Multisport (Ironman/Xtri) finish-time RANGE ─────────────────────────
// Course data (Phase 2) - a range, never a fabricated single point, since
// a multi-discipline result is far less precisely predictable than a
// single-discipline pace extrapolation.

export interface ProjectedRaceTimeRange {
  totalSecondsLow: number
  totalSecondsHigh: number
  swimExitSecondsLow: number | null
  swimExitSecondsHigh: number | null
  bikeFinishSecondsLow: number | null
  bikeFinishSecondsHigh: number | null
  source: 'exact_course_result' | 'course_band' | 'generic_band'
  sourceNote: string
}

const TIER_LABEL: Record<ExperienceLevel, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

// Commonly-cited industry-standard full-distance triathlon finish windows
// by ability tier - the same starting-point numbers seeded into
// race_course_time_bands for courses without more specific data yet.
const GENERIC_TOTAL_SECONDS: Record<ExperienceLevel, { low: number; high: number }> = {
  beginner: { low: 46800, high: 57600 }, // 13-16h
  intermediate: { low: 39600, high: 46800 }, // 11-13h
  advanced: { low: 32400, high: 39600 }, // 9-11h
}

// Xtri (extreme-triathlon) courses commonly run notably slower than a
// standard Ironman due to terrain/conditions - a modest, clearly-labeled
// categorical shift, matching the same adjustment applied to the seeded
// Norseman/Swedeman time bands, not fabricated per-course precision.
const XTRI_GENERIC_SHIFT = 1.15

// Rough elapsed-time-since-start split, used ONLY to derive a display
// estimate when a course's real swim-exit/bike-finish splits aren't known
// yet (race_course_time_bands' swim_exit/bike_finish columns are null) -
// distinguished from a real course-specific split via `source` above,
// never claimed as independently sourced.
const TYPICAL_ELAPSED_FRACTION = { swimExit: 0.09, bikeFinish: 0.63 }

function estimateSplitSeconds(totalSeconds: number, split: keyof typeof TYPICAL_ELAPSED_FRACTION): number {
  return Math.round(totalSeconds * TYPICAL_ELAPSED_FRACTION[split])
}

function deriveSplits(totalSecondsLow: number, totalSecondsHigh: number, band: RaceCourseTimeBand | null) {
  return {
    swimExitSecondsLow: band?.swimExitSecondsLow ?? estimateSplitSeconds(totalSecondsLow, 'swimExit'),
    swimExitSecondsHigh: band?.swimExitSecondsHigh ?? estimateSplitSeconds(totalSecondsHigh, 'swimExit'),
    bikeFinishSecondsLow: band?.bikeFinishSecondsLow ?? estimateSplitSeconds(totalSecondsLow, 'bikeFinish'),
    bikeFinishSecondsHigh: band?.bikeFinishSecondsHigh ?? estimateSplitSeconds(totalSecondsHigh, 'bikeFinish'),
  }
}

// Precedence: (1) a past result on this EXACT course - tight +-8% band
// around the real result; (2) this course's race_course_time_bands row
// for the athlete's tier; (3) a generic tier fallback. A past result on a
// DIFFERENT course is deliberately not folded in numerically here - it's
// added as extra prompt context in the race-plan route so the model can
// reference it in prose, keeping code-decided numbers separate from
// model-written qualitative color.
export function estimateCourseFinishRange(
  raceType: RaceType,
  level: ExperienceLevel,
  pastRaceResults: PastRaceResult[],
  courseId: string | null,
  timeBand: RaceCourseTimeBand | null
): ProjectedRaceTimeRange {
  const exactMatch = courseId ? pastRaceResults.find((r) => r.courseId === courseId) : undefined
  if (exactMatch) {
    return {
      totalSecondsLow: Math.round(exactMatch.resultSeconds * 0.92),
      totalSecondsHigh: Math.round(exactMatch.resultSeconds * 1.08),
      swimExitSecondsLow: null,
      swimExitSecondsHigh: null,
      bikeFinishSecondsLow: null,
      bikeFinishSecondsHigh: null,
      source: 'exact_course_result',
      sourceNote: 'based on your past result at this course',
    }
  }

  if (timeBand) {
    return {
      totalSecondsLow: timeBand.totalSecondsLow,
      totalSecondsHigh: timeBand.totalSecondsHigh,
      ...deriveSplits(timeBand.totalSecondsLow, timeBand.totalSecondsHigh, timeBand),
      source: 'course_band',
      sourceNote: `Based on typical finish times for ${TIER_LABEL[level]}-level athletes who complete a full training block for this course.`,
    }
  }

  const generic = GENERIC_TOTAL_SECONDS[level]
  const shift = raceType === 'xtri' ? XTRI_GENERIC_SHIFT : 1.0
  const totalSecondsLow = Math.round(generic.low * shift)
  const totalSecondsHigh = Math.round(generic.high * shift)

  return {
    totalSecondsLow,
    totalSecondsHigh,
    ...deriveSplits(totalSecondsLow, totalSecondsHigh, null),
    source: 'generic_band',
    sourceNote: `A general range for ${TIER_LABEL[level]}-level athletes completing a full training block - not calibrated to this specific course yet.`,
  }
}

export interface CutoffRiskFlag {
  segment: CutoffSegment
  cutoffSecondsFromStart: number
  // Cutoff minus the range's slow (high) end - positive is margin, negative means the slow end misses the cutoff.
  marginSecondsSlowEnd: number
  risk: 'comfortable' | 'watch' | 'risk'
  message: string
}

const COMFORTABLE_MARGIN_SECONDS = 30 * 60
export const SEGMENT_LABEL: Record<CutoffSegment, string> = { swim: 'swim', bike: 'bike', overall: 'overall race' }

function rangeForSegment(range: ProjectedRaceTimeRange, segment: CutoffSegment): { low: number; high: number } | null {
  if (segment === 'swim') {
    return range.swimExitSecondsLow != null && range.swimExitSecondsHigh != null
      ? { low: range.swimExitSecondsLow, high: range.swimExitSecondsHigh }
      : null
  }
  if (segment === 'bike') {
    return range.bikeFinishSecondsLow != null && range.bikeFinishSecondsHigh != null
      ? { low: range.bikeFinishSecondsLow, high: range.bikeFinishSecondsHigh }
      : null
  }
  return { low: range.totalSecondsLow, high: range.totalSecondsHigh }
}

// Three-tier framing per segment: slow end clears with real margin =
// comfortable; fast end clears but slow end is close = watch; even the
// fast end doesn't clear = risk. Skips a segment entirely when no cutoff
// row exists for it, rather than guessing - most courses only have an
// 'overall' cutoff seeded today (see migration 051).
export function assessCutoffRisk(range: ProjectedRaceTimeRange, cutoffs: RaceCourseCutoff[]): CutoffRiskFlag[] {
  const flags: CutoffRiskFlag[] = []

  for (const cutoff of cutoffs) {
    const segmentRange = rangeForSegment(range, cutoff.segment)
    if (!segmentRange) continue

    const marginSlow = cutoff.cutoffSecondsFromStart - segmentRange.high
    const marginFast = cutoff.cutoffSecondsFromStart - segmentRange.low
    const label = SEGMENT_LABEL[cutoff.segment]

    const base = { segment: cutoff.segment, cutoffSecondsFromStart: cutoff.cutoffSecondsFromStart, marginSecondsSlowEnd: marginSlow }

    if (marginSlow >= COMFORTABLE_MARGIN_SECONDS) {
      flags.push({ ...base, risk: 'comfortable', message: `Comfortably under the ${label} cutoff, even on your slower end.` })
    } else if (marginFast > 0) {
      flags.push({
        ...base,
        risk: 'watch',
        message: `Could be tight against the ${label} cutoff on a tougher day — worth keeping an eye on pacing here.`,
      })
    } else {
      const message =
        range.source === 'exact_course_result'
          ? `Your pace based on your past result at this course is a real risk against the ${label} cutoff — this needs direct attention.`
          : `Even fully completing this training plan, you're projected to miss the ${label} cutoff — this needs a harder plan, not just consistent training.`
      flags.push({ ...base, risk: 'risk', message })
    }
  }

  return flags
}

// Multisport counterpart to assessGoalRealism - compares a stated target
// against the whole RANGE rather than a single point.
export function assessGoalRealismForRange(targetFinishSeconds: number, range: ProjectedRaceTimeRange): string | null {
  if (targetFinishSeconds < range.totalSecondsLow) {
    return `Your target finish time is faster than even the optimistic end of your data-estimated range — an ambitious stretch goal, not a guarantee at this fitness level.`
  }
  if (targetFinishSeconds > range.totalSecondsHigh) {
    return `Your target finish time is comfortably slower than your data-estimated range — a conservative, very achievable goal.`
  }
  return null
}
