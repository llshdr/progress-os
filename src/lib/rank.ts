import type { GoalScope } from '@/lib/projects'

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
