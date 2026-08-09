import type { GoalScope } from '@/lib/goals'
import { getLocalDateString, getLocalWeekStart } from '@/lib/date'

// Single source of truth for tier display - deliberately plain numbering
// (Tier I-V), not fantasy/game-style names or icons, matching the
// non-gamified feel the rank system is meant to have.
export const RANK_TIER_LABELS: Record<number, string> = {
  1: 'Tier I',
  2: 'Tier II',
  3: 'Tier III',
  4: 'Tier IV',
  5: 'Tier V',
}

export function rankTierLabel(rank: number): string {
  return RANK_TIER_LABELS[rank] ?? `Tier ${rank}`
}

export const SCOPE_LABELS: Record<GoalScope, string> = {
  quick_win: 'Quick win',
  milestone: 'Milestone',
  long_term: 'Long-term',
}

// ─── Rank breakdown (client-side mirror of recompute_user_rank) ──────────
// Mirrors the exact tier thresholds in migration 042's recompute_user_rank
// SQL function, so a user can see WHY their rank is what it is instead of
// just a bare tier label. This is an ESTIMATE, not a guaranteed byte-exact
// mirror: the SQL buckets weeks via Postgres's date_trunc('week', ...) in
// the database's session timezone, while this walks weeks via
// getLocalWeekStart (the browser's local time) - the two can disagree by
// a day right at a week boundary. Close enough for "roughly why," not
// meant to be gamed against or treated as the literal source of truth
// (recompute_user_rank remains that).

export type ModuleName = 'goals' | 'gym' | 'nutrition'

export interface ModuleBreakdown {
  tier: number
  consistencyWeeks: number
  nextTierWeeksNeeded: number | null // null = already at Tier 5 for this module
}

// Mirrors migration 076's progression_signals_strong/progression_bonus -
// a QUALITY dimension alongside the consistency-only tiers above ("are
// you executing your own plan well," never a cross-user comparison).
// Each signal is self-referential (races/gym compare this user only to
// their own recent baseline; goals reuses the same done_count/
// completionRate already shown above, no new column needed for that
// one). Raw signal values ARE shown here - this is the owner's own
// transparency view of their own private numbers, the same trust
// boundary user_settings already has everywhere else, not a leak to
// other users (who only ever see the resulting coarse rank tier).
export interface ProgressionBreakdown {
  racesSignal: number | null
  gymSignal: number | null
  goalsStrong: boolean
  racesStrong: boolean
  gymStrong: boolean
  signalsStrong: number
  bonus: number
}

export interface RankBreakdown {
  goals: ModuleBreakdown & { completionRate: number | null; capTier: number; doneCount: number }
  gym: ModuleBreakdown
  nutrition: ModuleBreakdown
  baseTier: number
  activeModules: number
  progression: ProgressionBreakdown
  finalTier: number
  drivingModule: ModuleName // whichever module's tier equals baseTier (first match: goals, gym, nutrition)
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

// Same 4-cutoff shape gym_tier/nutrition_tier both use in the SQL
// (>=8, >=6, >=3, >=1) - identical breakpoints for both, per migration 042.
function consistencyTier(weeks: number): number {
  if (weeks >= 8) return 5
  if (weeks >= 6) return 4
  if (weeks >= 3) return 3
  if (weeks >= 1) return 2
  return 1
}

function weeksUntilNextConsistencyTier(weeks: number): number | null {
  const thresholds = [1, 3, 6, 8]
  const next = thresholds.find((t) => t > weeks)
  return next == null ? null : next - weeks
}

// Distinct Monday-start week buckets among the given dates, restricted to
// the last 90 days - the local-time equivalent of the SQL's
// COUNT(DISTINCT date_trunc('week', ts)) WHERE ts > NOW() - INTERVAL '90 days'.
function countConsistencyWeeks(dates: string[], now: Date): number {
  const cutoff = now.getTime() - NINETY_DAYS_MS
  const buckets = new Set<string>()
  for (const d of dates) {
    const parsed = new Date(d)
    if (parsed.getTime() <= cutoff) continue
    buckets.add(getLocalDateString(getLocalWeekStart(parsed)))
  }
  return buckets.size
}

export function computeRankBreakdown(
  goals: { createdAt: string; updatedAt: string; status: 'active' | 'done' | 'archived'; scope: GoalScope | null }[],
  gymCompletedDates: string[],
  nutritionDates: string[],
  racesProgressionSignal: number | null = null,
  gymProgressionSignal: number | null = null
): RankBreakdown {
  const now = new Date()

  const doneCount = goals.filter((g) => g.status === 'done').length
  const archivedCount = goals.filter((g) => g.status === 'archived').length
  const completionRate = doneCount + archivedCount === 0 ? null : doneCount / (doneCount + archivedCount)

  const goalConsistencyWeeks = countConsistencyWeeks(goals.flatMap((g) => [g.createdAt, g.updatedAt]), now)

  const goalBaseTier =
    doneCount >= 3 && (completionRate ?? 0) >= 0.7 && goalConsistencyWeeks >= 6
      ? 5
      : doneCount >= 2 && (completionRate ?? 0) >= 0.6 && goalConsistencyWeeks >= 4
        ? 4
        : doneCount >= 1 && (completionRate ?? 0) >= 0.5 && goalConsistencyWeeks >= 2
          ? 3
          : doneCount >= 1 || goalConsistencyWeeks >= 1
            ? 2
            : 1

  const hasLongTerm = goals.some((g) => g.scope === 'long_term' && (g.status === 'done' || g.status === 'active'))
  const hasMilestone = goals.some((g) => g.scope === 'milestone' && (g.status === 'done' || g.status === 'active'))
  const goalCapTier = hasLongTerm ? 5 : hasMilestone ? 4 : 2
  const goalTier = Math.min(goalBaseTier, goalCapTier)

  const gymConsistencyWeeks = countConsistencyWeeks(gymCompletedDates, now)
  const gymTier = consistencyTier(gymConsistencyWeeks)

  const nutritionConsistencyWeeks = countConsistencyWeeks(nutritionDates, now)
  const nutritionTier = consistencyTier(nutritionConsistencyWeeks)

  const baseTier = Math.max(goalTier, gymTier, nutritionTier)
  const activeModules =
    (goalConsistencyWeeks >= 2 ? 1 : 0) + (gymConsistencyWeeks >= 2 ? 1 : 0) + (nutritionConsistencyWeeks >= 2 ? 1 : 0)

  // Same thresholds as migration 076's progression_signals_strong -
  // goals reuses doneCount/completionRate already computed above rather
  // than a new signal, races/gym read the private ratios passed in.
  const goalsStrong = doneCount >= 2 && (completionRate ?? 0) >= 0.7
  const racesStrong = racesProgressionSignal != null && racesProgressionSignal >= 0.7
  const gymStrong = gymProgressionSignal != null && gymProgressionSignal >= 0.6
  const signalsStrong = [goalsStrong, racesStrong, gymStrong].filter(Boolean).length
  const progressionBonus = signalsStrong >= 2 ? 1 : 0

  const finalTier = Math.min(5, baseTier + (activeModules >= 2 ? 1 : 0) + progressionBonus)

  const drivingModule: ModuleName = goalTier === baseTier ? 'goals' : gymTier === baseTier ? 'gym' : 'nutrition'

  return {
    // No nextTierWeeksNeeded for goals: unlike gym/nutrition, goal_base_tier
    // gates on done count AND completion rate AND weeks simultaneously - a
    // single "N more weeks" number would imply weeks alone gets there,
    // which usually isn't true. UI shows the raw numbers next to each
    // tier's real requirements instead of asserting a derived claim.
    goals: {
      tier: goalTier,
      consistencyWeeks: goalConsistencyWeeks,
      nextTierWeeksNeeded: null,
      completionRate,
      capTier: goalCapTier,
      doneCount,
    },
    gym: { tier: gymTier, consistencyWeeks: gymConsistencyWeeks, nextTierWeeksNeeded: weeksUntilNextConsistencyTier(gymConsistencyWeeks) },
    nutrition: {
      tier: nutritionTier,
      consistencyWeeks: nutritionConsistencyWeeks,
      nextTierWeeksNeeded: weeksUntilNextConsistencyTier(nutritionConsistencyWeeks),
    },
    baseTier,
    activeModules,
    progression: {
      racesSignal: racesProgressionSignal,
      gymSignal: gymProgressionSignal,
      goalsStrong,
      racesStrong,
      gymStrong,
      signalsStrong,
      bonus: progressionBonus,
    },
    finalTier,
    drivingModule,
  }
}
