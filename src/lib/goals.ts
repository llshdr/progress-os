import type { SupabaseClient } from '@supabase/supabase-js'

export type ActionItemStatus = 'active' | 'done' | 'archived'

export type GoalScope = 'quick_win' | 'milestone' | 'long_term'

export interface ActionItem {
  id: string
  kind: 'goal' | 'milestone'
  title: string
  nextAction: string | null
  targetDate: string | null
  updatedAt: string
  status: ActionItemStatus
  editHref: string
}

// Nearest date first (a goal's target_date, or a milestone's due_date) -
// everything else falls back to longest-untouched first, using updated_at
// (the "last touched" signal) ascending.
export function sortActionItems(items: ActionItem[]): ActionItem[] {
  const withDate = items
    .filter((item) => item.targetDate)
    .sort((a, b) => new Date(a.targetDate!).getTime() - new Date(b.targetDate!).getTime())
  const withoutDate = items
    .filter((item) => !item.targetDate)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
  return [...withDate, ...withoutDate]
}

// Whole-day difference, `a - b`, using calendar dates (not timestamps) so a
// few hours' difference near midnight never off-by-ones the count.
export function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / msPerDay)
}

// Single source of truth for "active goals + milestones, combined and
// sorted" - reused by the actionmaxxing dashboard and the Today panel
// candidate. Deliberately returns every active milestone regardless of
// whether it's linked to a goal - a goal-linked milestone still surfaces
// here when it's genuinely the most urgent thing, linking to its parent
// goal's detail page (where it's actually managed) rather than a
// dedicated milestone page; a standalone milestone links to its own edit
// page, since it has no goal page to live on.
export async function fetchActiveActionItems(supabase: SupabaseClient, userId: string): Promise<ActionItem[]> {
  const { data: goals } = await supabase
    .from('goals')
    .select('id, title, next_action, target_date, updated_at')
    .eq('user_id', userId)
    .eq('status', 'active')

  const { data: milestones } = await supabase
    .from('milestones')
    .select('id, title, next_action, due_date, updated_at, goal_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  const items: ActionItem[] = [
    ...(goals ?? []).map((g: any) => ({
      id: g.id as string,
      kind: 'goal' as const,
      title: g.title as string,
      nextAction: g.next_action as string | null,
      targetDate: g.target_date as string | null,
      updatedAt: g.updated_at as string,
      status: 'active' as const,
      editHref: `/goals/${g.id}`,
    })),
    ...(milestones ?? []).map((m: any) => ({
      id: m.id as string,
      kind: 'milestone' as const,
      title: m.title as string,
      nextAction: m.next_action as string | null,
      targetDate: m.due_date as string | null,
      updatedAt: m.updated_at as string,
      status: 'active' as const,
      editHref: m.goal_id ? `/goals/${m.goal_id}` : `/goals/milestones/${m.id}/edit`,
    })),
  ]

  return sortActionItems(items)
}
