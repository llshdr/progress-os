import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCardioActivity, bucketWeeklyCardioDistance, type CardioActivity } from '@/lib/cardio-stats'
import type { Discipline, MultisportSelfAssessment } from '@/lib/race-plan/self-assessment'

export interface DisciplineActivityFacts {
  weeksActiveOf8: number
  recentAvgWeeklyKm: number
  longestSessionKm: number
}

const DISCIPLINE_KEYWORDS: Record<Discipline, string[]> = {
  swim: ['swim'],
  bike: ['bike', 'cycle', 'cycling', 'spin'],
  run: ['run', 'jog'],
}

function classifyDiscipline(exerciseName: string): Discipline | null {
  const lower = exerciseName.toLowerCase()
  for (const discipline of ['swim', 'bike', 'run'] as Discipline[]) {
    if (DISCIPLINE_KEYWORDS[discipline].some((keyword) => lower.includes(keyword))) return discipline
  }
  return null
}

// Best-effort keyword match against fetchCardioActivity()'s exercise
// names - a real but conditional signal that degrades gracefully (an
// unclassifiable exercise just isn't counted toward any discipline,
// rather than the whole thing failing) when a user's library doesn't
// name swim/bike/run distinctly.
export async function computeDisciplineActivityFacts(supabase: SupabaseClient): Promise<Record<Discipline, DisciplineActivityFacts>> {
  const activities = await fetchCardioActivity(supabase)
  const byDiscipline: Record<Discipline, CardioActivity[]> = { swim: [], bike: [], run: [] }

  for (const activity of activities) {
    const discipline = classifyDiscipline(activity.exerciseName)
    if (discipline) byDiscipline[discipline].push(activity)
  }

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
  const result = {} as Record<Discipline, DisciplineActivityFacts>

  for (const discipline of ['swim', 'bike', 'run'] as Discipline[]) {
    const activitiesForDiscipline = byDiscipline[discipline]
    const weeklyBuckets = bucketWeeklyCardioDistance(activitiesForDiscipline, 8)
    const recent = activitiesForDiscipline.filter((a) => new Date(a.date) >= fourWeeksAgo)

    result[discipline] = {
      weeksActiveOf8: weeklyBuckets.filter((w) => w.totalKm > 0).length,
      recentAvgWeeklyKm: recent.reduce((sum, a) => sum + a.distanceKm, 0) / 4,
      longestSessionKm: activitiesForDiscipline.reduce((max, a) => Math.max(max, a.distanceKm), 0),
    }
  }

  return result
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

// Fixed weighting by rank position, not a continuous function of score -
// simple and predictable, same "simple, explainable" ethos as
// periodization.ts's phase-allocation proportions.
const RANK_WEIGHTS = [0.45, 0.35, 0.2]

export function disciplineWeightsFromRanking(ranking: DisciplineRanking): Record<Discipline, number> {
  const weights = {} as Record<Discipline, number>
  ranking.order.forEach((discipline, i) => {
    weights[discipline] = RANK_WEIGHTS[i]
  })
  return weights
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
