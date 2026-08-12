'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import ExerciseAlternativesManager from '@/components/gym/exercise-alternatives-manager'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'

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

// Real defaults, not just placeholder hints - a template exercise saved
// with these left blank should never silently contribute 0 to plan volume
// analysis (see computeScheduledMuscleVolume(), which still treats null as
// 0/skip for older data saved before this default existed).
const DEFAULT_TARGET_SETS = 3
const DEFAULT_TARGET_REP_RANGE_MIN = 8
const DEFAULT_TARGET_REP_RANGE_MAX = 12

const FIELD_DEFAULTS: Record<string, number> = {
  target_sets: DEFAULT_TARGET_SETS,
  target_rep_range_min: DEFAULT_TARGET_REP_RANGE_MIN,
  target_rep_range_max: DEFAULT_TARGET_REP_RANGE_MAX,
}

export default function EditTemplatePage() {
  const params = useParams()
  const router = useRouter()
  const [template, setTemplate] = useState<Template | null>(null)
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([])
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
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
      setLoadError(true)
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
      target_sets: DEFAULT_TARGET_SETS,
      target_rep_range_min: DEFAULT_TARGET_REP_RANGE_MIN,
      target_rep_range_max: DEFAULT_TARGET_REP_RANGE_MAX,
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
    // Clearing target_sets/rep-range back to blank should land on the real
    // default, not null - leaving it null is how these silently contributed
    // 0 to plan volume analysis. Other fields (e.g. notes) keep null as a
    // legitimate empty value.
    const resolvedValue = value === null && field in FIELD_DEFAULTS ? FIELD_DEFAULTS[field] : value

    // Update local state immediately so typing stays responsive, and debounce
    // the actual write so a keystroke doesn't fire a DB round trip + refetch.
    setTemplateExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, [field]: resolvedValue } : ex))
    )

    const key = `${exerciseId}:${field}`
    const existingTimer = pendingExerciseUpdates.current.get(key)
    if (existingTimer) clearTimeout(existingTimer)

    const timer = setTimeout(async () => {
      pendingExerciseUpdates.current.delete(key)

      const { error } = await supabase
        .from('workout_template_exercises')
        .update({ [field]: resolvedValue })
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
        <PageSkeleton />
      </AppLayout>
    )
  }

  if (!template) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-lapis-text-tertiary">Template not found</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && <LoadErrorBanner message="Couldn't load this template's exercises. Try refreshing." />}
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <Link href="/gym/templates" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors">
            ← Back
          </Link>
          <button
            onClick={handleSaveTemplate}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lapis-md bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span className="text-sm font-medium">{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>

        <div className="max-w-2xl space-y-6">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name" className="text-lapis-text-secondary">Template Name</Label>
            <Input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="template-description" className="text-lapis-text-secondary">Description</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary resize-none"
            />
          </div>

          {/* Exercises Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-lapis-text-primary">Exercises</h2>
              <button
                onClick={() => setShowAddExercise(!showAddExercise)}
                className="flex items-center gap-2 px-3 py-2 rounded-lapis-sm bg-lapis-surface-2 text-lapis-text-primary hover:bg-lapis-surface-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Add Exercise</span>
              </button>
            </div>

            {/* Add Exercise Dropdown */}
            {showAddExercise && (
              <div className="border border-lapis-border-subtle rounded-lapis-md bg-lapis-surface-1 p-4 mb-4">
                {libraryExercises.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-lapis-text-tertiary mb-2">No exercises in your library</p>
                    <Link href="/gym/exercises/new" className="text-lapis-text-primary hover:text-lapis-text-secondary text-sm">
                      Create your first exercise →
                    </Link>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {libraryExercises.map((libExercise) => (
                      <button
                        key={libExercise.id}
                        onClick={() => handleAddExercise(libExercise.id)}
                        className="w-full p-3 rounded-lapis-sm border border-lapis-border-subtle bg-lapis-surface-1 text-lapis-text-primary hover:bg-lapis-surface-2 transition-colors text-left"
                      >
                        <div className="font-medium">{libExercise.name}</div>
                        <div className="text-lapis-text-tertiary text-sm">
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
              <div className="border border-dashed border-lapis-border-strong rounded-lapis-md bg-lapis-accent-500/[0.01] p-8 text-center">
                <p className="text-lapis-text-tertiary">No exercises yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {templateExercises.map((exercise, index) => (
                  <div
                    key={exercise.id}
                    className="border border-lapis-border-subtle rounded-lapis-md bg-lapis-surface-1 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-1 mt-1">
                        <button
                          onClick={() => handleMoveExercise(exercise.id, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-lapis-surface-2 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <GripVertical className="w-4 h-4 text-lapis-text-tertiary" />
                        </button>
                        <button
                          onClick={() => handleMoveExercise(exercise.id, 'down')}
                          disabled={index === templateExercises.length - 1}
                          className="p-1 rounded hover:bg-lapis-surface-2 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <GripVertical className="w-4 h-4 text-lapis-text-tertiary" />
                        </button>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium text-lapis-text-primary">
                            {exercise.exercise_library.name}
                          </h3>
                          <button
                            onClick={() => openDeleteExerciseModal(exercise.id)}
                            className="p-1 rounded hover:bg-lapis-surface-2"
                          >
                            <Trash2 className="w-4 h-4 text-lapis-text-tertiary" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-lapis-text-tertiary text-xs mb-1 block">Target Sets</label>
                            <input
                              type="number"
                              value={exercise.target_sets || ''}
                              onChange={(e) => handleUpdateExercise(
                                exercise.id,
                                'target_sets',
                                e.target.value ? parseInt(e.target.value) : null
                              )}
                              placeholder="3"
                              className="w-full bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary rounded-lapis-sm px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-lapis-text-tertiary text-xs mb-1 block">Rep Range</label>
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
                                className="w-full bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary rounded-lapis-sm px-3 py-2 text-sm"
                              />
                              <span className="text-lapis-text-tertiary">-</span>
                              <input
                                type="number"
                                value={exercise.target_rep_range_max || ''}
                                onChange={(e) => handleUpdateExercise(
                                  exercise.id,
                                  'target_rep_range_max',
                                  e.target.value ? parseInt(e.target.value) : null
                                )}
                                placeholder="12"
                                className="w-full bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary rounded-lapis-sm px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-lapis-text-tertiary text-xs mb-1 block">Notes</label>
                            <input
                              type="text"
                              value={exercise.notes || ''}
                              onChange={(e) => handleUpdateExercise(exercise.id, 'notes', e.target.value || null)}
                              placeholder="Optional"
                              className="w-full bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary rounded-lapis-sm px-3 py-2 text-sm"
                            />
                          </div>
                        </div>

                        <ExerciseAlternativesManager
                          templateExerciseId={exercise.id}
                          excludeExerciseLibraryId={exercise.exercise_library_id}
                          libraryExercises={libraryExercises}
                        />
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
