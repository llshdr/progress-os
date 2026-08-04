import type { Discipline, DisciplineAssessment, ExperienceLevel } from '@/lib/race-plan/self-assessment'
import type { DisciplineActivityFacts } from '@/lib/race-plan/discipline-weakness'
import { formatPaceForDiscipline } from '@/lib/race-plan/pace-units'

const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run']

// Real data only - deliberately NO placeholder fallback (unlike
// resolveEasyPaceBaseline in pace-targets.ts, which falls back to a
// synthetic pace because a TRAINING PLAN always needs some baseline to
// generate from). This achievability check exists specifically to stay
// honest to real data or say plainly there isn't enough of it yet - a
// fabricated comparison point here would produce a fabricated verdict.
export function resolveRealZone2Pace(
  comfortableEffort: DisciplineAssessment['comfortableEffort'],
  activityFacts: DisciplineActivityFacts | null
): number | null {
  if (comfortableEffort) return comfortableEffort.paceSecPerKm
  if (activityFacts?.avgPaceSecPerKmRecent != null) return activityFacts.avgPaceSecPerKmRecent
  return null
}

export interface PaceGap {
  discipline: Discipline
  goalPaceSecPerKm: number
  currentPaceSecPerKm: number
  // Positive = current pace needs to get faster to hit the goal;
  // zero-or-negative = the goal is already at or slower than current
  // real pace.
  improvementPercent: number
}

// Only produces a gap for disciplines with a REAL current pace (see
// resolveRealZone2Pace) - silently skips the rest rather than guessing,
// same precedent as thresholdPaceHint degrading to null.
export function computePaceGaps(peakPaceTargets: Record<Discipline, number>, currentPaces: Record<Discipline, number | null>): PaceGap[] {
  const gaps: PaceGap[] = []
  for (const discipline of DISCIPLINES) {
    const current = currentPaces[discipline]
    if (current == null || current <= 0) continue
    const goal = peakPaceTargets[discipline]
    gaps.push({ discipline, goalPaceSecPerKm: goal, currentPaceSecPerKm: current, improvementPercent: ((current - goal) / current) * 100 })
  }
  return gaps
}

// Published improvement-rate research is running-specific (RunnersConnect:
// https://runnersconnect.net/how-much-faster-can-you-get-in-a-year/,
// Outside/Run: https://run.outsideonline.com/training/want-to-get-faster-heres-how-long-it-actually-takes/) -
// no equivalent independently-sourced swim/bike-specific improvement-rate
// research was found, so these bands are used here as a general
// cross-discipline reference point (the same "large gains for
// undertrained athletes, small gains for already-trained athletes"
// pattern is broadly accepted exercise-science consensus), not a
// discipline-specific claim - said plainly rather than inventing
// swim/bike-specific numbers. Framed around a SINGLE ~8-20 week training
// cycle, not a per-week rate - there is no credible way to linearly
// extrapolate this to an arbitrary N-week runway (diminishing returns
// aren't linear), so this deliberately does not attempt that.
const NOVICE_CYCLE_IMPROVEMENT_PERCENT = { low: 15, high: 20 } // sedentary-baseline beginners, ~8-12 weeks
const TRAINED_CYCLE_IMPROVEMENT_PERCENT = { low: 3, high: 10 } // already-trained recreational athletes, ~18-week block

function describeAchievabilityBand(improvementPercent: number, level: ExperienceLevel): string {
  const band = level === 'beginner' ? NOVICE_CYCLE_IMPROVEMENT_PERCENT : TRAINED_CYCLE_IMPROVEMENT_PERCENT
  if (improvementPercent <= band.high) {
    return `within the range commonly cited (${band.low}-${band.high}%) for a single training cycle at your level - not guaranteed, but not a stretch beyond what's been observed.`
  }
  return `beyond the range commonly cited (${band.low}-${band.high}%) for a single training cycle at your level - a real stretch, not just "train harder."`
}

// The full cited sentence for one discipline's gap - no discipline label
// baked in (callers already show one, e.g. Race Day Plan's own
// DISCIPLINE_LABELS prefix), so this stays a plain, prependable sentence.
export function describePaceGap(gap: PaceGap, weeksUntilRace: number, level: ExperienceLevel): string {
  const goalText = formatPaceForDiscipline(gap.goalPaceSecPerKm, gap.discipline)
  const currentText = formatPaceForDiscipline(gap.currentPaceSecPerKm, gap.discipline)
  if (gap.improvementPercent <= 0) {
    return `Goal pace ~${goalText}; your current logged Zone 2 pace (~${currentText}) already meets it - comfortably on track.`
  }
  const weeksText = weeksUntilRace > 0 ? `${weeksUntilRace} weeks` : 'race day'
  return `Goal pace ~${goalText}; your current logged Zone 2 pace is ~${currentText} - a ${gap.improvementPercent.toFixed(0)}% improvement needed over ${weeksText}, ${describeAchievabilityBand(gap.improvementPercent, level)}`
}
