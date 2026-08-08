import type { Discipline } from '@/lib/race-plan/self-assessment'
import { daysBetween } from '@/lib/goals'

// Real coaching sources recommend a fresh fitness check every ~12 weeks
// (a 5k/10k time trial, an 800m swim test, an FTP test) to confirm the
// plan still matches real fitness and catch a stalled block early. This
// is deliberately separate from deriveCurrentFormLevel's PASSIVE 4-week
// logged-activity read (current-form.ts) - a proactive nudge to go take
// a real test, not another read of ambient training volume.
export const RETEST_INTERVAL_WEEKS = 12

export interface RetestCandidate {
  // null = single-discipline (SimpleSelfAssessment); a Discipline for
  // multisport, one entry per swim/bike/run.
  label: Discipline | null
  recordedAt: string | null
}

export interface RetestReminder {
  label: Discipline | null
  weeksSince: number
  // Whether recordedAt was ever actually set - false means the anchor
  // fell back to trainingStartDate (never tested at all), which needs
  // different wording than "your last test is N weeks old."
  everRecorded: boolean
}

// Flags the single MOST overdue candidate (one nudge, not one per
// discipline). Anchored to the benchmark's own recordedAt when one
// exists; falls back to trainingStartDate for a discipline that's never
// been tested, so someone who skipped the time-trial question entirely
// still gets prompted once training is well underway rather than never
// triggering. Returns null when there's nothing to anchor to yet (no
// recordedAt AND no trainingStartDate) or when the most-overdue
// candidate is still under the interval - never a guess at staleness
// without a real date to measure from.
export function findMostOverdueRetest(candidates: RetestCandidate[], trainingStartDate: string | null, today: string): RetestReminder | null {
  let worst: RetestReminder | null = null

  for (const c of candidates) {
    const anchor = c.recordedAt ?? trainingStartDate
    if (!anchor) continue
    const weeksSince = Math.floor(daysBetween(today, anchor) / 7)
    if (weeksSince < RETEST_INTERVAL_WEEKS) continue
    if (!worst || weeksSince > worst.weeksSince) worst = { label: c.label, weeksSince, everRecorded: c.recordedAt != null }
  }

  return worst
}
