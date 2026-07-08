'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { formatRelativeDate, formatDuration } from '@/lib/format'
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

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchWorkouts()
  }, [])

  const fetchWorkouts = async () => {
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

    if (error) {
      console.error('Error fetching workouts:', error)
    } else {
      setWorkouts(data || [])
    }
    setLoading(false)
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
          <LoadingState />
        ) : workouts.length === 0 ? (
          <EmptyState message="No workouts yet">
            <Link href="/gym/workouts/new">
              <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors">
                Start your first workout
              </button>
            </Link>
          </EmptyState>
        ) : (
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
                          <span>{formatRelativeDate(workout.date)}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {workout.completed_at
                              ? formatDuration(workout.started_at, workout.completed_at)
                              : 'In progress'}
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
        )}
      </div>
    </AppLayout>
  )
}
