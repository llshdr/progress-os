'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Target, Milestone, Plus, CheckCircle2, Archive, RotateCcw, Trash2 } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import {
  fetchActiveActionItems,
  sortActionItems,
  daysBetween,
  goalCompletionRate,
  type ActionItem,
  type ActionItemStatus,
} from '@/lib/goals'
import { getLocalDateString } from '@/lib/date'
import { PageSkeleton } from '@/components/ui/page-skeleton'

export default function GoalsPage() {
  const [items, setItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<ActionItem | null>(null)
  const [linkedMilestoneCount, setLinkedMilestoneCount] = useState(0)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  // Independent of the showAll toggle - the completion-rate summary always
  // reflects every goal regardless of which subset is currently listed
  // below it.
  const [goalStatuses, setGoalStatuses] = useState<ActionItemStatus[]>([])
  // Keyed by goal id, only present when that goal's depends_on_goal_id
  // points at a prerequisite that isn't done yet - derived fresh from
  // current data every fetch, never a separately-stored "blocked" flag.
  const [blockedInfo, setBlockedInfo] = useState<Map<string, string>>(new Map())
  const supabase = createClient()

  useEffect(() => {
    fetchItems()
  }, [showAll])

  useEffect(() => {
    fetchGoalStatuses()
  }, [])

  // Separate from fetchItems - a lightweight lookup kept out of the
  // shared fetchActiveActionItems/ActionItem shape (used by the
  // dashboard and Today panel too), so this list-only feature doesn't
  // widen that shared contract.
  useEffect(() => {
    fetchBlockedInfo()
  }, [items])

  const fetchBlockedInfo = async () => {
    const goalIds = items.filter((i) => i.kind === 'goal').map((i) => i.id)
    if (goalIds.length === 0) {
      setBlockedInfo(new Map())
      return
    }

    const { data: goalsWithDeps } = await supabase.from('goals').select('id, depends_on_goal_id').in('id', goalIds).not('depends_on_goal_id', 'is', null)
    const prereqIds = Array.from(new Set((goalsWithDeps ?? []).map((g) => g.depends_on_goal_id as string)))
    if (prereqIds.length === 0) {
      setBlockedInfo(new Map())
      return
    }

    const { data: prereqs } = await supabase.from('goals').select('id, title, status').in('id', prereqIds)
    const prereqById = new Map((prereqs ?? []).map((p) => [p.id, p]))

    const next = new Map<string, string>()
    for (const g of goalsWithDeps ?? []) {
      const prereq = prereqById.get(g.depends_on_goal_id as string)
      if (prereq && prereq.status !== 'done') next.set(g.id, prereq.title)
    }
    setBlockedInfo(next)
  }

  const fetchGoalStatuses = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('goals').select('status').eq('user_id', user.id)
    setGoalStatuses((data ?? []).map((g) => g.status as ActionItemStatus))
  }

  // "Show done/archived" swaps between the default urgency-sorted active
  // view (fetchActiveActionItems, unchanged - shared with the dashboard/
  // Today suggestions) and a manage view showing every goal regardless of
  // status plus only *standalone* milestones (goal_id null) - goal-linked
  // milestones of any status are managed from their parent goal's detail
  // page instead, never duplicated as top-level rows here.
  const fetchItems = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    if (!showAll) {
      const active = await fetchActiveActionItems(supabase, user.id)
      setItems(active)
      setLoading(false)
      return
    }

    const [{ data: goals }, { data: milestones }] = await Promise.all([
      supabase
        .from('goals')
        .select('id, title, next_action, target_date, updated_at, status, auto_block_before_deadline')
        .eq('user_id', user.id),
      supabase
        .from('milestones')
        .select('id, title, next_action, due_date, updated_at, status, auto_block_before_deadline')
        .eq('user_id', user.id)
        .is('goal_id', null),
    ])

    const rows: ActionItem[] = [
      ...(goals ?? []).map((g) => ({
        id: g.id as string,
        kind: 'goal' as const,
        title: g.title as string,
        nextAction: g.next_action as string | null,
        targetDate: g.target_date as string | null,
        updatedAt: g.updated_at as string,
        status: g.status as ActionItemStatus,
        editHref: `/goals/${g.id}`,
        autoBlockBeforeDeadline: g.auto_block_before_deadline ?? false,
      })),
      ...(milestones ?? []).map((m) => ({
        id: m.id as string,
        kind: 'milestone' as const,
        title: m.title as string,
        nextAction: m.next_action as string | null,
        targetDate: m.due_date as string | null,
        updatedAt: m.updated_at as string,
        status: m.status as ActionItemStatus,
        editHref: `/goals/milestones/${m.id}/edit`,
        autoBlockBeforeDeadline: m.auto_block_before_deadline ?? false,
      })),
    ]

    setItems(sortActionItems(rows))
    setLoading(false)
  }

  const setStatus = async (item: ActionItem, status: ActionItemStatus) => {
    const table = item.kind === 'goal' ? 'goals' : 'milestones'
    const { error } = await supabase.from(table).update({ status }).eq('id', item.id)

    if (error) {
      console.error(`Error updating ${item.kind} status:`, error)
    } else {
      fetchItems()
      if (item.kind === 'goal') fetchGoalStatuses()
    }
  }

  const openDeleteModal = async (item: ActionItem) => {
    if (item.kind === 'goal') {
      const { count } = await supabase
        .from('milestones')
        .select('id', { count: 'exact', head: true })
        .eq('goal_id', item.id)
      setLinkedMilestoneCount(count ?? 0)
    } else {
      setLinkedMilestoneCount(0)
    }
    setItemToDelete(item)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return

    const table = itemToDelete.kind === 'goal' ? 'goals' : 'milestones'
    const { error } = await supabase.from(table).delete().eq('id', itemToDelete.id)

    if (error) {
      console.error(`Error deleting ${itemToDelete.kind}:`, error)
    } else {
      fetchItems()
      if (itemToDelete.kind === 'goal') fetchGoalStatuses()
    }
    setItemToDelete(null)
  }

  const today = getLocalDateString()
  const completionRate = goalCompletionRate(goalStatuses)
  const doneGoalCount = goalStatuses.filter((s) => s === 'done').length
  const resolvedGoalCount = goalStatuses.filter((s) => s === 'done' || s === 'archived').length

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lapis-lg bg-lapis-surface-2 border border-lapis-border-subtle">
              <Target className="w-8 h-8 text-lapis-text-secondary" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">Goals</h1>
              <p className="text-lapis-text-tertiary text-sm">Your single next move on what matters most</p>
              {/* /gym/goals is now just a this-week, quick_win-scoped view
                  of this same table (see migration 070) - a genuinely
                  useful filtered view, not a separate system anymore. */}
              <Link href="/gym/goals" className="text-lapis-text-disabled hover:text-lapis-text-tertiary text-xs underline underline-offset-2">
                This week's quick-win goals →
              </Link>
              <Link href="/goals/archived" className="block text-lapis-text-disabled hover:text-lapis-text-tertiary text-xs underline underline-offset-2">
                Archived goals →
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/goals/new">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lapis-md bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 transition-colors">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Goal</span>
              </button>
            </Link>
            <Link href="/goals/milestones/new">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lapis-md border border-lapis-border-subtle text-lapis-text-secondary hover:bg-lapis-surface-2 transition-colors text-sm">
                <Plus className="w-4 h-4" />
                Add Milestone
              </button>
            </Link>
          </div>
        </div>

        {/* Same completion-rate math (done/(done+archived), goals only)
            recompute_user_rank already uses server-side for the rank tier -
            shown here so it's never a mystery number that only shows up as
            a tier label on Profile. */}
        {completionRate != null && (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-6">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-sm text-lapis-text-secondary">Goal completion rate</p>
              <p className="text-lapis-text-tertiary text-xs">
                {doneGoalCount} of {resolvedGoalCount} resolved goal{resolvedGoalCount === 1 ? '' : 's'} done
              </p>
            </div>
            <div className="w-full bg-lapis-surface-3 rounded-full h-2">
              <div
                className="bg-lapis-accent-500 rounded-full h-2 transition-all duration-300"
                style={{ width: `${Math.round(completionRate * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="mb-8">
          <button
            onClick={() => setShowAll(!showAll)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lapis-sm transition-colors ${
              showAll ? 'bg-lapis-surface-2 text-lapis-text-primary border-lapis-border-strong' : 'bg-lapis-surface-2 text-lapis-text-secondary border-lapis-border-subtle'
            } border`}
          >
            <span className="text-sm">Show done/archived</span>
          </button>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : items.length === 0 ? (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
            <Target className="w-10 h-10 text-lapis-text-disabled mx-auto mb-4" />
            <p className="text-lapis-text-tertiary mb-4">No active goals or milestones yet</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/goals/new">
                <button className="px-4 py-2 rounded-lapis-sm border border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 transition-colors">
                  Add a goal
                </button>
              </Link>
              <Link href="/goals/milestones/new">
                <button className="px-4 py-2 rounded-lapis-sm border border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 transition-colors">
                  Add a milestone
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => {
              const daysUntilDue = item.targetDate ? daysBetween(item.targetDate, today) : null
              const daysSinceTouched = daysBetween(today, item.updatedAt.slice(0, 10))

              return (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {showAll && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle">
                            {item.status}
                          </span>
                        )}
                        {daysUntilDue != null && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle">
                            {daysUntilDue < 0
                              ? `${Math.abs(daysUntilDue)}d overdue`
                              : daysUntilDue === 0
                                ? 'Due today'
                                : `Due in ${daysUntilDue}d`}
                          </span>
                        )}
                        {daysSinceTouched >= 7 && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle">
                            Untouched {daysSinceTouched}d
                          </span>
                        )}
                        {item.kind === 'goal' && blockedInfo.has(item.id) && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-strong">
                            Blocked: {blockedInfo.get(item.id)}
                          </span>
                        )}
                      </div>
                      <Link
                        href={item.editHref}
                        className="text-lg font-medium text-lapis-text-primary hover:text-lapis-text-secondary inline-flex items-center gap-2"
                      >
                        {item.kind === 'goal' ? (
                          <Target className="w-4 h-4 text-lapis-text-disabled shrink-0" />
                        ) : (
                          <Milestone className="w-4 h-4 text-lapis-text-disabled shrink-0" />
                        )}
                        {item.title}
                      </Link>
                      <p className="text-lapis-text-primary text-sm mt-1.5">
                        {item.nextAction || <span className="text-lapis-text-disabled italic">No next step set</span>}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {item.status === 'active' ? (
                        <>
                          <button
                            onClick={() => setStatus(item, 'done')}
                            className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                            title="Mark done"
                          >
                            <CheckCircle2 className="w-5 h-5 text-lapis-text-tertiary" />
                          </button>
                          <button
                            onClick={() => setStatus(item, 'archived')}
                            className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                            title="Archive"
                          >
                            <Archive className="w-5 h-5 text-lapis-text-tertiary" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setStatus(item, 'active')}
                          className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                          title="Reactivate"
                        >
                          <RotateCcw className="w-5 h-5 text-lapis-text-tertiary" />
                        </button>
                      )}
                      <button
                        onClick={() => openDeleteModal(item)}
                        className="p-2 rounded-lapis-sm opacity-40 hover:opacity-100 hover:bg-lapis-surface-2 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5 text-lapis-text-tertiary" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={(open) => {
          setShowDeleteModal(open)
          if (!open) setItemToDelete(null)
        }}
        title={itemToDelete?.kind === 'goal' ? 'Delete Goal' : 'Delete Milestone'}
        description={
          itemToDelete?.kind === 'goal' && linkedMilestoneCount > 0
            ? `This permanently deletes this goal and its ${linkedMilestoneCount} linked milestone${
                linkedMilestoneCount === 1 ? '' : 's'
              }. This cannot be undone.`
            : `Are you sure you want to delete this ${itemToDelete?.kind ?? 'item'}? This cannot be undone.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        destructive
      />
    </AppLayout>
  )
}
