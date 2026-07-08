'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
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
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const weekStart = new Date(now.setDate(diff))
    return weekStart.toISOString().split('T')[0]
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
      alert('Failed to add goal')
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

  const handleDeleteGoal = async (goalId: string) => {
    const { error } = await supabase
      .from('weekly_goals')
      .delete()
      .eq('id', goalId)

    if (error) {
      console.error('Error deleting goal:', error)
    } else {
      fetchGoals()
    }
  }

  const getCategoryColor = (category: Goal['category']) => {
    const colors = {
      fitness: 'bg-white/5 text-white/80 border-white/10',
      business: 'bg-white/5 text-white/80 border-white/10',
      productivity: 'bg-white/5 text-white/80 border-white/10',
      self_improvement: 'bg-white/5 text-white/80 border-white/10',
    }
    return colors[category]
  }

  const getStatusColor = (status: Goal['status']) => {
    const colors = {
      pending: 'bg-white/5 text-white/60 border-white/10',
      in_progress: 'bg-white/5 text-white/60 border-white/10',
      completed: 'bg-white/5 text-white/60 border-white/10',
    }
    return colors[status]
  }

  if (loading) {
    return (
      <AppLayout>
        <LoadingState />
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/gym" className="text-white/40 hover:text-white/60 transition-colors">
            ← Back
          </Link>
          <div className="flex-1" />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger>
              <Button className="bg-white text-black hover:bg-white/90 text-sm">
                Add Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Add New Goal</DialogTitle>
                <DialogDescription className="text-white/40">
                  Create a new goal for this week
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddGoal} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-white/80">Title</Label>
                  <Input
                    id="title"
                    value={newGoal.title}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, title: e.target.value })
                    }
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-white/80">Category</Label>
                  <Select
                    value={newGoal.category}
                    onValueChange={(value) =>
                      setNewGoal({
                        ...newGoal,
                        category: value as Goal['category'],
                      })
                    }
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-white/10">
                      <SelectItem value="fitness">Fitness</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="productivity">Productivity</SelectItem>
                      <SelectItem value="self_improvement">
                        Self Improvement
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-white/80">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={newGoal.description}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, description: e.target.value })
                    }
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-white text-black hover:bg-white/90"
                >
                  Add Goal
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
            Weekly Goals
          </h1>
          <p className="text-white/50 text-sm">
            {goals.filter((g) => g.status === 'completed').length} of {goals.length} completed
          </p>
        </div>

        <div className="grid gap-3">
          {goals.length === 0 ? (
            <EmptyState message="No goals for this week yet">
              <Button
                onClick={() => setIsDialogOpen(true)}
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
              >
                Add your first goal
              </Button>
            </EmptyState>
          ) : (
            goals.map((goal) => (
              <div
                key={goal.id}
                className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200"
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
                    <h3 className="text-lg font-medium text-white mb-1">
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="text-white/40 text-sm">
                        {goal.description}
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
                        className="border-white/10 text-white hover:bg-white/5"
                      >
                        {goal.status === 'pending' ? 'Start' : 'Complete'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-white/40 hover:text-white/60 hover:bg-white/5"
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
    </AppLayout>
  )
}
