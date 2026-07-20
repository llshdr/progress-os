import type { SupabaseClient } from '@supabase/supabase-js'

export type ActionItemStatus = 'active' | 'done' | 'archived'

export interface ActionItem {
  id: string
  kind: 'goal' | 'project'
  title: string
  nextAction: string | null
  targetDate: string | null
  updatedAt: string
  editHref: string
}

// Nearest target_date first (only goals carry one); everything else - every
// project, and any goal without a date - falls back to longest-untouched
// first, using updated_at (the "last touched" signal) ascending.
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

// Single source of truth for "active goals + projects, combined and sorted"
// - reused by the actionmaxxing dashboard and the Today panel candidate.
export async function fetchActiveActionItems(supabase: SupabaseClient, userId: string): Promise<ActionItem[]> {
  const { data: goals } = await supabase
    .from('goals')
    .select('id, title, next_action, target_date, updated_at')
    .eq('user_id', userId)
    .eq('status', 'active')

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, next_action, updated_at')
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
      editHref: `/projects/goals/${g.id}/edit`,
    })),
    ...(projects ?? []).map((p: any) => ({
      id: p.id as string,
      kind: 'project' as const,
      title: p.title as string,
      nextAction: p.next_action as string | null,
      targetDate: null,
      updatedAt: p.updated_at as string,
      editHref: `/projects/all/${p.id}/edit`,
    })),
  ]

  return sortActionItems(items)
}
