'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Plus, Check, Clock, ArrowLeft, Trash2 } from 'lucide-react'
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
  exercise_name: string | null
  exercise_library_id: string | null
  equipment: string | null
  notes: string | null
  exercise_order: number
}

type LibraryExercise = {
  id: string
  name: string
  primary_muscle_group: string
  equipment_type: string
}

export default function CurrentWorkoutPage() {
  const params = useParams()
  const router = useRouter()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([])
  const [recentExercises, setRecentExercises] = useState<LibraryExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [selectedLibraryExercise, setSelectedLibraryExercise] = useState<string | null>(null)
  const [newExerciseName, setNewExerciseName] = useState('')
  const [newExerciseEquipment, setNewExerciseEquipment] = useState('')
  const [useLibrary, setUseLibrary] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchWorkoutData()
    fetchLibraryExercises()
  }, [params.id])

  const fetchLibraryExercises = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('exercise_library')
      .select('id, name, primary_muscle_group, equipment_type')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching library exercises:', error)
    } else {
      setLibraryExercises(data || [])
    }

    // Fetch recent exercises (used in recent workouts)
    const { data: recentData, error: recentError } = await supabase
      .from('exercises')
      .select('exercise_library_id, exercise_library(id, name, primary_muscle_group, equipment_type)')
      .not('exercise_library_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!recentError && recentData) {
      // Get unique exercises from recent workouts
      const uniqueRecentExercises = recentData
        .map((ex: any) => ex.exercise_library)
        .filter((ex: any) => ex !== null)
        .filter((exercise: any, index: number, self: any[]) =>
          index === self.findIndex((e: any) => e.id === exercise.id)
        )
      setRecentExercises(uniqueRecentExercises)
    }
  }

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

    // Fetch exercises with library data
    const { data: exercisesData, error: exercisesError } = await supabase
      .from('exercises')
      .select('*, exercise_library(id, name, primary_muscle_group, equipment_type)')
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
    
    // If using library, require selected exercise
    if (useLibrary && !selectedLibraryExercise) {
      alert('Please select an exercise from your library')
      return
    }
    
    // If not using library, require custom name
    if (!useLibrary && !newExerciseName) {
      alert('Please enter an exercise name')
      return
    }

    let exerciseLibraryId = selectedLibraryExercise

    // Auto-save custom exercise to library
    if (!useLibrary && newExerciseName) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Check if exercise already exists in library
      const { data: existingExercise } = await supabase
        .from('exercise_library')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', newExerciseName)
        .single()

      if (existingExercise) {
        // Use existing exercise
        exerciseLibraryId = existingExercise.id
      } else {
        // Create new exercise in library
        const { data: newLibraryExercise, error: libraryError } = await supabase
          .from('exercise_library')
          .insert({
            user_id: user.id,
            name: newExerciseName,
            primary_muscle_group: 'Other',
            equipment_type: newExerciseEquipment || 'Other',
            category: 'Isolation',
          })
          .select()
          .single()

        if (libraryError) {
          console.error('Error creating library exercise:', libraryError)
          // Continue anyway, will use exercise_name fallback
        } else {
          exerciseLibraryId = newLibraryExercise.id
        }
      }
    }

    const exerciseData: any = {
      workout_id: params.id,
      exercise_order: exercises.length + 1,
    }

    if (exerciseLibraryId) {
      exerciseData.exercise_library_id = exerciseLibraryId
    } else {
      exerciseData.exercise_name = newExerciseName
      exerciseData.equipment = newExerciseEquipment || null
    }

    const { error } = await supabase.from('exercises').insert(exerciseData)

    if (error) {
      console.error('Error adding exercise:', error)
      alert('Failed to add exercise')
    } else {
      // Reset form
      setSelectedLibraryExercise(null)
      setNewExerciseName('')
      setNewExerciseEquipment('')
      setShowAddExercise(false)
      fetchWorkoutData()
      fetchLibraryExercises() // Refresh library to include newly added exercise
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

  const handleDeleteWorkout = async () => {
    if (!confirm('Are you sure you want to delete this workout? This cannot be undone.')) return

    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting workout:', error)
      alert('Failed to delete workout')
    } else {
      router.push('/gym/workouts')
    }
  }

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!confirm('Remove this exercise from the workout?')) return

    const { error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', exerciseId)

    if (error) {
      console.error('Error deleting exercise:', error)
      alert('Failed to remove exercise')
    } else {
      fetchWorkoutData()
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
    // Get exercise name from library or fallback to custom name
    const exerciseName = (activeExercise as any)?.exercise_library?.name || activeExercise?.exercise_name || 'Unknown Exercise'
    
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
            exerciseName={exerciseName}
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
              {workout.workout_type || 'Workout'}
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
          <div className="flex gap-2">
            <button
              onClick={handleDeleteWorkout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-medium">Delete</span>
            </button>
            <button
              onClick={handleCompleteWorkout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Complete</span>
            </button>
          </div>
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
            exercises.map((exercise) => {
              // Get exercise name from library or fallback to custom name
              const exerciseName = (exercise as any)?.exercise_library?.name || exercise.exercise_name || 'Unknown Exercise'
              const equipment = (exercise as any)?.exercise_library?.equipment_type || exercise.equipment
              
              return (
                <div
                  key={exercise.id}
                  className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setActiveExerciseId(exercise.id)}
                      className="flex-1 text-left"
                    >
                      <h3 className="text-lg font-medium text-white mb-1">
                        {exerciseName}
                      </h3>
                      {equipment && (
                        <p className="text-white/40 text-sm">{equipment}</p>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteExercise(exercise.id)}
                      className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Add Exercise Form */}
        {showAddExercise && (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
            <form onSubmit={handleAddExercise} className="space-y-4">
              {/* Toggle between Library and Custom */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUseLibrary(true)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    useLibrary
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  From Library
                </button>
                <button
                  type="button"
                  onClick={() => setUseLibrary(false)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !useLibrary
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  Custom
                </button>
              </div>

              {useLibrary ? (
                /* Library Selection */
                <div>
                  <label className="text-white/60 text-sm mb-3 block">Select Exercise</label>
                  {libraryExercises.length === 0 && recentExercises.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-white/40 mb-3">No exercises in your library</p>
                      <Link
                        href="/gym/exercises/new"
                        className="text-white hover:text-white/60 text-sm"
                      >
                        Create your first exercise →
                      </Link>
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {/* Recent Exercises */}
                      {recentExercises.length > 0 && (
                        <>
                          <div className="text-white/40 text-xs px-3 py-2">Recent</div>
                          {recentExercises.map((libExercise) => (
                            <button
                              key={libExercise.id}
                              type="button"
                              onClick={() => setSelectedLibraryExercise(libExercise.id)}
                              className={`w-full p-3 rounded-lg border transition-all duration-200 text-left ${
                                selectedLibraryExercise === libExercise.id
                                  ? 'bg-white/10 text-white border-white/20'
                                  : 'bg-white/[0.02] border-white/10 text-white hover:bg-white/[0.04]'
                              }`}
                            >
                              <div className="font-medium text-white">{libExercise.name}</div>
                              <div className="text-white/40 text-sm">
                                {libExercise.primary_muscle_group} • {libExercise.equipment_type}
                              </div>
                            </button>
                          ))}
                          <div className="border-t border-white/10 my-2"></div>
                        </>
                      )}
                      
                      {/* All Library Exercises */}
                      {libraryExercises.map((libExercise) => (
                        <button
                          key={libExercise.id}
                          type="button"
                          onClick={() => setSelectedLibraryExercise(libExercise.id)}
                          className={`w-full p-3 rounded-lg border transition-all duration-200 text-left ${
                            selectedLibraryExercise === libExercise.id
                              ? 'bg-white/10 text-white border-white/20'
                              : 'bg-white/[0.02] border-white/10 text-white hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="font-medium text-white">{libExercise.name}</div>
                          <div className="text-white/40 text-sm">
                            {libExercise.primary_muscle_group} • {libExercise.equipment_type}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Custom Exercise */
                <>
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
                </>
              )}

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
