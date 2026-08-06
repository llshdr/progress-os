'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Plus, Clock, Calendar } from 'lucide-react'

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
        <Link href="/gym/train" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
              Workouts
            </h1>
            <p className="text-white/50 text-sm">
              Track your training sessions
            </p>
          </div>
          <Link href="/gym/workouts/new">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Workout</span>
            </button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-white/40">Loading...</div>
          </div>
        ) : workouts.length === 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40 mb-4">No workouts yet</p>
            <Link href="/gym/workouts/new">
              <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors">
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
                    <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-white/5">
                            <Calendar className="w-5 h-5 text-white/60" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-medium text-white">
                                {workout.template_name || workout.workout_type || 'Workout'}
                              </h3>
                              {isComplete ? (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-white text-black font-medium">
                                  Completed
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 font-medium">
                                  In Progress
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-white/40 text-sm">
                              <span>{formatDate(workout.date)}</span>
                              <span>•</span>
                              <span>{workout.exercise_count} {workout.exercise_count === 1 ? 'exercise' : 'exercises'}</span>
                              {isComplete && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(workout.started_at, workout.completed_at!)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-white/30">
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
                  className="px-6 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors disabled:opacity-50"
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
