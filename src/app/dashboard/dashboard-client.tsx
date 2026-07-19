'use client'

import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, BookOpen, Scale, LayoutTemplate, TrendingUp, Calendar, Clock } from 'lucide-react'
import Link from 'next/link'
import TodaySuggestionsCard from '@/components/ai-coach/today-suggestions-card'
import { getLocalWeekStartString } from '@/lib/date'

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
  exercise_name: string
  weight: number
  reps: number
  date: string
}

interface RecentWorkout {
  id: string
  date: string
  workout_type: string | null
  template_name: string | null
  exercise_count: number
  duration_minutes: number | null
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null)
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0)
  const [weeklyGoal, setWeeklyGoal] = useState(5)
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null)
  const [previousWeight, setPreviousWeight] = useState<WeightEntry | null>(null)
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([])
  const [userName, setUserName] = useState<string>('')

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
          .select('weekly_workout_goal')
          .eq('user_id', user.id)
          .single()

        setWeeklyGoal(settings?.weekly_workout_goal || 5)
      } catch (settingsError) {
        // Settings table might not exist yet, use default
        setWeeklyGoal(5)
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

      // Fetch personal records (best sets from completed workouts)
      const { data: prsData } = await supabase
        .from('sets')
        .select(`
          weight,
          reps,
          exercises!inner(
            exercise_name,
            workout_id,
            workouts!inner(
              date,
              completed_at
            )
          )
        `)
        .not('exercises.workouts.completed_at', 'is', null)
        .eq('exercises.workouts.user_id', user.id)
        .order('weight', { ascending: false })
        .limit(10)

      if (prsData) {
        // Group by exercise and get the best set for each
        const prMap = new Map<string, PersonalRecord>()
        prsData.forEach((set: any) => {
          const exerciseName = set.exercises.exercise_name
          const currentBest = prMap.get(exerciseName)

          if (!currentBest || set.weight > currentBest.weight || 
              (set.weight === currentBest.weight && set.reps > currentBest.reps)) {
            prMap.set(exerciseName, {
              exercise_name: exerciseName,
              weight: set.weight,
              reps: set.reps,
              date: set.exercises.workouts.date,
            })
          }
        })

        // Get the 3 most recent PRs
        const sortedPRs = Array.from(prMap.values())
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 3)

        setPersonalRecords(sortedPRs)
      }

      // Fetch recent completed workouts
      const { data: recentData } = await supabase
        .from('workouts')
        .select(`
          id,
          date,
          workout_type,
          workout_templates(name),
          exercises(id)
        `)
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('date', { ascending: false })
        .limit(5)

      if (recentData) {
        const recentWorkoutList: RecentWorkout[] = recentData.map((workout: any) => {
          const duration = workout.started_at && workout.completed_at
            ? Math.round((new Date(workout.completed_at).getTime() - new Date(workout.started_at).getTime()) / 60000)
            : null

          return {
            id: workout.id,
            date: workout.date,
            workout_type: workout.workout_type,
            template_name: workout.workout_templates?.name || null,
            exercise_count: workout.exercises?.length || 0,
            duration_minutes: duration,
          }
        })
        setRecentWorkouts(recentWorkoutList)
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

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
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
        <div className="mb-6">
          <TodaySuggestionsCard />
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {/* Weekly Progress */}
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-white/60" />
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
                {personalRecords.map((pr, index) => (
                  <div key={index} className="border-b border-white/5 pb-2 last:border-0 last:pb-0">
                    <p className="text-white font-medium">{pr.exercise_name}</p>
                    <p className="text-white/60 text-sm">{pr.weight} × {pr.reps}</p>
                    <p className="text-white/40 text-xs">{formatDate(pr.date)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-sm">No PRs yet</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white mb-4">Recent Activity</h3>
          {recentWorkouts.length > 0 ? (
            <div className="space-y-3">
              {recentWorkouts.map((workout) => (
                <Link
                  key={workout.id}
                  href={`/gym/workouts/${workout.id}`}
                  className="block border border-white/10 rounded-2xl bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-medium mb-1">
                        {workout.template_name || workout.workout_type || 'Workout'}
                      </p>
                      <div className="flex items-center gap-3 text-white/40 text-sm">
                        <span>{formatDate(workout.date)}</span>
                        <span>•</span>
                        <span>{workout.exercise_count} exercises</span>
                        {workout.duration_minutes && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(workout.duration_minutes)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-8 text-center">
              <p className="text-white/40">No recent workouts</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={handleStartWorkout}
              className="flex flex-col items-center gap-2 p-4 border border-white/10 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200"
            >
              <Dumbbell className="w-6 h-6 text-white/60" />
              <span className="text-sm text-white/80">Start Workout</span>
            </button>
            <Link
              href="/gym/exercises"
              className="flex flex-col items-center gap-2 p-4 border border-white/10 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200"
            >
              <BookOpen className="w-6 h-6 text-white/60" />
              <span className="text-sm text-white/80">Exercise Library</span>
            </Link>
            <button
              onClick={handleUpdateWeight}
              className="flex flex-col items-center gap-2 p-4 border border-white/10 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200"
            >
              <Scale className="w-6 h-6 text-white/60" />
              <span className="text-sm text-white/80">Weight Tracking</span>
            </button>
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
