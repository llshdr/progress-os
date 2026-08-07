'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Plus, Clock, Calendar } from 'lucide-react'
import { PageSkeleton } from '@/components/ui/page-skeleton'

type Workout = {
  id: string
  date: string
  workout_type: string | null
  template_name: string | null
  exercise_count: number
  started_at: string
  completed_at: string | null
}

const PAGE_SIZE = 20

// In-progress workouts float to the top of whatever's currently loaded so an
// abandoned/active session never blends into a chronological list of
// finished ones - a stable sort, so the date-desc order within each group
// (in-progress vs completed) is untouched.
const sortWorkouts = (list: Workout[]) =>
  [...list].sort((a, b) => {
    const aOpen = a.completed_at === null
    const bOpen = b.completed_at === null
    if (aOpen === bOpen) return 0
    return aOpen ? -1 : 1
  })

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchWorkouts(0, false)
  }, [])

  const fetchWorkouts = async (offset: number, append: boolean) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('workouts')
      .select('id, date, workout_type, started_at, completed_at, workout_templates(name), exercises(id)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('Error fetching workouts:', error)
    } else {
      const mapped: Workout[] = (data || []).map((w: any) => ({
        id: w.id,
        date: w.date,
        workout_type: w.workout_type,
        template_name: w.workout_templates?.name ?? null,
        exercise_count: w.exercises?.length ?? 0,
        started_at: w.started_at,
        completed_at: w.completed_at,
      }))
      setWorkouts((prev) => sortWorkouts(append ? [...prev, ...mapped] : mapped))
      setHasMore(mapped.length === PAGE_SIZE)
    }
    setLoading(false)
    setLoadingMore(false)
  }

  const handleLoadMore = () => {
    setLoadingMore(true)
    fetchWorkouts(workouts.length, true)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatDuration = (startedAt: string, completedAt: string) => {
    const start = new Date(startedAt)
    const end = new Date(completedAt)
    const minutes = Math.floor((end.getTime() - start.getTime()) / 60000)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym/train" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">
              Workouts
            </h1>
            <p className="text-lapis-text-tertiary text-sm">
              Track your training sessions
            </p>
          </div>
          <Link href="/gym/workouts/new">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-lapis-md bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 transition-all">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Workout</span>
            </button>
          </Link>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : workouts.length === 0 ? (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
            <Calendar className="w-10 h-10 text-lapis-text-disabled mx-auto mb-4" />
            <p className="text-lapis-text-tertiary mb-4">No workouts yet</p>
            <Link href="/gym/workouts/new">
              <button className="px-4 py-2 rounded-lapis-sm border border-lapis-border text-lapis-text-primary hover:bg-lapis-surface-2 transition-colors">
                Start your first workout
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              {workouts.map((workout) => {
                const isComplete = workout.completed_at !== null
                return (
                  <Link
                    key={workout.id}
                    href={`/gym/workouts/${workout.id}`}
                    className="block"
                  >
                    <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 transition-all duration-200">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="p-3 rounded-lapis-md bg-lapis-surface-2 shrink-0">
                            <Calendar className="w-5 h-5 text-lapis-text-secondary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {/* min-w-0 needed on the h3 itself (not just the
                                  min-w-0 wrappers above) - see the same fix
                                  and full reasoning in gym/exercises/page.tsx,
                                  where this identical nested-flex pattern
                                  actually triggered page-level horizontal
                                  overflow on a long name. */}
                              <h3 className="min-w-0 text-lg font-medium text-lapis-text-primary truncate">
                                {workout.template_name || workout.workout_type || 'Workout'}
                              </h3>
                              {isComplete ? (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-accent-500/15 text-lapis-accent-400 font-medium shrink-0">
                                  Completed
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-citrine/10 text-lapis-citrine border border-lapis-citrine/30 font-medium shrink-0">
                                  In Progress
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-lapis-text-tertiary text-sm flex-wrap">
                              <span>{formatDate(workout.date)}</span>
                              <span>•</span>
                              <span className="font-data tabular-nums">
                                {workout.exercise_count} {workout.exercise_count === 1 ? 'exercise' : 'exercises'}
                              </span>
                              {isComplete && (
                                <>
                                  <span>•</span>
                                  <span className="font-data tabular-nums flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(workout.started_at, workout.completed_at!)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-lapis-text-disabled shrink-0">
                          →
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 rounded-lapis-md border border-lapis-border text-lapis-text-primary hover:bg-lapis-surface-2 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
