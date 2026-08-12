'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import Link from 'next/link'
import { getLocalWeekStartString } from '@/lib/date'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'
import { Target, CheckCircle2, Archive, RotateCcw, Trash2 } from 'lucide-react'
import type { ActionItemStatus } from '@/lib/goals'

type Goal = {
  id: string
  title: string
  description: string | null
  status: ActionItemStatus
}

// This week's quick-win goals - a target_date-filtered view of the main
// `goals` table (scope='quick_win'), not a separate table anymore.
// weekly_goals (migration 001) is fully retired: migration 070 copied its
// remaining 'fitness' rows into `goals`, completing what migration 024
// already did for the other three categories. No new weekly_goals row is
// ever written from here again.
function weekEndDate(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newGoal, setNewGoal] = useState({ title: '', description: '' })
  const [showDeleteGoalModal, setShowDeleteGoalModal] = useState(false)
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchGoals()
  }, [])

  const fetchGoals = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const weekStart = getLocalWeekStartString()
    const { data, error } = await supabase
      .from('goals')
      .select('id, title, description, status')
      .eq('user_id', user.id)
      .eq('scope', 'quick_win')
      .gte('target_date', weekStart)
      .lte('target_date', weekEndDate(weekStart))
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching goals:', error)
      setLoadError(true)
    } else {
      setGoals(data || [])
    }
    setLoading(false)
  }

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const weekStart = getLocalWeekStartString()
    const { error } = await supabase.from('goals').insert({
      user_id: user.id,
      title: newGoal.title,
      description: newGoal.description || null,
      status: 'active',
      scope: 'quick_win',
      start_date: weekStart,
      target_date: weekEndDate(weekStart),
    })

    if (error) {
      console.error('Error adding goal:', error)
    } else {
      setNewGoal({ title: '', description: '' })
      setIsDialogOpen(false)
      fetchGoals()
    }
  }

  const handleUpdateStatus = async (goalId: string, status: ActionItemStatus) => {
    const { error } = await supabase.from('goals').update({ status }).eq('id', goalId)

    if (error) {
      console.error('Error updating goal:', error)
    } else {
      fetchGoals()
    }
  }

  const handleDeleteGoal = async () => {
    if (!goalToDelete) return

    const { error } = await supabase.from('goals').delete().eq('id', goalToDelete)

    if (error) {
      console.error('Error deleting goal:', error)
    } else {
      fetchGoals()
    }
    setGoalToDelete(null)
  }

  const openDeleteGoalModal = (goalId: string) => {
    setGoalToDelete(goalId)
    setShowDeleteGoalModal(true)
  }

  if (loading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && <LoadErrorBanner message="Couldn't load this week's goals. Try refreshing." />}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/gym/progress" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors">
            ← Back
          </Link>
          <div className="flex-1" />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger>
              <Button className="bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 text-sm">
                Add Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-lapis-bg border-lapis-border-subtle text-lapis-text-primary">
              <DialogHeader>
                <DialogTitle>Add New Goal</DialogTitle>
                <DialogDescription className="text-lapis-text-tertiary">
                  Create a new goal for this week
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddGoal} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-lapis-text-secondary">Title</Label>
                  <Input
                    id="title"
                    value={newGoal.title}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, title: e.target.value })
                    }
                    required
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-lapis-text-secondary">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={newGoal.description}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, description: e.target.value })
                    }
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110"
                >
                  Add Goal
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 rounded-lapis-lg bg-lapis-surface-2 border border-lapis-border-subtle">
            <Target className="w-8 h-8 text-lapis-text-secondary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">
              Weekly Goals
            </h1>
            <p className="text-lapis-text-tertiary text-sm">
              {goals.filter((g) => g.status === 'done').length} of {goals.length} completed
            </p>
          </div>
        </div>

        {/* Same table as the main Goals module now (scope='quick_win',
            filtered to this week) - not a separate system anymore. */}
        <Link
          href="/goals"
          className="text-sm text-lapis-text-tertiary hover:text-lapis-text-secondary underline underline-offset-2 mb-6 inline-block"
        >
          See every goal, including longer-term ones, on the main Goals page →
        </Link>

        <div className="grid gap-3">
          {goals.length === 0 ? (
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
              <Target className="w-10 h-10 text-lapis-text-disabled mx-auto mb-4" />
              <p className="text-lapis-text-tertiary mb-4">No goals for this week yet</p>
              <Button
                onClick={() => setIsDialogOpen(true)}
                variant="outline"
                className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2"
              >
                Add your first goal
              </Button>
            </div>
          ) : (
            goals.map((goal) => (
              <div
                key={goal.id}
                className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-lapis-text-primary mb-1">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="text-lapis-text-tertiary text-sm">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  {/* Same mark-done/archive/reactivate icons the main Goals
                      page already uses - one status model now, one set of
                      actions for it. */}
                  <div className="flex gap-2 shrink-0">
                    {goal.status === 'active' ? (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(goal.id, 'done')}
                          className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                          title="Mark done"
                        >
                          <CheckCircle2 className="w-5 h-5 text-lapis-text-tertiary" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(goal.id, 'archived')}
                          className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                          title="Archive"
                        >
                          <Archive className="w-5 h-5 text-lapis-text-tertiary" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(goal.id, 'active')}
                        className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                        title="Reactivate"
                      >
                        <RotateCcw className="w-5 h-5 text-lapis-text-tertiary" />
                      </button>
                    )}
                    <button
                      onClick={() => openDeleteGoalModal(goal.id)}
                      className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 text-lapis-text-tertiary" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Goal Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteGoalModal}
        onOpenChange={setShowDeleteGoalModal}
        title="Delete Goal"
        description="Are you sure you want to delete this goal? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteGoal}
        destructive
      />
    </AppLayout>
  )
}
