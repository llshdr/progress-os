import type { SelfAssessment } from '@/lib/race-plan/self-assessment'
import type { FitnessSnapshot } from '@/lib/race-plan/analyze-fitness'

// Simple threshold checks, not AI - deterministic so the client (Snapshot
// step warning) and the race-plan route (prompt context) can't drift.
// Not exhaustive, just the clearest self-report-vs-logged-data mismatches.
// Multisport assessments are handled by the discipline-weakness system
// instead (per-discipline, not aggregate) - this only applies to the
// simple, single-discipline shape.
export function computeTensionFlags(assessment: SelfAssessment, facts: FitnessSnapshot): string[] {
  if (assessment.kind !== 'simple') return []

  const flags: string[] = []

  if (assessment.perceivedFitness != null && assessment.perceivedFitness >= 4 && facts.cardio.weeksActive <= 2) {
    flags.push(
      `You rated your fitness highly, but cardio activity is only logged in ${facts.cardio.weeksActive} of the last 8 weeks — the plan will lean on your logged activity as the primary signal.`
    )
  }

  if (assessment.perceivedFitness != null && assessment.perceivedFitness <= 2 && facts.cardio.weeksActive >= 6) {
    flags.push(
      `You rated your fitness low, but you've been active ${facts.cardio.weeksActive} of the last 8 weeks — your logged numbers may already be ahead of how you feel.`
    )
  }

  if (assessment.longestRecentDistanceKm != null && facts.cardio.longestSessionKm > 0) {
    const ratio = assessment.longestRecentDistanceKm / facts.cardio.longestSessionKm
    if (ratio >= 2) {
      flags.push(
        `You reported a longest recent run of ${assessment.longestRecentDistanceKm}km, well above your longest logged session (${facts.cardio.longestSessionKm}km) — if that run wasn't logged in the app, the plan may be starting from a lower baseline than reality.`
      )
    }
  }

  return flags
}
