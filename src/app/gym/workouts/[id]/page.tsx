'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Plus, Check, Clock, ArrowLeft } from 'lucide-react'
import SetLogger from '@/components/workout/set-logger'

type Workout = {
  id: string
  date: string
  workout_type: string
  notes: string | null
  started_at: string
  completed_at: string | null
}

type Exercise = {
  id: string
  exercise_name: string
  equipment: string | null
  notes: string | null
  exercise_order: number
}

export default function CurrentWorkoutPage() {
  const params = useParams()
  const router = useRouter()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [newExerciseEquipment, setNewExerciseEquipment] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchWorkoutData()
  }, [params.id])

  const fetchWorkoutData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Fetch workout
    const { data: workoutData, error: workoutError } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', params.id)
      .single()

    if (workoutError) {
      console.error('Error fetching workout:', workoutError)
      setLoading(false)
      return
    }

    setWorkout(workoutData)

    // Fetch exercises
    const { data: exercisesData, error: exercisesError } = await supabase
      .from('exercises')
      .select('*')
      .eq('workout_id', params.id)
      .order('exercise_order', { ascending: true })

    if (exercisesError) {
      console.error('Error fetching exercises:', exercisesError)
    } else {
      setExercises(exercisesData || [])
    }

    setLoading(false)
  }

  const handleAddExercise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExerciseName) return

    const { error } = await supabase.from('exercises').insert({
      workout_id: params.id,
      exercise_name: newExerciseName,
      equipment: newExerciseEquipment || null,
      exercise_order: exercises.length + 1,
    })

    if (error) {
      console.error('Error adding exercise:', error)
      alert('Failed to add exercise')
    } else {
      setNewExerciseName('')
      setNewExerciseEquipment('')
      setShowAddExercise(false)
      fetchWorkoutData()
    }
  }

  const handleCompleteWorkout = async () => {
    const { error } = await supabase
      .from('workouts')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', params.id)

    if (error) {
      console.error('Error completing workout:', error)
      alert('Failed to complete workout')
    } else {
      router.push('/gym/workouts')
    }
  }

  const formatDuration = (startedAt: string) => {
    const start = new Date(startedAt)
    const now = new Date()
    const minutes = Math.floor((now.getTime() - start.getTime()) / 60000)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
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

  if (!workout) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-white/40">Workout not found</div>
        </div>
      </AppLayout>
    )
  }

  // If an exercise is active, show the set logger
  if (activeExerciseId) {
    const activeExercise = exercises.find(e => e.id === activeExerciseId)
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => setActiveExerciseId(null)}
            className="flex items-center gap-2 text-white/40 hover:text-white/60 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to workout
          </button>
          <SetLogger
            exerciseId={activeExerciseId}
            exerciseName={activeExercise?.exercise_name || ''}
            onComplete={() => setActiveExerciseId(null)}
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/gym/workouts" className="text-white/40 hover:text-white/60 transition-colors mb-2 block">
              ← Back
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">
              {workout.workout_type}
            </h1>
            <div className="flex items-center gap-3 text-white/40 text-sm">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(workout.started_at)}
              </span>
              <span>•</span>
              <span>{exercises.length} exercises</span>
            </div>
          </div>
          <button
            onClick={handleCompleteWorkout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors"
          >
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">Complete</span>
          </button>
        </div>

        {/* Exercises List */}
        <div className="space-y-3 mb-6">
          {exercises.length === 0 ? (
            <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
              <p className="text-white/40 mb-4">No exercises yet</p>
              <button
                onClick={() => setShowAddExercise(true)}
                className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors"
              >
                Add your first exercise
              </button>
            </div>
          ) : (
            exercises.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => setActiveExerciseId(exercise.id)}
                className="w-full border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200 text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-1">
                      {exercise.exercise_name}
                    </h3>
                    {exercise.equipment && (
                      <p className="text-white/40 text-sm">{exercise.equipment}</p>
                    )}
                  </div>
                  <div className="text-white/30">
                    →
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Add Exercise Form */}
        {showAddExercise && (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
            <form onSubmit={handleAddExercise} className="space-y-4">
              <div>
                <label className="text-white/60 text-sm mb-2 block">Exercise Name</label>
                <input
                  type="text"
                  value={newExerciseName}
                  onChange={(e) => setNewExerciseName(e.target.value)}
                  placeholder="Bench Press"
                  className="w-full bg-white/5 border-white/10 text-white rounded-lg px-4 py-3 placeholder:text-white/30"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-white/60 text-sm mb-2 block">Equipment (optional)</label>
                <input
                  type="text"
                  value={newExerciseEquipment}
                  onChange={(e) => setNewExerciseEquipment(e.target.value)}
                  placeholder="Barbell"
                  className="w-full bg-white/5 border-white/10 text-white rounded-lg px-4 py-3 placeholder:text-white/30"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-white text-black hover:bg-white/90 rounded-lg px-4 py-3 font-medium"
                >
                  Add Exercise
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddExercise(false)}
                  className="px-4 py-3 rounded-lg border border-white/10 text-white hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Add Exercise Button */}
        {!showAddExercise && (
          <button
            onClick={() => setShowAddExercise(true)}
            className="w-full border border-dashed border-white/20 rounded-2xl bg-white/[0.01] p-6 hover:bg-white/[0.02] transition-colors flex items-center justify-center gap-2 text-white/40 hover:text-white/60"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Exercise</span>
          </button>
        )}
      </div>
    </AppLayout>
  )
}
