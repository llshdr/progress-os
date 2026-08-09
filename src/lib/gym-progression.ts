import type { MuscleGroupTrend } from '@/lib/race-plan/analyze-fitness'

// Feeds the rank system's progression bonus (migration 076) - reuses
// computeStrengthFacts's already-computed muscle-group trends (exported
// from analyze-fitness.ts) rather than reimplementing any 1RM/trend
// logic here. "Are you getting stronger against your own recent
// history," never a comparison between users' real numbers.
//
// Only trends with hasPrior:true carry real evidence - a muscle group
// with no prior-window data defaults to trend:'flat' for display
// purposes elsewhere, but that's not a real "no progress" reading and
// must not count as one here. Gated on >= 2 muscle groups with real
// evidence (same "don't guess from one data point" discipline as
// computeRacesProgressionSignal's weeksElapsedSoFar gate) - fewer than
// that returns null (insufficient evidence), never a fabricated score.
const MIN_MUSCLE_GROUPS_WITH_EVIDENCE = 2

export function computeGymProgressionSignal(trends: MuscleGroupTrend[]): number | null {
  const withEvidence = trends.filter((t) => t.hasPrior)
  if (withEvidence.length < MIN_MUSCLE_GROUPS_WITH_EVIDENCE) return null

  const improving = withEvidence.filter((t) => t.trend === 'up').length
  return improving / withEvidence.length
}
