'use client'

import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, BookOpen, Scale, LayoutTemplate, TrendingUp, Flame, Flag } from 'lucide-react'
import Link from 'next/link'
import TodaySuggestionsSection from '@/components/ai-coach/today-suggestions-section'
import { getLocalWeekStartString, getLocalDateString } from '@/lib/date'
import { computeGymStreakWeeks } from '@/lib/gym-streak'
import { filterWorkoutsCountingTowardGoal } from '@/lib/workout-goal'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'
import { raceTypeLabel, type RaceType } from '@/lib/race-constants'

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

interface TodayRace {
  id: string
  race_type: RaceType
  location: string | null
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null)
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0)
  const [weeklyGoal, setWeeklyGoal] = useState(5)
  const [streakWeeks, setStreakWeeks] = useState(0)
  const [showTodaySuggestions, setShowTodaySuggestions] = useState(true)
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null)
  const [previousWeight, setPreviousWeight] = useState<WeightEntry | null>(null)
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
  const [userName, setUserName] = useState<string>('')
  const [deloadActive, setDeloadActive] = useState(false)
  const [todayRace, setTodayRace] = useState<TodayRace | null>(null)

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

      // Fetch weekly goal + the cardio-counting toggle from user settings
      // (defaults matching historical behavior: goal 5, cardio counts).
      let resolvedWeeklyGoal = 5
      let resolvedCountCardio = true
      try {
        const { data: settings } = await supabase
          .from('user_settings')
          .select('weekly_workout_goal, show_today_suggestions, count_cardio_toward_workout_goal')
          .eq('user_id', user.id)
          .single()

        resolvedWeeklyGoal = settings?.weekly_workout_goal || 5
        resolvedCountCardio = settings?.count_cardio_toward_workout_goal ?? true
        setWeeklyGoal(resolvedWeeklyGoal)
        setShowTodaySuggestions(settings?.show_today_suggestions ?? true)
      } catch (settingsError) {
        // Settings table might not exist yet, use default
        setWeeklyGoal(5)
        setShowTodaySuggestions(true)
      }

      // Fetch workouts completed this week, then narrow to the ones that
      // actually count toward the goal (see workout-goal.ts) - a no-op
      // extra query when cardio counts (the default), since every
      // completed workout counts there same as before.
      const { data: weeklyWorkoutsData } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user.id)
        .gte('date', getLocalWeekStartString())
        .not('completed_at', 'is', null)

      const countingWeeklyIds = await filterWorkoutsCountingTowardGoal(
        supabase,
        (weeklyWorkoutsData ?? []).map((w) => w.id),
        resolvedCountCardio
      )
      setWeeklyWorkouts(countingWeeklyIds.size)

      // Same computation the Today-suggestion sentence already uses
      // (gymSuggestions.ts) - extracted into a shared function so the two
      // never quietly disagree. Needs the resolved goal/setting, not the
      // state (which may not have flushed yet), so it's called with the
      // local variables above.
      setStreakWeeks(await computeGymStreakWeeks(supabase, user.id, resolvedWeeklyGoal, resolvedCountCardio))

      // Active ad-hoc deload, if any - same field the gym Schedule page's
      // DeloadCard reads/writes (see migration 083).
      const { data: deloadSettings } = await supabase
        .from('user_settings')
        .select('active_deload_started_at')
        .eq('user_id', user.id)
        .maybeSingle()
      setDeloadActive(deloadSettings?.active_deload_started_at != null)

      // Race-day quick-log entry point (Races Part D) - only ever shown
      // the day of a declared race, and only until a result is logged
      // (races/[id]'s own Race Result card, deep-linked via ?tab=progress
      // rather than duplicating that form here). Deliberately not "any
      // upcoming race" - this is specifically about today.
      const { data: raceToday } = await supabase
        .from('races')
        .select('id, race_type, location')
        .eq('user_id', user.id)
        .eq('race_date', getLocalDateString())
        .is('result_duration_seconds', null)
        .limit(1)
        .maybeSingle()

      setTodayRace(raceToday)

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
      setLoadError(true)
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

  const daysSinceLastWeighIn = (): number | null => {
    if (!latestWeight) return null
    const msPerDay = 1000 * 60 * 60 * 24
    return Math.floor((Date.now() - new Date(latestWeight.recorded_at).getTime()) / msPerDay)
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
          <PageSkeleton />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && <LoadErrorBanner message="Couldn't load some of your dashboard data. Try refreshing." />}
        {/* Top Section */}
        <div className="mb-8">
          <h1 className="font-display italic text-4xl font-medium tracking-tight text-lapis-text-primary mb-2">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-lapis-text-tertiary text-lg mb-1">{getCurrentDate()}</p>
          <p className="text-lapis-text-secondary text-sm">{getRandomQuote()}</p>
          {deloadActive && <p className="text-lapis-text-tertiary text-sm mt-1">Deload active</p>}
        </div>

        {/* Race Day - one tap to the existing, already-simple Race Result
            entry (races/[id]'s Progress tab), rather than a new form here.
            Only appears the day of a declared race, before a result is
            logged. */}
        {todayRace && (
          <div className="mb-6">
            <Link
              href={`/gym/progress/races/${todayRace.id}?tab=progress`}
              className="relative overflow-hidden border border-lapis-gold-500/40 rounded-lapis-xl bg-lapis-gold-500/[0.06] p-8 flex items-center justify-between gap-4 flex-wrap hover:bg-lapis-gold-500/[0.1] transition-colors block"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lapis-lg bg-lapis-gold-500/15">
                  <Flag className="w-6 h-6 text-lapis-gold-500" />
                </div>
                <div>
                  <p className="font-display text-xl font-semibold text-lapis-text-primary">
                    Today is race day — {raceTypeLabel(todayRace.race_type)}
                    {todayRace.location ? ` (${todayRace.location})` : ''}
                  </p>
                  <p className="text-lapis-text-tertiary text-sm">Good luck out there. Tap to log your result.</p>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Today's Focus */}
        <div className="mb-6">
          <div className="relative overflow-hidden border border-lapis-border rounded-lapis-xl bg-lapis-surface-1 p-8 before:content-[''] before:absolute before:top-0 before:left-8 before:right-8 before:h-[2px] before:bg-gradient-to-r before:from-lapis-gold-500 before:to-transparent">
            <p className="font-data text-[10px] tracking-[0.14em] uppercase text-lapis-gold-500 mb-3">Today&apos;s Focus</p>
            {activeWorkout ? (
              <div>
                <h2 className="font-display text-2xl font-semibold text-lapis-text-primary mb-6">You have an active workout in progress</h2>
                <button
                  onClick={handleContinueWorkout}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-lapis-accent-500 text-lapis-text-primary rounded-lapis-md font-medium hover:brightness-110 transition-all"
                >
                  Continue Workout
                </button>
              </div>
            ) : (
              <div>
                <h2 className="font-display text-2xl font-semibold text-lapis-text-primary mb-6">Ready to train?</h2>
                <button
                  onClick={handleStartWorkout}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-lapis-accent-500 text-lapis-text-primary rounded-lapis-md font-medium hover:brightness-110 transition-all"
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
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-lapis-text-tertiary" />
              <h3 className="text-lg font-medium text-lapis-text-primary">Weekly Progress</h3>
            </div>
            <div className="mb-3">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-data text-3xl font-medium tabular-nums text-lapis-text-primary">{weeklyWorkouts}</span>
                <span className="text-lapis-text-tertiary">/ {weeklyGoal} workouts</span>
              </div>
              <div className="w-full bg-lapis-surface-3 rounded-full h-2">
                <div
                  className="bg-lapis-accent-500 rounded-full h-2 transition-all duration-300"
                  style={{ width: `${Math.min((weeklyWorkouts / weeklyGoal) * 100, 100)}%` }}
                />
              </div>
            </div>
            {/* Same 2-week floor the Today-suggestion sentence already
                uses (STREAK_MIN_WEEKS in gymSuggestions.ts) - a 1-week
                "streak" isn't really a streak yet, so both surfaces stay
                quiet until it means something. */}
            {streakWeeks >= 2 && (
              <p className="text-lapis-text-tertiary text-xs">{streakWeeks} weeks in a row hitting your target</p>
            )}
          </div>

          {/* Current Weight */}
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="w-5 h-5 text-lapis-text-tertiary" />
              <h3 className="text-lg font-medium text-lapis-text-primary">Current Weight</h3>
            </div>
            {latestWeight ? (
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-data text-3xl font-medium tabular-nums text-lapis-text-primary">{latestWeight.weight}</span>
                  <span className="text-lapis-text-tertiary">kg</span>
                </div>
                {getWeightDifference() !== null && (
                  <p
                    className={`font-data text-sm tabular-nums ${
                      getWeightDifference()! > 0 ? 'text-lapis-garnet' : getWeightDifference()! < 0 ? 'text-lapis-jade' : 'text-lapis-text-tertiary'
                    }`}
                  >
                    {getWeightDifference()! > 0 ? '+' : ''}
                    {getWeightDifference()!.toFixed(1)} kg
                  </p>
                )}
                {/* 14 days - long enough that a single skipped week
                    doesn't trigger it, short enough to still be a useful
                    nudge rather than stale advice by the time it fires. */}
                {daysSinceLastWeighIn() != null && daysSinceLastWeighIn()! >= 14 && (
                  <p className="text-lapis-text-disabled text-xs mt-1">Last weighed in {daysSinceLastWeighIn()} days ago</p>
                )}
                <button
                  onClick={handleUpdateWeight}
                  className="mt-3 text-sm text-lapis-text-tertiary hover:text-lapis-text-primary transition-colors"
                >
                  Update Weight
                </button>
              </div>
            ) : (
              <div>
                <p className="text-lapis-text-tertiary text-sm mb-3">No weight entries yet</p>
                <button
                  onClick={handleUpdateWeight}
                  className="text-sm text-lapis-text-tertiary hover:text-lapis-text-primary transition-colors"
                >
                  Add Weight
                </button>
              </div>
            )}
          </div>

          {/* Personal Records */}
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-lapis-text-tertiary" />
              <h3 className="text-lg font-medium text-lapis-text-primary">Personal Records</h3>
            </div>
            {personalRecords.length > 0 ? (
              <div className="space-y-3">
                {personalRecords.map((pr) => (
                  <Link
                    key={pr.exerciseLibraryId}
                    href={`/gym/exercises/${pr.exerciseLibraryId}`}
                    className="block border-b border-lapis-border-subtle pb-2 last:border-0 last:pb-0 hover:opacity-80 transition-opacity"
                  >
                    <p className="text-lapis-text-primary font-medium">{pr.exercise_name}</p>
                    <p className="font-data text-lapis-text-secondary text-sm tabular-nums">
                      {pr.weight} × {pr.reps}
                    </p>
                    <p className="text-lapis-text-tertiary text-xs">{formatDate(pr.date)}</p>
                  </Link>
                ))}
                <Link href="/gym/records" className="text-sm text-lapis-text-tertiary hover:text-lapis-text-primary transition-colors block pt-1">
                  View all →
                </Link>
              </div>
            ) : (
              <p className="text-lapis-text-tertiary text-sm">No PRs yet</p>
            )}
          </div>
        </div>

        {/* Quick Actions - only shortcuts that aren't already one tap away
            elsewhere on this page or in the persistent nav (Start Workout
            duplicates Today's Focus's own CTA, Weight Tracking duplicates
            the Current Weight card's action, Calendar is now a top-level
            nav item). */}
        <div>
          <h3 className="text-xl font-semibold text-lapis-text-primary mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/gym/exercises"
              className="flex flex-col items-center gap-2 p-4 border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 hover:bg-lapis-surface-2 transition-all duration-200"
            >
              <BookOpen className="w-6 h-6 text-lapis-text-secondary" />
              <span className="text-sm text-lapis-text-secondary">Exercise Library</span>
            </Link>
            <Link
              href="/gym/templates"
              className="flex flex-col items-center gap-2 p-4 border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 hover:bg-lapis-surface-2 transition-all duration-200"
            >
              <LayoutTemplate className="w-6 h-6 text-lapis-text-secondary" />
              <span className="text-sm text-lapis-text-secondary">Templates</span>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
