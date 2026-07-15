'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { ArrowLeft, Calendar, Dumbbell, TrendingUp, Clock, Award } from 'lucide-react'

type Exercise = {
  id: string
  name: string
  primary_muscle_group: string
  equipment_type: string
  notes: string | null
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

    // Fetch all workouts containing this exercise
    const { data: exercisesData, error: exercisesError } = await supabase
      .from('exercises')
      .select(`
        workout_id,
        workout:workouts!inner(
          id,
          date,
          workout_type,
          template_id,
          started_at,
          completed_at
        )
      `)
      .or(`exercise_library_id.eq.${params.id},exercise_name.ilike.${exerciseData.name}`)

    if (exercisesError) {
      console.error('Error fetching workouts:', exercisesError)
      setLoading(false)
      return
    }

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
          .select('*, sets(*)')
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

    // Calculate estimated 1RM using Epley formula: weight × (1 + reps/30)
    let estimated1RM: number | null = null
    if (bestSet) {
      const { weight, reps } = bestSet
      estimated1RM = weight * (1 + reps / 30)
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

          <div className="mt-6">
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
        </div>

        {/* Statistics Section */}
        {statistics && (
          <div className="mb-8">
            <h2 className="text-lg font-medium text-white mb-4">Statistics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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

        {/* Workout History Section */}
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
      </div>
    </AppLayout>
  )
}
