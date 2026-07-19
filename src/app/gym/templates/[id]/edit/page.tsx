'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

type Template = {
  id: string
  name: string
  description: string | null
}

type TemplateExercise = {
  id: string
  exercise_library_id: string
  exercise_order: number
  target_sets: number | null
  target_rep_range_min: number | null
  target_rep_range_max: number | null
  notes: string | null
  exercise_library: {
    id: string
    name: string
    primary_muscle_group: string
    equipment_type: string
  }
}

type LibraryExercise = {
  id: string
  name: string
  primary_muscle_group: string
  equipment_type: string
}

export default function EditTemplatePage() {
  const params = useParams()
  const router = useRouter()
  const [template, setTemplate] = useState<Template | null>(null)
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([])
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [showDeleteExerciseModal, setShowDeleteExerciseModal] = useState(false)
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null)
  const supabase = createClient()
  const pendingExerciseUpdates = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    fetchTemplateData()
    fetchLibraryExercises()
  }, [params.id])

  useEffect(() => {
    return () => {
      pendingExerciseUpdates.current.forEach((timer) => clearTimeout(timer))
    }
  }, [])

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
  }

  const fetchTemplateData = async () => {
    const { data: templateData, error: templateError } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('id', params.id)
      .single()

    if (templateError) {
      console.error('Error fetching template:', templateError)
      setLoading(false)
      return
    }

    setTemplate(templateData)
    setName(templateData.name)
    setDescription(templateData.description || '')

    const { data: exercisesData, error: exercisesError } = await supabase
      .from('workout_template_exercises')
      .select('*, exercise_library(id, name, primary_muscle_group, equipment_type)')
      .eq('template_id', params.id)
      .order('exercise_order', { ascending: true })

    if (exercisesError) {
      console.error('Error fetching template exercises:', exercisesError)
    } else {
      setTemplateExercises(exercisesData || [])
    }

    setLoading(false)
  }

  const handleSaveTemplate = async () => {
    if (!name) {
      alert('Please enter a template name')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('workout_templates')
      .update({
        name,
        description: description || null,
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
      setSaving(false)
    } else {
      setSaving(false)
    }
  }

  const handleAddExercise = async (exerciseLibraryId: string) => {
    const { error } = await supabase.from('workout_template_exercises').insert({
      template_id: params.id,
      exercise_library_id: exerciseLibraryId,
      exercise_order: templateExercises.length + 1,
    })

    if (error) {
      console.error('Error adding exercise:', error)
    } else {
      setShowAddExercise(false)
      fetchTemplateData()
    }
  }

  const handleRemoveExercise = async () => {
    if (!exerciseToDelete) return

    const { error } = await supabase
      .from('workout_template_exercises')
      .delete()
      .eq('id', exerciseToDelete)

    if (error) {
      console.error('Error removing exercise:', error)
    } else {
      fetchTemplateData()
    }
    setExerciseToDelete(null)
  }

  const openDeleteExerciseModal = (exerciseId: string) => {
    setExerciseToDelete(exerciseId)
    setShowDeleteExerciseModal(true)
  }

  const handleUpdateExercise = (exerciseId: string, field: string, value: any) => {
    // Update local state immediately so typing stays responsive, and debounce
    // the actual write so a keystroke doesn't fire a DB round trip + refetch.
    setTemplateExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, [field]: value } : ex))
    )

    const key = `${exerciseId}:${field}`
    const existingTimer = pendingExerciseUpdates.current.get(key)
    if (existingTimer) clearTimeout(existingTimer)

    const timer = setTimeout(async () => {
      pendingExerciseUpdates.current.delete(key)

      const { error } = await supabase
        .from('workout_template_exercises')
        .update({ [field]: value })
        .eq('id', exerciseId)

      if (error) {
        console.error('Error updating exercise:', error)
      }
    }, 500)

    pendingExerciseUpdates.current.set(key, timer)
  }

  const handleMoveExercise = async (exerciseId: string, direction: 'up' | 'down') => {
    const currentIndex = templateExercises.findIndex(e => e.id === exerciseId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= templateExercises.length) return

    // Swap orders
    const currentExercise = templateExercises[currentIndex]
    const targetExercise = templateExercises[newIndex]

    await supabase
      .from('workout_template_exercises')
      .update({ exercise_order: targetExercise.exercise_order })
      .eq('id', currentExercise.id)

    await supabase
      .from('workout_template_exercises')
      .update({ exercise_order: currentExercise.exercise_order })
      .eq('id', targetExercise.id)

    fetchTemplateData()
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

  if (!template) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-white/40">Template not found</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/gym/templates" className="text-white/40 hover:text-white/60 transition-colors">
            ← Back
          </Link>
          <button
            onClick={handleSaveTemplate}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span className="text-sm font-medium">{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>

        <div className="max-w-2xl space-y-6">
          {/* Template Name */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border-white/10 text-white rounded-xl px-4 py-3"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border-white/10 text-white rounded-xl px-4 py-3 resize-none"
            />
          </div>

          {/* Exercises Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white">Exercises</h2>
              <button
                onClick={() => setShowAddExercise(!showAddExercise)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Add Exercise</span>
              </button>
            </div>

            {/* Add Exercise Dropdown */}
            {showAddExercise && (
              <div className="border border-white/10 rounded-xl bg-white/[0.02] p-4 mb-4">
                {libraryExercises.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-white/40 mb-2">No exercises in your library</p>
                    <Link href="/gym/exercises/new" className="text-white hover:text-white/60 text-sm">
                      Create your first exercise →
                    </Link>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {libraryExercises.map((libExercise) => (
                      <button
                        key={libExercise.id}
                        onClick={() => handleAddExercise(libExercise.id)}
                        className="w-full p-3 rounded-lg border border-white/10 bg-white/[0.02] text-white hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <div className="font-medium">{libExercise.name}</div>
                        <div className="text-white/40 text-sm">
                          {libExercise.primary_muscle_group} • {libExercise.equipment_type}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Exercise List */}
            {templateExercises.length === 0 ? (
              <div className="border border-dashed border-white/20 rounded-xl bg-white/[0.01] p-8 text-center">
                <p className="text-white/40">No exercises yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templateExercises.map((exercise, index) => (
                  <div
                    key={exercise.id}
                    className="border border-white/10 rounded-xl bg-white/[0.02] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-1 mt-1">
                        <button
                          onClick={() => handleMoveExercise(exercise.id, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <GripVertical className="w-4 h-4 text-white/40" />
                        </button>
                        <button
                          onClick={() => handleMoveExercise(exercise.id, 'down')}
                          disabled={index === templateExercises.length - 1}
                          className="p-1 rounded hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <GripVertical className="w-4 h-4 text-white/40" />
                        </button>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium text-white">
                            {exercise.exercise_library.name}
                          </h3>
                          <button
                            onClick={() => openDeleteExerciseModal(exercise.id)}
                            className="p-1 rounded hover:bg-white/5"
                          >
                            <Trash2 className="w-4 h-4 text-white/40" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-white/40 text-xs mb-1 block">Target Sets</label>
                            <input
                              type="number"
                              value={exercise.target_sets || ''}
                              onChange={(e) => handleUpdateExercise(
                                exercise.id,
                                'target_sets',
                                e.target.value ? parseInt(e.target.value) : null
                              )}
                              placeholder="3"
                              className="w-full bg-white/5 border-white/10 text-white rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-white/40 text-xs mb-1 block">Rep Range</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={exercise.target_rep_range_min || ''}
                                onChange={(e) => handleUpdateExercise(
                                  exercise.id,
                                  'target_rep_range_min',
                                  e.target.value ? parseInt(e.target.value) : null
                                )}
                                placeholder="8"
                                className="w-full bg-white/5 border-white/10 text-white rounded-lg px-3 py-2 text-sm"
                              />
                              <span className="text-white/40">-</span>
                              <input
                                type="number"
                                value={exercise.target_rep_range_max || ''}
                                onChange={(e) => handleUpdateExercise(
                                  exercise.id,
                                  'target_rep_range_max',
                                  e.target.value ? parseInt(e.target.value) : null
                                )}
                                placeholder="12"
                                className="w-full bg-white/5 border-white/10 text-white rounded-lg px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-white/40 text-xs mb-1 block">Notes</label>
                            <input
                              type="text"
                              value={exercise.notes || ''}
                              onChange={(e) => handleUpdateExercise(exercise.id, 'notes', e.target.value || null)}
                              placeholder="Optional"
                              className="w-full bg-white/5 border-white/10 text-white rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Exercise Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteExerciseModal}
        onOpenChange={setShowDeleteExerciseModal}
        title="Remove Exercise"
        description="Are you sure you want to remove this exercise from the template?"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleRemoveExercise}
        destructive
      />
    </AppLayout>
  )
}
