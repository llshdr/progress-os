'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Activity, Calendar } from 'lucide-react'
import { fetchCardioActivity, type CardioActivity } from '@/lib/cardio-stats'
import { getLocalWeekStart } from '@/lib/date'

type ExerciseAgg = {
  name: string
  bestDistance: number
  bestPaceSecondsPerKm: number | null
  timesPerformed: number
}

type WeekBucket = {
  start: Date
  totalKm: number
}

const WEEKS_SHOWN = 8
const RECENT_LIMIT = 20

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
}

function formatCardioDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds === 0 ? `${minutes} min` : `${minutes}m ${seconds}s`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function buildWeekBuckets(activities: CardioActivity[]): WeekBucket[] {
  const currentWeekStart = getLocalWeekStart()
  const weeks: WeekBucket[] = []
  for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
    const start = new Date(currentWeekStart)
    start.setDate(start.getDate() - i * 7)
    weeks.push({ start, totalKm: 0 })
  }

  for (const activity of activities) {
    const activityWeekStart = getLocalWeekStart(new Date(activity.date))
    const bucket = weeks.find((w) => w.start.getTime() === activityWeekStart.getTime())
    if (bucket) bucket.totalKm += activity.distanceKm
  }

  return weeks
}

function buildExerciseAggregates(activities: CardioActivity[]): ExerciseAgg[] {
  const aggByLibraryId = new Map<string, ExerciseAgg>()

  for (const a of activities) {
    const pace = a.distanceKm > 0 ? a.durationSeconds / a.distanceKm : null
    const existing = aggByLibraryId.get(a.exerciseLibraryId)

    if (!existing) {
      aggByLibraryId.set(a.exerciseLibraryId, {
        name: a.exerciseName,
        bestDistance: a.distanceKm,
        bestPaceSecondsPerKm: pace,
        timesPerformed: 1,
      })
    } else {
      existing.timesPerformed += 1
      if (a.distanceKm > existing.bestDistance) existing.bestDistance = a.distanceKm
      if (pace !== null && (existing.bestPaceSecondsPerKm === null || pace < existing.bestPaceSecondsPerKm)) {
        existing.bestPaceSecondsPerKm = pace
      }
    }
  }

  return Array.from(aggByLibraryId.values()).sort((a, b) => b.bestDistance - a.bestDistance)
}

export default function CardioProgressPage() {
  const [activities, setActivities] = useState<CardioActivity[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const data = await fetchCardioActivity(supabase)
    setActivities(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white/40">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  const weeks = buildWeekBuckets(activities)
  const maxWeekKm = Math.max(...weeks.map((w) => w.totalKm), 1)
  const exerciseAggregates = buildExerciseAggregates(activities)
  const recentActivities = activities.slice(0, RECENT_LIMIT)

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym/progress" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <Activity className="w-8 h-8 text-white/80" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Cardio</h1>
            <p className="text-white/50 text-sm">Progression across your runs and rides</p>
          </div>
        </div>

        {activities.length === 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40">No cardio logged yet — record a run to see your progression here.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <h2 className="text-lg font-medium text-white mb-4">Weekly Distance</h2>
              <div className="space-y-3">
                {weeks.map((week, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-white/80">
                        {week.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-white/40 text-xs">{week.totalKm.toFixed(1)} km</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-white transition-all duration-300"
                        style={{ width: `${(week.totalKm / maxWeekKm) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <h2 className="text-lg font-medium text-white mb-4">Best Pace &amp; Distance</h2>
              <div className="space-y-3">
                {exerciseAggregates.map((agg) => (
                  <div key={agg.name} className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-white/80 text-sm">{agg.name}</span>
                    <span className="text-white/40 text-xs">
                      {agg.bestDistance} km best · {agg.bestPaceSecondsPerKm != null ? formatPace(agg.bestPaceSecondsPerKm) : 'N/A'}{' '}
                      best pace · {agg.timesPerformed}x
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-medium text-white mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {recentActivities.map((activity, index) => (
                  <div
                    key={index}
                    className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 flex items-center justify-between flex-wrap gap-2"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-white/40" />
                      <div>
                        <span className="text-white font-medium">{activity.exerciseName}</span>
                        <span className="text-white/40 text-sm ml-2">{formatDate(activity.date)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-white/70 text-sm">
                      <span>{activity.distanceKm} km</span>
                      <span>{formatCardioDuration(activity.durationSeconds)}</span>
                      <span className="text-white/40">
                        {formatPace(activity.durationSeconds / activity.distanceKm)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
