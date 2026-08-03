import type { Discipline, ExperienceLevel } from '@/lib/race-plan/self-assessment'
import type { DisciplineActivityFacts } from '@/lib/race-plan/discipline-weakness'
import { LEVEL_PEAK_KM, BASE_START_FRACTION_OF_PEAK } from '@/lib/race-plan/periodization'

export interface CurrentFormResult {
  level: ExperienceLevel
  baselineLevel: ExperienceLevel
  changed: boolean
  // Distinguishes WHY changed is false - "insufficient" (no evidence
  // yet, don't let this silently look identical to "confirmed") from
  // "confirmed" (real evidence exists and simply agrees with the
  // self-report) - previously collapsed into one reason:null shape,
  // which read as "ignored the situation" when there was no logged
  // activity at all.
  evidence: 'insufficient' | 'confirmed' | 'updated'
  reason: string | null
}

const TIER_ORDER: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced']
const TIER_LABEL: Record<ExperienceLevel, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }
const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run']

// Re-derives the tier used for the finish-time course-band lookup from
// REAL, sustained recent activity instead of trusting a one-time
// self-report answer forever - the same 4-week window and LEVEL_PEAK_KM
// bands already used elsewhere in this feature (disciplineBaselineKm in
// periodization.ts), not new invented thresholds. Symmetric (moves up
// OR down as real evidence changes) and requires ALL THREE disciplines
// to clear a tier's own Base-phase floor - a single strong discipline
// can't inflate the whole tier, matching this feature's existing "never
// invent a capability the user doesn't have" discipline.
//
// Scope: this only ever feeds the finish-time projection (course-band
// lookup) - never retroactively changes an already-generated plan's
// stored volumes. A future Generate/Regenerate picks it up too, but
// only because generation is already the explicit, consent-gated
// moment for incorporating new evidence - "no auto-replanning" is
// unaffected.
export function deriveCurrentFormLevel(
  baselineLevel: ExperienceLevel,
  activityFacts: Record<Discipline, DisciplineActivityFacts> | null
): CurrentFormResult {
  if (!activityFacts || DISCIPLINES.every((d) => activityFacts[d].weeksActiveOf8 === 0)) {
    // Insufficient evidence either way - trust the self-report as-is,
    // but say so explicitly rather than looking identical to "confirmed."
    return {
      level: baselineLevel,
      baselineLevel,
      changed: false,
      evidence: 'insufficient',
      reason: 'No logged swim/bike/run activity in the last 4 weeks yet - log some cardio sessions and this projection will update automatically.',
    }
  }

  let derivedLevel: ExperienceLevel = 'beginner'
  for (const tier of TIER_ORDER) {
    const clearsFloor = DISCIPLINES.every((d) => activityFacts[d].recentAvgWeeklyKm >= LEVEL_PEAK_KM[tier][d] * BASE_START_FRACTION_OF_PEAK)
    if (clearsFloor) derivedLevel = tier
  }

  if (derivedLevel === baselineLevel) {
    // Real, sufficient evidence exists and simply agrees with the
    // self-report - the one case that genuinely needs no explanation.
    return { level: baselineLevel, baselineLevel, changed: false, evidence: 'confirmed', reason: null }
  }

  const direction = TIER_ORDER.indexOf(derivedLevel) > TIER_ORDER.indexOf(baselineLevel) ? 'more consistent with' : 'currently closer to'
  return {
    level: derivedLevel,
    baselineLevel,
    changed: true,
    evidence: 'updated',
    reason: `Your logged swim/bike/run volume over the last 4 weeks is ${direction} ${TIER_LABEL[derivedLevel]} than your original ${TIER_LABEL[baselineLevel]} self-assessment - the projection below uses ${TIER_LABEL[derivedLevel]}.`,
  }
}
