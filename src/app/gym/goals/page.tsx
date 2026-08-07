'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type Goal = {
  id: string
  title: string
  description: string | null
  category: 'fitness' | 'business' | 'productivity' | 'self_improvement'
  status: 'pending' | 'in_progress' | 'completed'
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'fitness' as Goal['category'],
  })
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

    const weekStart = getWeekStart()
    const { data, error } = await supabase
      .from('weekly_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching goals:', error)
    } else {
      setGoals(data || [])
    }
    setLoading(false)
  }

  const getWeekStart = () => {
    // Monday-start week (ISO-style) - now the shared app-wide convention,
    // not just this feature's own. Was already correct here before the
    // rest of the app followed suit.
    return getLocalWeekStartString()
  }

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('weekly_goals').insert({
      user_id: user.id,
      title: newGoal.title,
      description: newGoal.description || null,
      category: newGoal.category,
      week_start_date: getWeekStart(),
    })

    if (error) {
      console.error('Error adding goal:', error)
    } else {
      setNewGoal({ title: '', description: '', category: 'fitness' })
      setIsDialogOpen(false)
      fetchGoals()
    }
  }

  const handleUpdateStatus = async (goalId: string, status: Goal['status']) => {
    const { error } = await supabase
      .from('weekly_goals')
      .update({ status })
      .eq('id', goalId)

    if (error) {
      console.error('Error updating goal:', error)
    } else {
      fetchGoals()
    }
  }

  const handleDeleteGoal = async () => {
    if (!goalToDelete) return

    const { error } = await supabase
      .from('weekly_goals')
      .delete()
      .eq('id', goalToDelete)

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

  const getCategoryColor = (category: Goal['category']) => {
    const colors = {
      fitness: 'bg-lapis-surface-2 text-lapis-text-secondary border-lapis-border-subtle',
      business: 'bg-lapis-surface-2 text-lapis-text-secondary border-lapis-border-subtle',
      productivity: 'bg-lapis-surface-2 text-lapis-text-secondary border-lapis-border-subtle',
      self_improvement: 'bg-lapis-surface-2 text-lapis-text-secondary border-lapis-border-subtle',
    }
    return colors[category]
  }

  const getStatusColor = (status: Goal['status']) => {
    const colors = {
      pending: 'bg-lapis-surface-2 text-lapis-text-secondary border-lapis-border-subtle',
      in_progress: 'bg-lapis-surface-2 text-lapis-text-secondary border-lapis-border-subtle',
      completed: 'bg-lapis-surface-2 text-lapis-text-secondary border-lapis-border-subtle',
    }
    return colors[status]
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-lapis-text-tertiary">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  <Label htmlFor="category" className="text-lapis-text-secondary">Category</Label>
                  <Select
                    value={newGoal.category}
                    onValueChange={(value) =>
                      setNewGoal({
                        ...newGoal,
                        category: value as Goal['category'],
                      })
                    }
                  >
                    <SelectTrigger className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-lapis-bg border-lapis-border-subtle">
                      <SelectItem value="fitness">Fitness</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="productivity">Productivity</SelectItem>
                      <SelectItem value="self_improvement">
                        Self Improvement
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {newGoal.category !== 'fitness' && (
                    <p className="text-lapis-text-disabled text-xs">
                      Business/Productivity/Self-improvement are placeholder categories until a
                      dedicated module exists — these goals only live here for now.
                    </p>
                  )}
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

        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">
            Weekly Goals
          </h1>
          <p className="text-lapis-text-tertiary text-sm">
            {goals.filter((g) => g.status === 'completed').length} of {goals.length} completed
          </p>
        </div>

        <div className="grid gap-3">
          {goals.length === 0 ? (
            <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
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
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor(
                          goal.category
                        )}`}
                      >
                        {goal.category}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          goal.status
                        )}`}
                      >
                        {goal.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-lapis-text-primary mb-1">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="text-lapis-text-tertiary text-sm">
                        {goal.description}
                      </p>
                    )}
                    {goal.category !== 'fitness' && (
                      <p className="text-lapis-text-disabled text-xs mt-2">
                        Placeholder category — no dedicated module yet.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {goal.status !== 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleUpdateStatus(
                            goal.id,
                            goal.status === 'pending'
                              ? 'in_progress'
                              : 'completed'
                          )
                        }
                        className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2"
                      >
                        {goal.status === 'pending' ? 'Start' : 'Complete'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openDeleteGoalModal(goal.id)}
                      className="text-lapis-text-tertiary hover:text-lapis-text-secondary hover:bg-lapis-surface-2"
                    >
                      Delete
                    </Button>
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
