import type { RaceType } from '@/lib/race-constants'
import type { Discipline, DisciplineAssessment } from '@/lib/race-plan/self-assessment'
import type { TrainingPhase, DisciplineTarget } from '@/lib/race-plan/periodization'
import type { SlotProgression } from '@/lib/race-plan/day-template'
import { RACE_LEG_DISTANCE_KM, TYPICAL_ELAPSED_FRACTION, type ProjectedRaceTimeRange } from '@/lib/race-plan/finish-time'
import type { DisciplineActivityFacts } from '@/lib/race-plan/discipline-weakness'

const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run']

// Real per-leg splits when the course range has them; the same
// TYPICAL_ELAPSED_FRACTION estimate finish-time.ts itself falls back to
// otherwise (e.g. an exact_course_result range, which never computes
// splits at all) - never a second, independently-guessed fraction.
function splitFractions(range: ProjectedRaceTimeRange): { swimExitFraction: number; bikeFinishFraction: number } {
  if (range.swimExitSecondsHigh != null && range.bikeFinishSecondsHigh != null && range.totalSecondsHigh > 0) {
    return {
      swimExitFraction: range.swimExitSecondsHigh / range.totalSecondsHigh,
      bikeFinishFraction: range.bikeFinishSecondsHigh / range.totalSecondsHigh,
    }
  }
  return { swimExitFraction: TYPICAL_ELAPSED_FRACTION.swimExit, bikeFinishFraction: TYPICAL_ELAPSED_FRACTION.bikeFinish }
}

// Peak-phase (= race-day) target pace per discipline, in sec/km - pure
// arithmetic over a total time and real leg distances, never a
// fabricated number. totalSeconds is the caller's choice of basis (a
// stated goal time, or the course band's slow end for a safe-margin
// baseline - see resolvePeakPaceTargets below) applied against THIS
// course's own split fraction, not the range's own absolute split
// seconds (which were computed for a possibly-different total).
export function computePeakPaceTargets(raceType: RaceType, totalSeconds: number, range: ProjectedRaceTimeRange): Record<Discipline, number> | null {
  const legDistances = RACE_LEG_DISTANCE_KM[raceType]
  if (!legDistances) return null

  const { swimExitFraction, bikeFinishFraction } = splitFractions(range)
  const swimExitSeconds = totalSeconds * swimExitFraction
  const bikeFinishSeconds = totalSeconds * bikeFinishFraction

  return {
    swim: swimExitSeconds / legDistances.swim,
    bike: (bikeFinishSeconds - swimExitSeconds) / legDistances.bike,
    run: (totalSeconds - bikeFinishSeconds) / legDistances.run,
  }
}

// The swim-exit/bike-finish elapsed-time fractions (splitFractions
// above) already reflect REAL race data, which means the interval
// between checkpoints already has real T1/T2 baked into it - dividing
// that whole interval by distance alone silently waters down the
// bike/run pace targets rather than reserving separate clock time for
// transitions. Left unaddressed, hitting every displayed pace exactly
// still produces goal + real T1 + real T2, not the goal itself.
//
// Two independent, meaningfully divergent published estimates for
// full-distance age-group transitions: ~17 min combined T1+T2
// (bettertriathlete.com, age-group average) vs. ~6-12 min total for a
// ~12h finisher (marathonhandbook.com, citing MyTriWorld's ~2%-of-total
// framing). Given that spread, 10 minutes is a defensible midpoint, not
// a precise constant - same heuristic-with-a-comment precedent as this
// file's own FALLBACK_EASY_PACE_SLOWDOWN. One combined figure, not a
// separate T1/T2 split, since neither source cleanly separates them for
// full-distance racing. Exported so the Race Day Plan UI can explain the
// ~10 minutes it reserves using this same number, rather than a second
// hardcoded copy of it drifting out of sync.
export const TYPICAL_TRANSITION_SECONDS = 10 * 60

// target_finish_seconds when the athlete has stated one; otherwise the
// band's SLOW end, not the midpoint - same honest-margin precedent as
// the rest of this feature (see finish-time.ts's cutoff-risk framing) -
// "safely clear cutoff with real margin" undersells nothing by
// defaulting to an average case.
//
// The transition-time subtraction only applies when a real goal is
// stated - for the no-goal/cutoff-margin basis, real transition time
// eating into the existing safety margin is an acceptable
// simplification (untouched, exactly as before).
export function resolvePeakPaceTargets(
  raceType: RaceType,
  targetFinishSeconds: number | null,
  range: ProjectedRaceTimeRange | null
): Record<Discipline, number> | null {
  if (!range) return null
  if (targetFinishSeconds != null) {
    const budgetSeconds = Math.max(0, targetFinishSeconds - TYPICAL_TRANSITION_SECONDS)
    return computePeakPaceTargets(raceType, budgetSeconds, range)
  }
  return computePeakPaceTargets(raceType, range.totalSecondsHigh, range)
}

// A clearly-labeled placeholder only reached when neither real signal is
// available - not a research citation, just a starting point.
const FALLBACK_EASY_PACE_SLOWDOWN = 1.12

// Base-phase pace baseline for one discipline's key session, prioritizing
// real data exactly like disciplineBaselineKm already does for volume
// (periodization.ts): the athlete's own reported comfortable/Zone 2
// pace first, their real logged average second, and only then a rough
// percentage-slower-than-peak placeholder.
export function resolveEasyPaceBaseline(
  comfortableEffort: DisciplineAssessment['comfortableEffort'],
  activityFacts: DisciplineActivityFacts | null,
  peakPaceSecPerKm: number
): number {
  if (comfortableEffort) return comfortableEffort.paceSecPerKm
  if (activityFacts?.avgPaceSecPerKmRecent != null) return activityFacts.avgPaceSecPerKmRecent
  return peakPaceSecPerKm * FALLBACK_EASY_PACE_SLOWDOWN
}

export function resolveEasyPaceTargets(
  peakPaceTargets: Record<Discipline, number>,
  comfortableEffortByDiscipline: Record<Discipline, DisciplineAssessment['comfortableEffort']>,
  activityFacts: Record<Discipline, DisciplineActivityFacts> | null
): Record<Discipline, number> {
  const result = {} as Record<Discipline, number>
  for (const discipline of DISCIPLINES) {
    result[discipline] = resolveEasyPaceBaseline(comfortableEffortByDiscipline[discipline], activityFacts?.[discipline] ?? null, peakPaceTargets[discipline])
  }
  return result
}

// The pace a key session should target for a given week, ramping from
// the easy baseline toward the Peak target - reuses the exact bounded
// linear-ramp SHAPE already established for a key slot's km share
// (enduranceSlotKmForWeek/SlotProgression in day-template.ts), applied
// here to pace instead of km, and driven by that same slot's own
// progression object (so both ramp over the identical Build window).
//
// Two deliberate departures from a blind km-style reuse:
// - Base holds flat at the easy baseline (matches Base's own
//   progression:null - no race-pace work yet, per ZONE_GUIDANCE.base).
// - Peak AND Taper both hold flat at the Peak target. Volume tapers
//   down in Taper; pace should not - "cut volume, keep intensity" is
//   standard guidance, so a taper key session stays at race pace, just
//   shorter (its km already tapers via the normal km model).
export function paceTargetForWeek(
  easyPaceSecPerKm: number,
  peakPaceSecPerKm: number,
  phase: TrainingPhase,
  weekIndexWithinPhase: number,
  progression: SlotProgression | null
): number {
  if (phase === 'peak' || phase === 'taper') return peakPaceSecPerKm
  if (phase === 'base' || !progression) return easyPaceSecPerKm

  const progress = Math.min(1, weekIndexWithinPhase / Math.max(1, progression.rampWeeks))
  return easyPaceSecPerKm + (peakPaceSecPerKm - easyPaceSecPerKm) * progress
}

// Flat estimate for one strength session - the same ~45-minute figure
// already cited in periodization.ts's LEVEL_PEAK_KM sourcing comment
// ("one SEPARATE ~45-minute strength session"), not a new number.
const STRENGTH_SESSION_HOURS = 0.75

// Rough weekly training-time estimate for one plan week, used only to
// flag when a plan's peak week exceeds the athlete's stated available
// hours (MultisportSelfAssessment.availableWeeklyHours). Cardio km is
// converted at the EASY pace baseline, not race pace - the overwhelming
// majority of a week's volume is easy effort (see resolveEasyPaceBaseline
// above), so that's the honest basis for a time estimate, not the fastest
// one. Deliberately an estimate, not session-by-session modeling - same
// "cite an estimate honestly" precedent as FALLBACK_EASY_PACE_SLOWDOWN.
export function estimateWeeklyTrainingHours(
  week: { disciplines: Record<Discipline, DisciplineTarget> | null; targetStrengthSessions: number },
  easyPaceTargets: Record<Discipline, number> | null
): number | null {
  if (!week.disciplines || !easyPaceTargets) return null
  const cardioHours = DISCIPLINES.reduce((sum, d) => sum + (week.disciplines![d].km * easyPaceTargets[d]) / 3600, 0)
  return cardioHours + week.targetStrengthSessions * STRENGTH_SESSION_HOURS
}
