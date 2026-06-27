'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      fitness: 'bg-green-500/10 text-green-400 border-green-500/20',
      business: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      productivity: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      self_improvement: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    }
    return colors[category]
  }

  const getStatusColor = (status: Goal['status']) => {
    const colors = {
      pending: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
      in_progress: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    }
    return colors[status]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a
              href="/"
              className="text-xl font-bold text-white hover:text-neutral-300 transition-colors"
            >
              ← Back
            </a>
            <h1 className="text-xl font-bold text-white">Weekly Goals</h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              This Week's Goals
            </h2>
            <p className="text-neutral-400">
              {goals.filter((g) => g.status === 'completed').length} of {goals.length} completed
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger>
              <Button className="bg-white text-black hover:bg-neutral-200">
                Add Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 text-white">
              <DialogHeader>
                <DialogTitle>Add New Goal</DialogTitle>
                <DialogDescription className="text-neutral-400">
                  Create a new goal for this week
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddGoal} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newGoal.title}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, title: e.target.value })
                    }
                    required
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newGoal.category}
                    onValueChange={(value) =>
                      setNewGoal({
                        ...newGoal,
                        category: value as Goal['category'],
                      })
                    }
                  >
                    <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-neutral-800">
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
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={newGoal.description}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, description: e.target.value })
                    }
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-white text-black hover:bg-neutral-200"
                >
                  Add Goal
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {goals.length === 0 ? (
            <Card className="bg-neutral-900 border-neutral-800">
              <CardContent className="py-12 text-center">
                <p className="text-neutral-400 mb-4">No goals for this week yet</p>
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  variant="outline"
                  className="border-neutral-700 text-white hover:bg-neutral-800"
                >
                  Add your first goal
                </Button>
              </CardContent>
            </Card>
          ) : (
            goals.map((goal) => (
              <Card
                key={goal.id}
                className="bg-neutral-900 border-neutral-800"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
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
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {goal.title}
                      </h3>
                      {goal.description && (
                        <p className="text-neutral-400 text-sm">
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
                          className="border-neutral-700 text-white hover:bg-neutral-800"
                        >
                          {goal.status === 'pending' ? 'Start' : 'Complete'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
