import type { SupabaseClient } from '@supabase/supabase-js'
import type { SuggestionCandidate } from './types'
import { fetchActiveActionItems, daysBetween } from '@/lib/projects'
import { getLocalDateString } from '@/lib/date'

const STALE_DAYS = 7

// Deterministic, real (non-hallucinated) candidate for the projects module.
// Surfaces at most one candidate - the single most-overdue-or-stalled active
// goal/project (same sort as the actionmaxxing dashboard) - and only if it
// actually has a next action set and is overdue or stalled. Nothing to
// suggest otherwise.
export async function getProjectsSuggestionCandidates(
  supabase: SupabaseClient,
  userId: string
): Promise<SuggestionCandidate[]> {
  const items = await fetchActiveActionItems(supabase, userId)
  const top = items[0]
  if (!top || !top.nextAction) return []

  const today = getLocalDateString()
  const daysOverdue = top.targetDate ? daysBetween(today, top.targetDate) : null
  const daysSinceTouched = daysBetween(today, top.updatedAt.slice(0, 10))

  const isOverdue = daysOverdue != null && daysOverdue > 0
  const isStalled = daysSinceTouched >= STALE_DAYS
  if (!isOverdue && !isStalled) return []

  const label = top.kind === 'goal' ? 'goal' : 'project'
  const text = isOverdue
    ? `Your ${label} "${top.title}" was due ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} ago — next action: ${top.nextAction}.`
    : `Your ${label} "${top.title}" hasn't been touched in ${daysSinceTouched} days — next action: ${top.nextAction}.`

  return [
    {
      module: 'projects',
      text,
      action: { label: 'View', href: top.editHref },
    },
  ]
}
