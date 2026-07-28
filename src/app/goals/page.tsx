'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Target, Plus, CheckCircle2, Archive, RotateCcw, Trash2 } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import {
  fetchActiveActionItems,
  sortActionItems,
  daysBetween,
  type ActionItem,
  type ActionItemStatus,
} from '@/lib/goals'
import { getLocalDateString } from '@/lib/date'

export default function GoalsPage() {
  const [items, setItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<ActionItem | null>(null)
  const [linkedMilestoneCount, setLinkedMilestoneCount] = useState(0)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchItems()
  }, [showAll])

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
        .select('id, title, next_action, target_date, updated_at, status')
        .eq('user_id', user.id),
      supabase
        .from('milestones')
        .select('id, title, next_action, due_date, updated_at, status')
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
    }
    setItemToDelete(null)
  }

  const today = getLocalDateString()

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <Target className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Goals</h1>
              <p className="text-white/50 text-sm">Your single next move on what matters most</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/goals/new">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Goal</span>
              </button>
            </Link>
            <Link href="/goals/milestones/new">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm">
                <Plus className="w-4 h-4" />
                Add Milestone
              </button>
            </Link>
          </div>
        </div>

        <div className="mb-8">
          <button
            onClick={() => setShowAll(!showAll)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showAll ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-white/60 border-white/10'
            } border`}
          >
            <span className="text-sm">Show done/archived</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-white/40">Loading...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40 mb-4">No active goals or milestones yet</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/goals/new">
                <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors">
                  Add a goal
                </button>
              </Link>
              <Link href="/goals/milestones/new">
                <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors">
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
                  className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                          {item.kind === 'goal' ? 'Goal' : 'Milestone'}
                        </span>
                        {showAll && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                            {item.status}
                          </span>
                        )}
                        {daysUntilDue != null && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                            {daysUntilDue < 0
                              ? `${Math.abs(daysUntilDue)}d overdue`
                              : daysUntilDue === 0
                                ? 'Due today'
                                : `Due in ${daysUntilDue}d`}
                          </span>
                        )}
                        {daysSinceTouched >= 7 && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                            Untouched {daysSinceTouched}d
                          </span>
                        )}
                      </div>
                      <Link href={item.editHref} className="text-lg font-medium text-white hover:text-white/80">
                        {item.title}
                      </Link>
                      <p className="text-white/70 text-sm mt-1">
                        <span className="text-white/40">Next: </span>
                        {item.nextAction || <span className="text-white/30 italic">not set</span>}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {item.status === 'active' ? (
                        <>
                          <button
                            onClick={() => setStatus(item, 'done')}
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                            title="Mark done"
                          >
                            <CheckCircle2 className="w-5 h-5 text-white/40" />
                          </button>
                          <button
                            onClick={() => setStatus(item, 'archived')}
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                            title="Archive"
                          >
                            <Archive className="w-5 h-5 text-white/40" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setStatus(item, 'active')}
                          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                          title="Reactivate"
                        >
                          <RotateCcw className="w-5 h-5 text-white/40" />
                        </button>
                      )}
                      <button
                        onClick={() => openDeleteModal(item)}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5 text-white/40" />
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
