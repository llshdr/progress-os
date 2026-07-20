'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { ArrowLeft, Calendar, Dumbbell, TrendingUp, Clock, Award, Pencil } from 'lucide-react'
import ExerciseCoachCard from '@/components/ai-coach/exercise-coach-card'
import ExerciseProgressChart, { type ExerciseSessionPoint } from '@/components/gym/exercise-progress-chart'
import { estimateOneRepMax } from '@/lib/estimate1rm'

type Exercise = {
  id: string
  name: string
  primary_muscle_group: string
  equipment_type: string
  exercise_type: string
  notes: string | null
}

type CardioEntry = {
  date: string
  distanceKm: number
  durationSeconds: number
}

type CardioStatistics = {
  timesPerformed: number
  lastTrained: string | null
  bestDistance: number | null
  bestPaceSecondsPerKm: number | null
}

type WorkoutSet = {
  id: string
  weight: number
  reps: number
  set_order: number
}

type WorkoutExercise = {
  id: string
  workout_id: string
  exercise_order: number
  notes: string | null
  variantLabel: string | null
  sets: WorkoutSet[]
}

type Workout = {
  id: string
  date: string
  workout_type: string | null
  template_id: string | null
  template_name: string | null
  started_at: string
  completed_at: string | null
  exercises: WorkoutExercise[]
}

type BestSet = {
  weight: number
  reps: number
}

type Statistics = {
  timesPerformed: number
  lastTrained: string | null
  bestSet: BestSet | null
  estimated1RM: number | null
  totalSets: number
  totalVolume: number
}

export default function ExerciseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [cardioEntries, setCardioEntries] = useState<CardioEntry[]>([])
  const [cardioStatistics, setCardioStatistics] = useState<CardioStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchExerciseData()
  }, [params.id])

  const fetchExerciseData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Fetch exercise details
    const { data: exerciseData, error: exerciseError } = await supabase
      .from('exercise_library')
      .select('*')
      .eq('id', params.id)
      .single()

    if (exerciseError || !exerciseData) {
      console.error('Error fetching exercise:', exerciseError)
      setLoading(false)
      return
    }

    setExercise(exerciseData)

    if (exerciseData.exercise_type === 'cardio') {
      await fetchCardioData(exerciseData.id)
      setLoading(false)
      return
    }

    // Fetch all workouts containing this exercise. Two separate,
    // properly-parameterized queries instead of a single .or() built via
    // string interpolation — an exercise name containing a comma or other
    // PostgREST-significant character would otherwise break or misbehave.
    const workoutSelect = `
      workout_id,
      workout:workouts!inner(
        id,
        date,
        workout_type,
        template_id,
        started_at,
        completed_at
      )
    `
    const [byLibraryId, byName] = await Promise.all([
      supabase.from('exercises').select(workoutSelect).eq('exercise_library_id', params.id),
      supabase.from('exercises').select(workoutSelect).ilike('exercise_name', exerciseData.name),
    ])

    if (byLibraryId.error || byName.error) {
      console.error('Error fetching workouts:', byLibraryId.error || byName.error)
      setLoading(false)
      return
    }

    // A workout_id appearing in both result sets just collapses into one
    // entry below — no further deduping needed.
    const exercisesData = [...(byLibraryId.data || []), ...(byName.data || [])]

    // Get unique workouts with template names
    const workoutIds = [...new Set(exercisesData?.map((e: any) => e.workout.id) || [])]
    const workoutsWithDetails: Workout[] = []

    for (const workoutId of workoutIds) {
      const { data: workoutData } = await supabase
        .from('workouts')
        .select('*, workout_templates(name)')
        .eq('id', workoutId)
        .single()

      if (workoutData) {
        // Fetch all exercises and sets for this workout
        const { data: workoutExercises } = await supabase
          .from('exercises')
          .select('*, variant:exercise_variants(label), sets(*)')
          .eq('workout_id', workoutId)
          .order('exercise_order', { ascending: true })

        // Filter to only this exercise
        const thisExerciseEntries = workoutExercises?.filter(
          (e: any) => e.exercise_library_id === params.id || e.exercise_name === exerciseData.name
        ) || []

        workoutsWithDetails.push({
          id: workoutData.id,
          date: workoutData.date,
          workout_type: workoutData.workout_type,
          template_id: workoutData.template_id,
          template_name: workoutData.workout_templates?.name || null,
          started_at: workoutData.started_at,
          completed_at: workoutData.completed_at,
          exercises: thisExerciseEntries.map((e: any) => ({
            id: e.id,
            workout_id: e.workout_id,
            exercise_order: e.exercise_order,
            notes: e.notes,
            variantLabel: e.variant?.label ?? null,
            sets: e.sets || [],
          })),
        })
      }
    }

    // Sort by date (newest first)
    workoutsWithDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setWorkouts(workoutsWithDetails)

    // Calculate statistics
    calculateStatistics(workoutsWithDetails)
    setLoading(false)
  }

  const calculateStatistics = (workoutData: Workout[]) => {
    let totalSets = 0
    let totalVolume = 0
    let bestSet: BestSet | null = null
    let lastTrained: string | null = null

    workoutData.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        exercise.sets.forEach((set) => {
          // Convert weight and reps to numbers (they might be strings from Supabase)
          const weight = typeof set.weight === 'string' ? parseFloat(set.weight) : set.weight
          const reps = typeof set.reps === 'string' ? parseInt(set.reps) : set.reps

          totalSets++
          totalVolume += weight * reps

          // Track best set (highest weight, then reps)
          const currentSet: BestSet = { weight, reps }
          if (!bestSet || weight > bestSet.weight || (weight === bestSet.weight && reps > bestSet.reps)) {
            bestSet = currentSet
          }
        })
      })

      // Track last trained date
      if (!lastTrained || new Date(workout.date) > new Date(lastTrained)) {
        lastTrained = workout.date
      }
    })

    let estimated1RM: number | null = null
    if (bestSet) {
      const { weight, reps } = bestSet as BestSet
      estimated1RM = estimateOneRepMax(weight, reps)
    }

    setStatistics({
      timesPerformed: workoutData.length,
      lastTrained,
      bestSet,
      estimated1RM,
      totalSets,
      totalVolume,
    })
  }

  // Cardio's history lives in a flat leaf table (one row per exercise
  // instance), not a one-to-many `sets` collection, so this is a single
  // pair of flat queries rather than the strength path's per-workout fetch.
  const fetchCardioData = async (exerciseLibraryId: string) => {
    const { data: instances, error: instancesError } = await supabase
      .from('exercises')
      .select('id, workout:workouts!inner(date)')
      .eq('exercise_library_id', exerciseLibraryId)

    if (instancesError) {
      console.error('Error fetching cardio exercise instances:', instancesError)
      return
    }

    const dateByInstanceId = new Map<string, string>()
    for (const instance of (instances ?? []) as any[]) {
      dateByInstanceId.set(instance.id, instance.workout.date)
    }

    const instanceIds = Array.from(dateByInstanceId.keys())
    if (instanceIds.length === 0) {
      setCardioEntries([])
      setCardioStatistics({ timesPerformed: 0, lastTrained: null, bestDistance: null, bestPaceSecondsPerKm: null })
      return
    }

    const { data: logs, error: logsError } = await supabase
      .from('cardio_logs')
      .select('exercise_id, distance_km, duration_seconds')
      .in('exercise_id', instanceIds)

    if (logsError) {
      console.error('Error fetching cardio logs:', logsError)
      return
    }

    const entries: CardioEntry[] = (logs ?? [])
      .map((log) => ({
        date: dateByInstanceId.get(log.exercise_id)!,
        distanceKm: typeof log.distance_km === 'string' ? parseFloat(log.distance_km) : log.distance_km,
        durationSeconds: log.duration_seconds,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    setCardioEntries(entries)

    let lastTrained: string | null = null
    let bestDistance: number | null = null
    let bestPaceSecondsPerKm: number | null = null

    for (const entry of entries) {
      if (!lastTrained || new Date(entry.date) > new Date(lastTrained)) lastTrained = entry.date
      if (bestDistance === null || entry.distanceKm > bestDistance) bestDistance = entry.distanceKm
      if (entry.distanceKm > 0) {
        const paceSecondsPerKm = entry.durationSeconds / entry.distanceKm
        if (bestPaceSecondsPerKm === null || paceSecondsPerKm < bestPaceSecondsPerKm) {
          bestPaceSecondsPerKm = paceSecondsPerKm
        }
      }
    }

    setCardioStatistics({ timesPerformed: entries.length, lastTrained, bestDistance, bestPaceSecondsPerKm })
  }

  const formatPace = (secondsPerKm: number): string => {
    const minutes = Math.floor(secondsPerKm / 60)
    const seconds = Math.round(secondsPerKm % 60)
    return `${minutes}:${String(seconds).padStart(2, '0')} /km`
  }

  const formatCardioDuration = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return seconds === 0 ? `${minutes} min` : `${minutes}m ${seconds}s`
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatVolume = (volume: number) => {
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}k`
    }
    return volume.toString()
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

  if (!exercise) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white/40">Exercise not found</div>
        </div>
      </AppLayout>
    )
  }

  // Derived from the already-fetched workout history — no extra query.
  const chartSessions: ExerciseSessionPoint[] = workouts
    .map((workout) => {
      let topWeight = 0
      let volume = 0

      workout.exercises.forEach((exerciseEntry) => {
        exerciseEntry.sets.forEach((set) => {
          const weight = typeof set.weight === 'string' ? parseFloat(set.weight) : set.weight
          const reps = typeof set.reps === 'string' ? parseInt(set.reps) : set.reps
          volume += weight * reps
          if (weight > topWeight) topWeight = weight
        })
      })

      // A workout very occasionally logs the same exercise twice (e.g. two
      // different machines same day) — take the first entry's variant as
      // this session's label rather than trying to split one session in two.
      const variantLabel = workout.exercises[0]?.variantLabel ?? null

      return { date: workout.date, topWeight, volume, variantLabel }
    })
    .filter((session) => session.volume > 0)

  const distinctVariants = new Set(chartSessions.map((s) => s.variantLabel ?? null))
  const hasMixedVariants = distinctVariants.size > 1

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/gym/exercises"
            className="text-white/40 hover:text-white/60 transition-colors mb-6 inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Link>

          <div className="mt-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
                {exercise.name}
              </h1>
              <div className="flex flex-wrap gap-3 text-sm text-white/60">
                <span className="flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4" />
                  {exercise.primary_muscle_group}
                </span>
                <span className="flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  {exercise.equipment_type}
                </span>
              </div>
              {exercise.notes && (
                <p className="text-white/50 text-sm mt-3">{exercise.notes}</p>
              )}
            </div>
            <Link
              href={`/gym/exercises/${exercise.id}/edit`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors shrink-0"
            >
              <Pencil className="w-4 h-4" />
              <span className="text-sm font-medium">Edit</span>
            </Link>
          </div>
        </div>

        {/* Statistics Section */}
        {exercise.exercise_type !== 'cardio' && statistics && (
          <div className="mb-8">
            <h2 className="text-lg font-medium text-white mb-1">Statistics</h2>
            {hasMixedVariants && (
              <p className="text-white/40 text-xs mb-3">
                Includes {distinctVariants.size} equipment variants — Best Set and Est. 1RM may not be
                directly comparable across them.
              </p>
            )}
            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 ${hasMixedVariants ? '' : 'mt-3'}`}>
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Times Performed</span>
                </div>
                <p className="text-2xl font-semibold text-white">{statistics.timesPerformed}</p>
              </div>

              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Last Trained</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {statistics.lastTrained ? formatDate(statistics.lastTrained) : 'Never'}
                </p>
              </div>

              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Best Set</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {statistics.bestSet ? `${statistics.bestSet.weight} × ${statistics.bestSet.reps}` : 'N/A'}
                </p>
              </div>

              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Est. 1RM</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {statistics.estimated1RM ? `${Math.round(statistics.estimated1RM)} kg` : 'N/A'}
                </p>
              </div>

              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Total Sets</span>
                </div>
                <p className="text-2xl font-semibold text-white">{statistics.totalSets}</p>
              </div>

              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Total Volume</span>
                </div>
                <p className="text-2xl font-semibold text-white">{formatVolume(statistics.totalVolume)} kg</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Section */}
        {exercise.exercise_type !== 'cardio' && chartSessions.length >= 2 && (
          <div className="mb-8">
            <h2 className="text-lg font-medium text-white mb-4">Progress</h2>
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
              <ExerciseProgressChart sessions={chartSessions} />
            </div>
          </div>
        )}

        {/* AI Coach Section — rep/weight-based, doesn't apply to cardio */}
        {exercise.exercise_type !== 'cardio' && (
          <div className="mb-8">
            <ExerciseCoachCard exerciseLibraryId={exercise.id} exerciseName={exercise.name} />
          </div>
        )}

        {/* Cardio Statistics Section */}
        {exercise.exercise_type === 'cardio' && cardioStatistics && (
          <div className="mb-8">
            <h2 className="text-lg font-medium text-white mb-1">Statistics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Times Performed</span>
                </div>
                <p className="text-2xl font-semibold text-white">{cardioStatistics.timesPerformed}</p>
              </div>

              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Last Trained</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {cardioStatistics.lastTrained ? formatDate(cardioStatistics.lastTrained) : 'Never'}
                </p>
              </div>

              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Best Distance</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {cardioStatistics.bestDistance != null ? `${cardioStatistics.bestDistance} km` : 'N/A'}
                </p>
              </div>

              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Best Pace</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {cardioStatistics.bestPaceSecondsPerKm != null ? formatPace(cardioStatistics.bestPaceSecondsPerKm) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Workout History Section */}
        {exercise.exercise_type === 'cardio' ? (
          <div>
            <h2 className="text-lg font-medium text-white mb-4">Run History</h2>
            {cardioEntries.length === 0 ? (
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
                <p className="text-white/40">No runs logged yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cardioEntries.map((entry, index) => (
                  <div
                    key={index}
                    className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-white/40" />
                      <span className="text-white font-medium">{formatDate(entry.date)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-white/70 text-sm">
                      <span>{entry.distanceKm} km</span>
                      <span>{formatCardioDuration(entry.durationSeconds)}</span>
                      <span className="text-white/40">{formatPace(entry.durationSeconds / entry.distanceKm)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-medium text-white mb-4">Workout History</h2>
            {workouts.length === 0 ? (
              <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
                <p className="text-white/40">No workout history yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {workouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="border border-white/10 rounded-2xl bg-white/[0.02] p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-white/40" />
                        <span className="text-white font-medium">{formatDate(workout.date)}</span>
                      </div>
                      {workout.template_name && (
                        <span className="text-sm text-white/50 bg-white/5 px-3 py-1 rounded-full">
                          {workout.template_name}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {workout.exercises.map((exerciseEntry) => (
                        <div key={exerciseEntry.id}>
                          {exerciseEntry.sets.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {exerciseEntry.sets
                                .sort((a, b) => a.set_order - b.set_order)
                                .map((set) => (
                                  <span
                                    key={set.id}
                                    className="text-sm text-white/70 bg-white/5 px-3 py-1.5 rounded-lg"
                                  >
                                    {set.weight} × {set.reps}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
