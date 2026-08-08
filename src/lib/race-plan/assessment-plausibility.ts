import type { Discipline } from '@/lib/race-plan/self-assessment'

// Generous physical-plausibility backstops for self-reported numbers -
// NOT a claim about what's realistic for a given athlete (that's what
// the self-report-vs-logged-activity tension checks are for, see
// tension.ts's computeMultisportTensionFlags), just "is this within the
// range of anything a human has ever actually done." Deliberately loose
// (well beyond real elite/world-record performance) so this only catches
// data-entry errors and truly absurd values, never a genuinely fast or
// long session from a strong athlete. Same "cite a real, if rough,
// reference point" discipline as this feature's other guidance
// constants (e.g. TYPICAL_TRANSITION_SECONDS, THRESHOLD_TEST_WINDOW_SECONDS).

// Faster than this sec/km is beyond any recorded elite/world-record
// sustained pace for the discipline - run: faster than world mile/5K
// record pace; bike: faster than the UCI hour record (~56km/h); swim:
// faster than elite 800m/1500m freestyle world-record pace. A generous
// margin below the fastest anyone has ever actually gone, not a
// per-athlete prediction.
export const FASTEST_PLAUSIBLE_PACE_SEC_PER_KM: Record<Discipline, number> = {
  swim: 550, // ~9:10/km
  bike: 60, // 60km/h sustained
  run: 130, // ~2:10/km
}

// Beyond this distance, a single "recent session" is deep into extreme
// ultra-endurance territory (a channel swim, a double-century ride, a
// 50-mile ultra run) - worth a second look before it's trusted as a
// normal training session, not flagged as impossible.
export const SESSION_KM_CEILING: Record<Discipline, number> = {
  swim: 15,
  bike: 300,
  run: 80,
}

const DISCIPLINE_LABEL: Record<Discipline, string> = { swim: 'swim', bike: 'bike', run: 'run' }

export function checkSessionDistancePlausibility(discipline: Discipline, km: number | null): string | null {
  if (km == null || km <= SESSION_KM_CEILING[discipline]) return null
  return `${km}km is a lot for a single ${DISCIPLINE_LABEL[discipline]} session - worth double-checking this number.`
}

export function checkPacePlausibility(discipline: Discipline, paceSecPerKm: number | null): string | null {
  if (paceSecPerKm == null || paceSecPerKm <= 0 || paceSecPerKm >= FASTEST_PLAUSIBLE_PACE_SEC_PER_KM[discipline]) return null
  return `That ${DISCIPLINE_LABEL[discipline]} pace is faster than any recorded elite/world-record performance - worth double-checking this number.`
}

// Checks the time trial's distance AND its implied pace - a huge
// distance is flagged even before pace enters the picture, and an
// otherwise-plausible distance can still imply an impossible pace (e.g.
// a duration typo).
export function checkTimeTrialPlausibility(discipline: Discipline, trial: { distanceKm: number; timeSeconds: number } | null): string | null {
  if (!trial || trial.distanceKm <= 0 || trial.timeSeconds <= 0) return null
  const distanceFlag = checkSessionDistancePlausibility(discipline, trial.distanceKm)
  if (distanceFlag) return distanceFlag
  return checkPacePlausibility(discipline, trial.timeSeconds / trial.distanceKm)
}
