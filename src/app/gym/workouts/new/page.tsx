'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type Template = {
  id: string
  name: string
  description: string | null
  exercise_count?: number
}

export default function NewWorkoutPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchTemplates()
  }, [])

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
        date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (workoutError) {
      console.error('Error creating workout:', workoutError)
      alert('Failed to create workout')
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

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white/40">Loading...</div>
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
