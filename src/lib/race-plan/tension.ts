import type { Discipline, MultisportSelfAssessment, SelfAssessment } from '@/lib/race-plan/self-assessment'
import type { FitnessSnapshot } from '@/lib/race-plan/analyze-fitness'
import type { DisciplineActivityFacts } from '@/lib/race-plan/discipline-weakness'

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

const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run']
const DISCIPLINE_LABEL: Record<Discipline, string> = { swim: 'swim', bike: 'bike', run: 'run' }
const RATIO_THRESHOLD = 2
// A self-report with genuinely NO logged activity for that discipline
// can't use a ratio (division by zero) - but that's exactly the case
// most worth flagging, not least. This per-discipline floor keeps it
// from nagging over a perfectly normal first-ever entry (e.g. "ran 5km"
// with nothing logged yet is not suspicious on its own).
const MIN_WORTH_FLAGGING_KM: Record<Discipline, number> = { swim: 3, bike: 20, run: 8 }

// Multisport counterpart to computeTensionFlags above - per-discipline
// rather than aggregate, since a multisport assessment's longest-session
// self-report is already per-discipline (see discipline-weakness.ts's
// own per-discipline framing). Previously multisport got NO cross-check
// against logged reality at all; rankDisciplines/scoreDiscipline only
// ever consumed the bounded 1-5 comfortLevel scale, never this field.
export function computeMultisportTensionFlags(
  assessment: MultisportSelfAssessment,
  activityFacts: Record<Discipline, DisciplineActivityFacts> | null
): string[] {
  if (!activityFacts) return []
  const flags: string[] = []

  for (const discipline of DISCIPLINES) {
    const reportedKm = assessment[discipline].longestRecentSessionKm
    if (reportedKm == null) continue
    const logged = activityFacts[discipline].longestSessionKm

    const worthFlagging = logged > 0 ? reportedKm / logged >= RATIO_THRESHOLD : reportedKm >= MIN_WORTH_FLAGGING_KM[discipline]
    if (!worthFlagging) continue

    flags.push(
      logged > 0
        ? `You reported a longest recent ${DISCIPLINE_LABEL[discipline]} session of ${reportedKm}km, well above your longest logged session (${logged}km) — if that session wasn't logged in the app, the plan may be starting from a lower baseline than reality.`
        : `You reported a longest recent ${DISCIPLINE_LABEL[discipline]} session of ${reportedKm}km, but there's no logged ${DISCIPLINE_LABEL[discipline]} activity in the last 8 weeks — if that session wasn't logged in the app, the plan may be starting from a lower baseline than reality.`
    )
  }

  return flags
}
