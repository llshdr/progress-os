'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, X, Trash2, Pencil } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { getExerciseRecommendation, RecommendationResult } from '@/lib/ai-coach/client'

interface SetLoggerProps {
  exerciseId: string
  exerciseName: string
  exerciseLibraryId?: string | null
  onComplete?: () => void
}

interface PreviousSet {
  weight: number
  reps: number
  date: string
}

interface SavedSet {
  id: string
  weight: number
  reps: number
  set_order: number
}

interface Variant {
  id: string
  label: string
}

export default function SetLogger({ exerciseId, exerciseName, exerciseLibraryId, onComplete }: SetLoggerProps) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [currentSetNumber, setCurrentSetNumber] = useState(1)
  const [previousSet, setPreviousSet] = useState<PreviousSet | null>(null)
  const [savedSets, setSavedSets] = useState<SavedSet[]>([])
  const [loading, setLoading] = useState(false)
  const [showDeleteSetModal, setShowDeleteSetModal] = useState(false)
  const [setToDelete, setSetToDelete] = useState<string | null>(null)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [editReps, setEditReps] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState<RecommendationResult | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null)
  const [restTarget, setRestTarget] = useState(90)
  const [restNow, setRestNow] = useState(Date.now())
  const supabase = createClient()

  // Ticks the visible rest timer while it's running. Nothing to rest from
  // before the first set of this exercise, so it only starts after a save.
  useEffect(() => {
    if (restStartedAt === null) return
    const interval = setInterval(() => setRestNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [restStartedAt])

  const restElapsedSeconds =
    restStartedAt !== null ? Math.floor((restNow - restStartedAt) / 1000) : 0

  const formatRestTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  // Fetch the last set for this exercise to suggest weight/reps
  useEffect(() => {
    fetchPreviousSet()
    fetchSavedSets()
  }, [exerciseId])

  // Equipment variants defined for this exercise (if any) and whichever one
  // was already picked for this workout instance, if this page is revisited.
  useEffect(() => {
    if (!exerciseLibraryId) {
      setVariants([])
      return
    }

    supabase
      .from('exercise_variants')
      .select('id, label')
      .eq('exercise_library_id', exerciseLibraryId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setVariants(data || [])
      })
  }, [exerciseLibraryId])

  useEffect(() => {
    supabase
      .from('exercises')
      .select('variant_id')
      .eq('id', exerciseId)
      .single()
      .then(({ data, error }) => {
        if (!error) setSelectedVariantId(data?.variant_id ?? null)
      })
  }, [exerciseId])

  const selectedVariantLabel = variants.find((v) => v.id === selectedVariantId)?.label ?? null

  const handleSelectVariant = async (variantId: string | null) => {
    setSelectedVariantId(variantId)
    const { error } = await supabase.from('exercises').update({ variant_id: variantId }).eq('id', exerciseId)
    if (error) {
      console.error('Error saving variant selection:', error)
    }
  }

  // AI Coach suggestion — fails silently, this is a lightweight in-flow hint,
  // not the primary surface for the feature (that's the exercise detail page).
  useEffect(() => {
    let cancelled = false
    setAiSuggestion(null)

    getExerciseRecommendation({ exerciseLibraryId, exerciseName, variantLabel: selectedVariantLabel }).then((res) => {
      if (!cancelled) setAiSuggestion(res)
    })

    return () => {
      cancelled = true
    }
  }, [exerciseId, exerciseLibraryId, exerciseName, selectedVariantLabel])

  const fetchPreviousSet = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Get the most recent completed set for this exercise
    const { data, error } = await supabase
      .from('sets')
      .select('weight, reps, created_at')
      .eq('exercise_id', exerciseId)
      .eq('completed', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data && !error) {
      setPreviousSet({
        weight: data.weight,
        reps: data.reps,
        date: data.created_at,
      })
      // Pre-fill weight from last set
      setWeight(data.weight.toString())
    }
  }

  const fetchSavedSets = async () => {
    const { data, error } = await supabase
      .from('sets')
      .select('id, weight, reps, set_order')
      .eq('exercise_id', exerciseId)
      .order('set_order', { ascending: true })

    if (!error && data) {
      setSavedSets(data)
      // Set current set number to next available
      if (data.length > 0) {
        setCurrentSetNumber(data.length + 1)
      }
    }
  }

  const handleSaveSet = async () => {
    if (!weight || !reps) return

    setLoading(true)

    // Rest time is however long actually elapsed since the previous set was
    // saved — the target/presets below are just a visual reference, not
    // enforced.
    const restTimeSeconds = restStartedAt !== null ? Math.round((Date.now() - restStartedAt) / 1000) : null

    const { error } = await supabase.from('sets').insert({
      exercise_id: exerciseId,
      weight: parseFloat(weight),
      reps: parseInt(reps),
      completed: true,
      set_order: currentSetNumber,
      rest_time_seconds: restTimeSeconds,
    })

    if (error) {
      console.error('Error saving set:', error)
      alert('Failed to save set')
      setLoading(false)
      return
    }

    // Prepare for next set
    setCurrentSetNumber(prev => prev + 1)
    setReps('')
    // Keep the same weight for next set (common pattern)
    setLoading(false)
    setRestStartedAt(Date.now())
    setRestNow(Date.now())
    fetchSavedSets()
  }

  const handleSkipSet = () => {
    setCurrentSetNumber(prev => prev + 1)
    setReps('')
  }

  const handleDeleteSet = async () => {
    if (!setToDelete) return

    const { error } = await supabase
      .from('sets')
      .delete()
      .eq('id', setToDelete)

    if (error) {
      console.error('Error deleting set:', error)
      alert('Failed to delete set')
      setSetToDelete(null)
      return
    }

    // Renumber remaining sets before refetching, so what we display next
    // reflects the final order rather than a stale in-between state.
    const remainingSets = savedSets.filter((s) => s.id !== setToDelete)
    const renumberResults = await Promise.all(
      remainingSets.map((set, index) =>
        supabase.from('sets').update({ set_order: index + 1 }).eq('id', set.id)
      )
    )

    const renumberError = renumberResults.find((r) => r.error)?.error
    if (renumberError) {
      console.error('Error renumbering sets:', renumberError)
      alert('Set deleted, but renumbering the remaining sets failed. Please refresh.')
    }

    await fetchSavedSets()
    setSetToDelete(null)
  }

  const openDeleteSetModal = (setId: string) => {
    setSetToDelete(setId)
    setShowDeleteSetModal(true)
  }

  const startEditSet = (set: SavedSet) => {
    setEditingSetId(set.id)
    setEditWeight(set.weight.toString())
    setEditReps(set.reps.toString())
  }

  const cancelEditSet = () => {
    setEditingSetId(null)
  }

  const handleUpdateSet = async () => {
    if (!editingSetId || !editWeight || !editReps) return

    const { error } = await supabase
      .from('sets')
      .update({ weight: parseFloat(editWeight), reps: parseInt(editReps) })
      .eq('id', editingSetId)

    if (error) {
      console.error('Error updating set:', error)
      alert('Failed to update set')
      return
    }

    setEditingSetId(null)
    fetchSavedSets()
  }

  const handleFinishExercise = () => {
    if (onComplete) onComplete()
  }

  return (
    <div className="space-y-6">
      {/* Exercise Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white mb-1">
          {exerciseName}
        </h2>
        {previousSet && (
          <div className="text-white/40 text-sm">
            Last: {previousSet.weight} × {previousSet.reps}
          </div>
        )}
        {aiSuggestion?.status === 'ok' && (
          <div className="text-white/50 text-sm mt-1">
            Suggested: {aiSuggestion.weight} kg × {aiSuggestion.reps}
          </div>
        )}
      </div>

      {/* Equipment Variant Picker — only shown when this exercise has any
          defined; optional, defaults to none. */}
      {variants.length > 0 && (
        <div>
          <div className="text-white/40 text-xs mb-2">Equipment (optional)</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSelectVariant(null)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                selectedVariantId === null
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              None
            </button>
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => handleSelectVariant(variant.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedVariantId === variant.id
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
              >
                {variant.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved Sets */}
      {savedSets.length > 0 && (
        <div className="space-y-2">
          {savedSets.map((set) => (
            <div
              key={set.id}
              className="flex items-center justify-between border border-white/10 rounded-xl bg-white/[0.02] p-4"
            >
              {editingSetId === set.id ? (
                <>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-white/40 text-sm shrink-0">Set {set.set_order}</span>
                    <Input
                      type="number"
                      step="0.5"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      className="bg-white/5 border-white/10 text-white h-9 w-20 text-center"
                      autoFocus
                    />
                    <span className="text-white/40">×</span>
                    <Input
                      type="number"
                      value={editReps}
                      onChange={(e) => setEditReps(e.target.value)}
                      className="bg-white/5 border-white/10 text-white h-9 w-16 text-center"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleUpdateSet}
                      disabled={!editWeight || !editReps}
                      className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors disabled:opacity-30"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditSet}
                      className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <span className="text-white/40 text-sm">Set {set.set_order}</span>
                    <span className="text-white font-medium">{set.weight} × {set.reps}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEditSet(set)}
                      className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteSetModal(set.id)}
                      className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rest Timer */}
      {restStartedAt !== null && (
        <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-white/40 text-xs mb-1">Rest</div>
            <div className="text-2xl font-semibold text-white tabular-nums">
              {formatRestTime(restElapsedSeconds)}
            </div>
            <div className="text-white/30 text-xs mt-1">Target: {formatRestTime(restTarget)}</div>
          </div>
          <div className="flex items-center gap-2">
            {[60, 90, 120].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRestTarget(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  restTarget === preset ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {preset}s
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRestStartedAt(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white/60 hover:bg-white/10 transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Current Set */}
      <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
        <div className="text-white/40 text-sm mb-4">
          Set {currentSetNumber}
        </div>

        <div className="space-y-4">
          {/* Weight Input */}
          <div className="space-y-2">
            <label className="text-white/60 text-sm">Weight (kg)</label>
            <Input
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="82.5"
              className="bg-white/5 border-white/10 text-white text-2xl font-semibold h-16 text-center placeholder:text-white/20"
              autoFocus
            />
          </div>

          {/* Reps Input */}
          <div className="space-y-2">
            <label className="text-white/60 text-sm">Reps</label>
            <Input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="8"
              className="bg-white/5 border-white/10 text-white text-2xl font-semibold h-16 text-center placeholder:text-white/20"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSaveSet}
              disabled={loading || !weight || !reps}
              className="flex-1 bg-white text-black hover:bg-white/90 h-14 text-base font-medium"
            >
              {loading ? (
                'Saving...'
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Save Set
                </>
              )}
            </Button>
            <Button
              onClick={handleSkipSet}
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5 h-14 px-4"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Finish Button */}
      <Button
        onClick={handleFinishExercise}
        variant="outline"
        className="w-full border-white/10 text-white hover:bg-white/5 h-12"
      >
        Finish Exercise
      </Button>

      {/* Delete Set Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteSetModal}
        onOpenChange={setShowDeleteSetModal}
        title="Delete Set"
        description="Are you sure you want to delete this set?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteSet}
        destructive
      />
    </div>
  )
}
