'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Plus, Clock, Calendar } from 'lucide-react'

type Workout = {
  id: string
  date: string
  workout_type: string
  notes: string | null
  started_at: string
  completed_at: string | null
}

const PAGE_SIZE = 20

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
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('Error fetching workouts:', error)
    } else {
      setWorkouts((prev) => (append ? [...prev, ...(data || [])] : data || []))
      setHasMore((data?.length ?? 0) === PAGE_SIZE)
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

  const formatDuration = (startedAt: string, completedAt: string | null) => {
    if (!completedAt) return 'In progress'
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
        <div className="flex items-center justify-between mb-8">
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
              {workouts.map((workout) => (
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
                          <h3 className="text-lg font-medium text-white mb-1">
                            {workout.workout_type}
                          </h3>
                          <div className="flex items-center gap-3 text-white/40 text-sm">
                            <span>{formatDate(workout.date)}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(workout.started_at, workout.completed_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-white/30">
                        →
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
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
