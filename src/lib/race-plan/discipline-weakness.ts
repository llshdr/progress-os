import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCardioActivity, bucketWeeklyCardioDistance, averagePace, splitRecentAndPriorActivity, type CardioActivity } from '@/lib/cardio-stats'
import type { Discipline, MultisportSelfAssessment } from '@/lib/race-plan/self-assessment'
import type { CardioType } from '@/lib/exercise-constants'

export interface DisciplineActivityFacts {
  weeksActiveOf8: number
  recentAvgWeeklyKm: number
  longestSessionKm: number
  // Last 4 weeks / the 4 weeks before that, this discipline only - see
  // describePaceTrend below for turning the pair into a trend.
  avgPaceSecPerKmRecent: number | null
  avgPaceSecPerKmPrior: number | null
}

const DISCIPLINE_KEYWORDS: Record<Discipline, string[]> = {
  swim: ['swim'],
  bike: ['bike', 'cycle', 'cycling', 'spin'],
  run: ['run', 'jog'],
}

// Only 3 of the 10 cardio_type values map onto a triathlon discipline -
// rowing/elliptical/stair_climber/jump_rope/hiking/walking/other have no
// Ironman-discipline equivalent and correctly fall through to null here,
// same as they always have via the keyword fallback below.
const CARDIO_TYPE_TO_DISCIPLINE: Partial<Record<CardioType, Discipline>> = {
  running: 'run',
  cycling: 'bike',
  swimming: 'swim',
}

// Exported so analyze-fitness.ts can filter its own aggregate activity
// list down to running specifically before computing pace - mixing
// swim/bike/run paces into one average is meaningless (different units
// entirely), which is exactly the bug that classification here fixes.
//
// cardioType (from the exercise's own real taxonomy field, see
// exercise-constants.ts) is preferred when present - a real signal, not a
// guess. Falls back to the original name-keyword match for exercises that
// predate the taxonomy or are tagged 'other' - never a regression for
// existing data, same "new signal takes priority, old path never breaks"
// precedent as resolveRealZone2Pace/resolveEasyPaceBaseline elsewhere in
// this feature.
export function classifyDiscipline(exerciseName: string, cardioType?: string | null): Discipline | null {
  if (cardioType && cardioType in CARDIO_TYPE_TO_DISCIPLINE) {
    return CARDIO_TYPE_TO_DISCIPLINE[cardioType as CardioType] ?? null
  }

  const lower = exerciseName.toLowerCase()
  for (const discipline of ['swim', 'bike', 'run'] as Discipline[]) {
    if (DISCIPLINE_KEYWORDS[discipline].some((keyword) => lower.includes(keyword))) return discipline
  }
  return null
}

// Best-effort classification against fetchCardioActivity()'s activities -
// a real signal when cardioType is set, degrading gracefully to a
// name-keyword guess (and then to "unclassified, not counted toward any
// discipline") when it isn't, rather than the whole thing failing.
export async function computeDisciplineActivityFacts(supabase: SupabaseClient): Promise<Record<Discipline, DisciplineActivityFacts>> {
  // Commute rides excluded - this feeds deriveCurrentFormLevel's tier
  // re-derivation and disciplineBaselineKm's Base-phase starting volume
  // (periodization.ts), and a guaranteed transportation ride is not a
  // fitness signal - counting it here could silently promote someone to
  // a higher effective tier (or inflate their Base-phase starting
  // volume) purely from commuting, not real training. Declared commute
  // volume is instead subtracted from prescribed bike km directly (see
  // DisciplineRampInputs.commuteBikeKmPerWeek) - a separate, deliberate
  // input, not derived from these logs.
  const activities = (await fetchCardioActivity(supabase)).filter((a) => a.source !== 'commute')
  const byDiscipline: Record<Discipline, CardioActivity[]> = { swim: [], bike: [], run: [] }

  for (const activity of activities) {
    const discipline = classifyDiscipline(activity.exerciseName, activity.cardioType)
    if (discipline) byDiscipline[discipline].push(activity)
  }

  const result = {} as Record<Discipline, DisciplineActivityFacts>

  for (const discipline of ['swim', 'bike', 'run'] as Discipline[]) {
    const activitiesForDiscipline = byDiscipline[discipline]
    const weeklyBuckets = bucketWeeklyCardioDistance(activitiesForDiscipline, 8)
    const { recent, prior } = splitRecentAndPriorActivity(activitiesForDiscipline)

    result[discipline] = {
      weeksActiveOf8: weeklyBuckets.filter((w) => w.totalKm > 0).length,
      recentAvgWeeklyKm: recent.reduce((sum, a) => sum + a.distanceKm, 0) / 4,
      longestSessionKm: activitiesForDiscipline.reduce((max, a) => Math.max(max, a.distanceKm), 0),
      avgPaceSecPerKmRecent: averagePace(recent),
      avgPaceSecPerKmPrior: averagePace(prior),
    }
  }

  return result
}

export type PaceTrend = 'improving' | 'flat' | 'declining' | 'insufficient_data'

// Lower sec/km is FASTER, so "improving" means the ratio dropped - the
// inverse of the raw-number direction, unlike a typical up/down trend.
// Same +-5% flat-band shape as computeStrengthFacts' 1RM trend logic
// (analyze-fitness.ts), just applied to pace instead of estimated 1RM.
export function describePaceTrend(recentSecPerKm: number | null, priorSecPerKm: number | null): PaceTrend {
  if (recentSecPerKm == null || priorSecPerKm == null) return 'insufficient_data'
  const ratio = recentSecPerKm / priorSecPerKm
  if (ratio < 0.95) return 'improving'
  if (ratio > 1.05) return 'declining'
  return 'flat'
}

export interface DisciplineRanking {
  order: Discipline[] // weakest first
}

// Self-reported comfort is the primary signal (weighted 2-10 across the
// 1-5 scale), real logged weekly activity/longest-session a secondary
// adjustment (up to +4 / +3) - never a raw fabricated score shown to the
// user, just a strict weakest->strongest order.
function scoreDiscipline(comfortLevel: number | null, facts: DisciplineActivityFacts): number {
  const comfortScore = (comfortLevel ?? 3) * 2
  const activityScore = Math.min(facts.weeksActiveOf8, 8) * 0.5
  const sessionScore = Math.min(facts.longestSessionKm / 10, 3)
  return comfortScore + activityScore + sessionScore
}

export function rankDisciplines(
  assessment: MultisportSelfAssessment,
  activityFacts: Record<Discipline, DisciplineActivityFacts>
): DisciplineRanking {
  const scores: Record<Discipline, number> = {
    swim: scoreDiscipline(assessment.swim.comfortLevel, activityFacts.swim),
    bike: scoreDiscipline(assessment.bike.comfortLevel, activityFacts.bike),
    run: scoreDiscipline(assessment.run.comfortLevel, activityFacts.run),
  }
  const order = (['swim', 'bike', 'run'] as Discipline[]).sort((a, b) => scores[a] - scores[b])
  return { order }
}

// Basic, data-only readiness flag - no course data yet (that's Phase 2),
// so this is purely "is there any recent activity at all for a
// discipline with limited time left," not a time-based projection.
export function assessMultisportReadiness(activityFacts: Record<Discipline, DisciplineActivityFacts>, daysUntilRace: number): string[] {
  const flags: string[] = []
  for (const discipline of ['swim', 'bike', 'run'] as Discipline[]) {
    if (activityFacts[discipline].weeksActiveOf8 === 0 && daysUntilRace < 84) {
      const weeksUntil = Math.max(1, Math.round(daysUntilRace / 7))
      flags.push(
        `No logged ${discipline} activity in the last 8 weeks, and the race is only ${weeksUntil} week(s) away — ${discipline} readiness is a real risk worth taking seriously.`
      )
    }
  }
  return flags
}
