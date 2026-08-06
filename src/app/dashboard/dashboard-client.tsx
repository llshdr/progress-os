'use client'

import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, BookOpen, Scale, LayoutTemplate, TrendingUp, Flame } from 'lucide-react'
import Link from 'next/link'
import TodaySuggestionsSection from '@/components/ai-coach/today-suggestions-section'
import { getLocalWeekStartString, getLocalDateString } from '@/lib/date'
import { selectActiveMesocycle, type Mesocycle, type CurrentMesocycleStatus } from '@/lib/mesocycle'

interface DashboardClientProps {
  user: User
}

interface ActiveWorkout {
  id: string
  date: string
  workout_type: string | null
  template_id: string | null
  started_at: string
}

interface WeightEntry {
  id: string
  weight: number
  recorded_at: string
}

interface PersonalRecord {
  exerciseLibraryId: string
  exercise_name: string
  weight: number
  reps: number
  date: string
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null)
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0)
  const [weeklyGoal, setWeeklyGoal] = useState(5)
  const [showTodaySuggestions, setShowTodaySuggestions] = useState(true)
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null)
  const [previousWeight, setPreviousWeight] = useState<WeightEntry | null>(null)
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
  const [userName, setUserName] = useState<string>('')
  const [mesocycleStatus, setMesocycleStatus] = useState<CurrentMesocycleStatus | null>(null)

  const motivationalQuotes = [
    "Let's make today count.",
    "Every rep counts.",
    "Consistency is key.",
    "You've got this.",
    "One day at a time.",
  ]

  const getRandomQuote = () => {
    return motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]
  }

  const getCurrentDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }
    return new Date().toLocaleDateString('en-US', options)
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch user profile for name (handle case where table doesn't exist yet)
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()

        setUserName(profile?.full_name || user.email?.split('@')[0] || 'User')
      } catch (profileError) {
        // Profiles table might not exist yet, fall back to email
        setUserName(user.email?.split('@')[0] || 'User')
      }

      // Fetch active workout (not completed)
      const { data: activeWorkoutData } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .is('completed_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      setActiveWorkout(activeWorkoutData)

      // Fetch workouts completed this week
      const { data: weeklyWorkoutsData, count } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: false })
        .eq('user_id', user.id)
        .gte('date', getLocalWeekStartString())
        .not('completed_at', 'is', null)

      setWeeklyWorkouts(count || 0)

      // Fetch weekly goal from user settings (default to 5)
      try {
        const { data: settings } = await supabase
          .from('user_settings')
          .select('weekly_workout_goal, show_today_suggestions')
          .eq('user_id', user.id)
          .single()

        setWeeklyGoal(settings?.weekly_workout_goal || 5)
        setShowTodaySuggestions(settings?.show_today_suggestions ?? true)
      } catch (settingsError) {
        // Settings table might not exist yet, use default
        setWeeklyGoal(5)
        setShowTodaySuggestions(true)
      }

      // Active training block, if any - reuses the exact same derivation
      // the gym Schedule page's MesocycleCard already uses, just a
      // different render location (see mesocycle.ts).
      const { data: mesocycleRows } = await supabase
        .from('training_mesocycles')
        .select('id, start_date, length_weeks, deload_week_number, label')
        .eq('user_id', user.id)

      if (mesocycleRows) {
        const mesocycles: Mesocycle[] = mesocycleRows.map((r) => ({
          id: r.id,
          startDate: r.start_date,
          lengthWeeks: r.length_weeks,
          deloadWeekNumber: r.deload_week_number,
          label: r.label,
        }))
        setMesocycleStatus(selectActiveMesocycle(mesocycles, getLocalDateString()))
      }

      // Fetch latest weight entries
      const { data: weightData } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(2)

      if (weightData && weightData.length > 0) {
        setLatestWeight(weightData[0])
        if (weightData.length > 1) {
          setPreviousWeight(weightData[1])
        }
      }

      // Fetch personal records (best sets from completed workouts), grouped
      // per exercise via exercise_library_id. The previous version grouped
      // by the legacy exercise_name field, which is null for anything
      // logged the normal way (via the exercise library) - every set
      // collapsed into one bucket keyed by "undefined", so only the single
      // heaviest set app-wide ever surfaced, with no real exercise name.
      const { data: library } = await supabase
        .from('exercise_library')
        .select('id, name')
        .eq('user_id', user.id)

      const libraryNameById = new Map((library ?? []).map((l) => [l.id, l.name]))

      const { data: instances } = await supabase
        .from('exercises')
        .select('id, exercise_library_id, workout:workouts!inner(date, completed_at)')
        .not('exercise_library_id', 'is', null)

      const instanceInfo = new Map<string, { libraryId: string; date: string }>()
      for (const row of (instances ?? []) as any[]) {
        if (!row.workout?.completed_at) continue
        instanceInfo.set(row.id, { libraryId: row.exercise_library_id, date: row.workout.date })
      }

      const { data: prsData } = await supabase.from('sets').select('exercise_id, weight, reps').eq('completed', true)

      if (prsData) {
        // Best set per exercise, tracking which instance/date produced it.
        const bestByLibraryId = new Map<string, PersonalRecord>()

        for (const set of prsData as any[]) {
          const info = instanceInfo.get(set.exercise_id)
          if (!info) continue

          const name = libraryNameById.get(info.libraryId)
          if (!name) continue

          const existing = bestByLibraryId.get(info.libraryId)
          if (!existing || set.weight > existing.weight || (set.weight === existing.weight && set.reps > existing.reps)) {
            bestByLibraryId.set(info.libraryId, {
              exerciseLibraryId: info.libraryId,
              exercise_name: name,
              weight: set.weight,
              reps: set.reps,
              date: info.date,
            })
          }
        }

        // Most recently-achieved PRs first, across all exercises - not just
        // the single biggest number app-wide.
        const sortedPRs = Array.from(bestByLibraryId.values())
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 3)

        setPersonalRecords(sortedPRs)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartWorkout = () => {
    router.push('/gym/workouts/new')
  }

  const handleContinueWorkout = () => {
    if (activeWorkout) {
      router.push(`/gym/workouts/${activeWorkout.id}`)
    }
  }

  const handleUpdateWeight = () => {
    router.push('/gym/weight')
  }

  const getWeightDifference = () => {
    if (!latestWeight || !previousWeight) return null
    const diff = latestWeight.weight - previousWeight.weight
    return diff
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-white/5 rounded w-1/4 mb-8"></div>
            <div className="h-48 bg-white/5 rounded-2xl mb-4"></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="h-32 bg-white/5 rounded-2xl"></div>
              <div className="h-32 bg-white/5 rounded-2xl"></div>
              <div className="h-32 bg-white/5 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-white/40 text-lg mb-1">{getCurrentDate()}</p>
          <p className="text-white/50 text-sm">{getRandomQuote()}</p>
          {mesocycleStatus && (
            <p className="text-white/40 text-sm mt-1">
              {mesocycleStatus.mesocycle.label ? `${mesocycleStatus.mesocycle.label} — ` : ''}
              {mesocycleStatus.isDeloadWeek ? 'Deload week' : `Week ${mesocycleStatus.currentWeek} of ${mesocycleStatus.mesocycle.lengthWeeks}`}
            </p>
          )}
        </div>

        {/* Today's Focus */}
        <div className="mb-6">
          <div className="border border-white/10 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-semibold text-white mb-6">Today's Focus</h2>
            {activeWorkout ? (
              <div>
                <p className="text-white/60 text-lg mb-4">You have an active workout in progress</p>
                <button
                  onClick={handleContinueWorkout}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
                >
                  Continue Workout
                </button>
              </div>
            ) : (
              <div>
                <p className="text-white/60 text-lg mb-4">Ready to train?</p>
                <button
                  onClick={handleStartWorkout}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
                >
                  <Dumbbell className="w-5 h-5" />
                  Start Workout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Today's Suggestions */}
        {showTodaySuggestions && (
          <div className="mb-6">
            <TodaySuggestionsSection />
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {/* Weekly Progress */}
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-white/60" />
              <h3 className="text-lg font-medium text-white">Weekly Progress</h3>
            </div>
            <div className="mb-3">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-semibold text-white">{weeklyWorkouts}</span>
                <span className="text-white/40">/ {weeklyGoal} workouts</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all duration-300"
                  style={{ width: `${Math.min((weeklyWorkouts / weeklyGoal) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Current Weight */}
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="w-5 h-5 text-white/60" />
              <h3 className="text-lg font-medium text-white">Current Weight</h3>
            </div>
            {latestWeight ? (
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-semibold text-white">{latestWeight.weight}</span>
                  <span className="text-white/40">kg</span>
                </div>
                {getWeightDifference() !== null && (
                  <p className={`text-sm ${getWeightDifference()! > 0 ? 'text-green-400' : getWeightDifference()! < 0 ? 'text-red-400' : 'text-white/40'}`}>
                    {getWeightDifference()! > 0 ? '+' : ''}{getWeightDifference()!.toFixed(1)} kg
                  </p>
                )}
                <button
                  onClick={handleUpdateWeight}
                  className="mt-3 text-sm text-white/50 hover:text-white transition-colors"
                >
                  Update Weight
                </button>
              </div>
            ) : (
              <div>
                <p className="text-white/40 text-sm mb-3">No weight entries yet</p>
                <button
                  onClick={handleUpdateWeight}
                  className="text-sm text-white/50 hover:text-white transition-colors"
                >
                  Add Weight
                </button>
              </div>
            )}
          </div>

          {/* Personal Records */}
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-white/60" />
              <h3 className="text-lg font-medium text-white">Personal Records</h3>
            </div>
            {personalRecords.length > 0 ? (
              <div className="space-y-3">
                {personalRecords.map((pr) => (
                  <Link
                    key={pr.exerciseLibraryId}
                    href={`/gym/exercises/${pr.exerciseLibraryId}`}
                    className="block border-b border-white/5 pb-2 last:border-0 last:pb-0 hover:opacity-80 transition-opacity"
                  >
                    <p className="text-white font-medium">{pr.exercise_name}</p>
                    <p className="text-white/60 text-sm">{pr.weight} × {pr.reps}</p>
                    <p className="text-white/40 text-xs">{formatDate(pr.date)}</p>
                  </Link>
                ))}
                <Link href="/gym/records" className="text-sm text-white/50 hover:text-white transition-colors block pt-1">
                  View all →
                </Link>
              </div>
            ) : (
              <p className="text-white/40 text-sm">No PRs yet</p>
            )}
          </div>
        </div>

        {/* Quick Actions - only shortcuts that aren't already one tap away
            elsewhere on this page or in the persistent nav (Start Workout
            duplicates Today's Focus's own CTA, Weight Tracking duplicates
            the Current Weight card's action, Calendar is now a top-level
            nav item). */}
        <div>
          <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/gym/exercises"
              className="flex flex-col items-center gap-2 p-4 border border-white/10 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200"
            >
              <BookOpen className="w-6 h-6 text-white/60" />
              <span className="text-sm text-white/80">Exercise Library</span>
            </Link>
            <Link
              href="/gym/templates"
              className="flex flex-col items-center gap-2 p-4 border border-white/10 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200"
            >
              <LayoutTemplate className="w-6 h-6 text-white/60" />
              <span className="text-sm text-white/80">Templates</span>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
