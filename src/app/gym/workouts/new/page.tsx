'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getLocalDateString } from '@/lib/date'

type Template = {
  id: string
  name: string
  description: string | null
  exercise_count?: number
}

type ActiveWorkout = {
  id: string
  workout_type: string | null
  started_at: string
  template_name: string | null
}

export default function NewWorkoutPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchTemplates()
    checkActiveWorkout()
  }, [])

  const checkActiveWorkout = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('workouts')
      .select('id, workout_type, started_at, workout_templates(name)')
      .eq('user_id', user.id)
      .is('completed_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      setActiveWorkout({
        id: data.id,
        workout_type: data.workout_type,
        started_at: data.started_at,
        template_name: (data as any).workout_templates?.name ?? null,
      })
    }
  }

  const fetchTemplates = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('workout_templates')
      .select('*, workout_template_exercises(count)')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching templates:', error)
    } else {
      const templatesWithCount = (data || []).map((template: any) => ({
        ...template,
        exercise_count: template.workout_template_exercises?.[0]?.count || 0,
      }))
      setTemplates(templatesWithCount)
    }
    setLoading(false)
  }

  const handleCreateWorkout = async () => {
    setCreating(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setCreating(false)
      return
    }

    // Create workout (with or without template)
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        template_id: selectedTemplate || null,
        workout_type: selectedTemplate ? null : 'Custom',
        notes: notes || null,
        date: getLocalDateString(),
      })
      .select()
      .single()

    if (workoutError) {
      console.error('Error creating workout:', workoutError)
      setCreating(false)
      return
    }

    // Only populate exercises if a template was selected
    if (selectedTemplate) {
      const { data: templateExercises, error: exercisesError } = await supabase
        .from('workout_template_exercises')
        .select('*')
        .eq('template_id', selectedTemplate)
        .order('exercise_order', { ascending: true })

      if (exercisesError) {
        console.error('Error fetching template exercises:', exercisesError)
        router.push(`/gym/workouts/${workout.id}`)
        return
      }

      // Auto-populate exercises from template
      if (templateExercises && templateExercises.length > 0) {
        const exercisesToInsert = templateExercises.map((ex: any) => ({
          workout_id: workout.id,
          exercise_library_id: ex.exercise_library_id,
          exercise_order: ex.exercise_order,
          notes: ex.notes,
        }))

        const { error: insertError } = await supabase
          .from('exercises')
          .insert(exercisesToInsert)

        if (insertError) {
          console.error('Error populating exercises:', insertError)
        }
      }
    }

    router.push(`/gym/workouts/${workout.id}`)
  }

  const formatStartedAgo = (startedAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
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

  if (activeWorkout) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/gym/workouts" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
            ← Back
          </Link>

          <div className="border border-white/10 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-semibold text-white mb-2">You have an unfinished workout</h2>
            <p className="text-white/60 mb-6">
              {activeWorkout.template_name || activeWorkout.workout_type || 'Workout'} — started{' '}
              {formatStartedAgo(activeWorkout.started_at)}
            </p>
            <button
              onClick={() => router.push(`/gym/workouts/${activeWorkout.id}`)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-white/90 transition-colors"
            >
              Continue Workout
            </button>
            <p className="text-white/40 text-sm mt-4">
              Want to start fresh instead? Open that workout and delete it first.
            </p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym/workouts" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
          New Workout
        </h1>
        <p className="text-white/50 text-sm mb-8">
          Choose a template or start empty
        </p>

        {/* Empty Workout Option */}
        <button
          onClick={() => setSelectedTemplate(null)}
          className={`w-full border rounded-2xl p-6 text-left transition-all duration-200 mb-4 ${
            selectedTemplate === null
              ? 'bg-white/10 border-white/30'
              : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04] hover:border-white/15'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-white mb-1">
                Empty Workout
              </h3>
              <p className="text-white/40 text-sm">Start from scratch</p>
            </div>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
              selectedTemplate === null
                ? 'border-white bg-white'
                : 'border-white/30'
            }`}>
              {selectedTemplate === null && (
                <div className="w-3 h-3 rounded-full bg-black" />
              )}
            </div>
          </div>
        </button>

        {/* Templates Selection */}
        {templates.length > 0 && (
          <div className="grid gap-3 mb-8">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`border rounded-2xl p-6 text-left transition-all duration-200 ${
                  selectedTemplate === template.id
                    ? 'bg-white/10 border-white/30'
                    : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04] hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-1">
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-white/40 text-sm mb-1">{template.description}</p>
                    )}
                    <p className="text-white/30 text-sm">{template.exercise_count} exercises</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedTemplate === template.id
                      ? 'border-white bg-white'
                      : 'border-white/30'
                  }`}>
                    {selectedTemplate === template.id && (
                      <div className="w-3 h-3 rounded-full bg-black" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Notes (Optional) */}
        <div className="mb-8">
          <label className="text-white/60 text-sm mb-3 block">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes for this workout..."
            rows={3}
            className="w-full bg-white/5 border-white/10 text-white rounded-xl px-4 py-3 placeholder:text-white/30 resize-none"
          />
        </div>

        {/* Create Button */}
        <button
          onClick={handleCreateWorkout}
          disabled={creating}
          className="w-full bg-white text-black hover:bg-white/90 rounded-xl px-4 py-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {creating ? 'Creating...' : 'Start Workout'}
        </button>
      </div>
    </AppLayout>
  )
}
