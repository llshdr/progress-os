'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, X, Trash2, Pencil, Trophy, WifiOff } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { getExerciseRecommendation, RecommendationResult } from '@/lib/ai-coach/client'
import { getLocalDateString } from '@/lib/date'
import { selectActiveMesocycle, type Mesocycle } from '@/lib/mesocycle'
import { getExerciseHistory } from '@/lib/ai-coach/getExerciseHistory'
import { estimateOneRepMax } from '@/lib/estimate1rm'
import { useOnlineStatus } from '@/lib/use-online-status'

interface SetLoggerProps {
  exerciseId: string
  exerciseName: string
  exerciseLibraryId?: string | null
  templateExerciseId?: string | null
  onSwap?: () => void
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
  set_type: 'drop' | 'myo' | null
  rir: number | null
}

type SetType = 'normal' | 'drop' | 'myo'

const RIR_VALUES = Array.from({ length: 11 }, (_, i) => i)

const SET_TYPE_LABEL: Record<SetType, string> = { normal: 'Normal', drop: 'Drop', myo: 'Myo' }
const SET_TYPE_TAG: Record<'drop' | 'myo', string> = { drop: 'drop', myo: 'myo' }

interface Variant {
  id: string
  label: string
}

interface Alternative {
  exerciseLibraryId: string
  name: string
}

export default function SetLogger({
  exerciseId,
  exerciseName,
  exerciseLibraryId,
  templateExerciseId,
  onSwap,
  onComplete,
}: SetLoggerProps) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  // UI-only until save time - 'normal' maps to a null set_type in the DB
  // (see handleSaveSet), so the vast majority of sets that never touch
  // this stay indistinguishable from before this feature existed.
  const [setType, setSetType] = useState<SetType>('normal')
  // Optional, per-set - null unless explicitly picked, same "never require
  // it" precedent as setType above. Replaces the old session-wide
  // session_rir rating (migration 067) with the real per-set signal RIR
  // is meant to capture.
  const [rir, setRir] = useState<number | null>(null)
  const [currentSetNumber, setCurrentSetNumber] = useState(1)
  const [previousSet, setPreviousSet] = useState<PreviousSet | null>(null)
  const [savedSets, setSavedSets] = useState<SavedSet[]>([])
  const [loading, setLoading] = useState(false)
  const [showDeleteSetModal, setShowDeleteSetModal] = useState(false)
  const [setToDelete, setSetToDelete] = useState<string | null>(null)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [editReps, setEditReps] = useState('')
  const [editRir, setEditRir] = useState<number | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<RecommendationResult | null>(null)
  const [variants, setVariants] = useState<Variant[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [alternatives, setAlternatives] = useState<Alternative[]>([])
  const [swapping, setSwapping] = useState(false)
  // Optimistic default while the saved setting loads, corrected below once
  // it resolves - avoids a flash for the common case (setting is true).
  const [includeNutrition, setIncludeNutrition] = useState(true)
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null)
  const [restTarget, setRestTarget] = useState(90)
  const [restNow, setRestNow] = useState(Date.now())
  // Whether TODAY falls in an active mesocycle's planned deload week -
  // snapshotted onto each set logged during it (see handleSaveSet).
  // Deload sets are intentionally light and shouldn't become a "last
  // set"/progression baseline later - same exclusion idea this file
  // already applies to drop/myo sets in fetchPreviousSet below, just a
  // different reason a set isn't a real top-set data point.
  const [isDeloadWeek, setIsDeloadWeek] = useState(false)
  // Best estimated 1RM among this exercise's real top-set history (drop/myo
  // and deload-week sets excluded - see fetchPersonalBest), null until
  // that history loads or there simply isn't any yet. Used only to detect
  // a PR moment below - never displayed as its own number here, that's
  // what the Records page is for.
  const [personalBestEst1RM, setPersonalBestEst1RM] = useState<number | null>(null)
  const [showPrCelebration, setShowPrCelebration] = useState(false)
  const isOnline = useOnlineStatus()
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

  // Alternatives defined on this exercise's template slot (if it came from
  // one) - a live-workout counterpart to equipment variants, but swapping
  // the whole exercise rather than just its equipment.
  useEffect(() => {
    if (!templateExerciseId) {
      setAlternatives([])
      return
    }

    supabase
      .from('workout_template_exercise_alternatives')
      .select('alternative_exercise_library_id, exercise_library(name)')
      .eq('template_exercise_id', templateExerciseId)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching exercise alternatives:', error)
          return
        }
        setAlternatives(
          (data ?? []).map((row: any) => ({
            exerciseLibraryId: row.alternative_exercise_library_id,
            name: row.exercise_library?.name ?? 'Unknown',
          }))
        )
      })
  }, [templateExerciseId])

  // Only offered before any sets are logged for this instance - a swap is a
  // pre-session choice, not a mid-set correction. Once sets exist they
  // genuinely belong to the original exercise, so relabeling them under a
  // different name would be dishonest; delete-and-re-add remains available
  // for that case exactly as it already is today. Never touches the
  // template itself - only this session's exercise row.
  const handleSwapExercise = async (altId: string) => {
    if (savedSets.length > 0) return

    setSwapping(true)
    const { error } = await supabase
      .from('exercises')
      .update({ exercise_library_id: altId, variant_id: null })
      .eq('id', exerciseId)
    setSwapping(false)

    if (error) {
      console.error('Error swapping exercise:', error)
      alert('Failed to swap exercise')
      return
    }

    if (onSwap) onSwap()
  }

  // Saved default for the nutrition toggle - fetched once, not per exercise.
  useEffect(() => {
    supabase
      .from('user_settings')
      .select('ai_coach_include_nutrition')
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) setIncludeNutrition(data.ai_coach_include_nutrition ?? true)
      })
  }, [])

  // Whether today is a deload week - fetched once, not per exercise, same
  // pattern as the nutrition-toggle default above. Same fetch-then-
  // selectActiveMesocycle shape already used independently in
  // dashboard-client.tsx/mesocycle-card.tsx/calendar/page.tsx.
  useEffect(() => {
    const fetchDeloadStatus = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('training_mesocycles')
        .select('id, start_date, length_weeks, deload_week_number, label')
        .eq('user_id', user.id)
      if (error) return

      const mesocycles: Mesocycle[] = (data ?? []).map((r) => ({
        id: r.id,
        startDate: r.start_date,
        lengthWeeks: r.length_weeks,
        deloadWeekNumber: r.deload_week_number,
        label: r.label,
      }))

      setIsDeloadWeek(selectActiveMesocycle(mesocycles, getLocalDateString())?.isDeloadWeek ?? false)
    }
    fetchDeloadStatus()
  }, [])

  // This exercise's real personal-best est. 1RM, for PR-celebration
  // detection below - reuses the AI Coach's own history fetch (already
  // excludes deload-week sets, see getExerciseHistory.ts) rather than a
  // separate query. Drop/myo sets are filtered out here too: a follow-on
  // burnout set was never a real top-set attempt, so it shouldn't be able
  // to either set or beat a PR.
  useEffect(() => {
    getExerciseHistory(supabase, exerciseLibraryId ?? null, exerciseName).then((history) => {
      const normalSets = history.filter((h) => h.technique === null)
      if (normalSets.length === 0) {
        setPersonalBestEst1RM(null)
        return
      }
      setPersonalBestEst1RM(Math.max(...normalSets.map((s) => estimateOneRepMax(s.weight, s.reps))))
    })
  }, [exerciseLibraryId, exerciseName])

  // Flipping it also persists as the new default for next time, same
  // precedent as variant_id/training_phase already saving immediately.
  const handleToggleNutrition = async () => {
    const next = !includeNutrition
    setIncludeNutrition(next)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('user_settings')
      .update({ ai_coach_include_nutrition: next })
      .eq('user_id', user.id)

    if (error) {
      console.error('Error saving nutrition toggle:', error)
    }
  }

  // AI Coach suggestion — fails silently, this is a lightweight in-flow hint,
  // not the primary surface for the feature (that's the exercise detail page).
  useEffect(() => {
    let cancelled = false
    setAiSuggestion(null)

    getExerciseRecommendation({
      exerciseLibraryId,
      exerciseName,
      variantLabel: selectedVariantLabel,
      includeNutrition,
    }).then((res) => {
      if (!cancelled) setAiSuggestion(res)
    })

    return () => {
      cancelled = true
    }
  }, [exerciseId, exerciseLibraryId, exerciseName, selectedVariantLabel, includeNutrition])

  const fetchPreviousSet = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Get the most recent completed NORMAL, non-deload set for this
    // exercise - a drop/myo follow-on is a reduced-weight/rest-pause
    // bonus set, and a deload-week set is intentionally lighter by
    // design (see mesocycle.ts) - neither is a real top-set data point,
    // so neither should ever become the "Last: X × Y" basis for next
    // session's prefill.
    const { data, error } = await supabase
      .from('sets')
      .select('weight, reps, created_at')
      .eq('exercise_id', exerciseId)
      .eq('completed', true)
      .is('set_type', null)
      .eq('is_deload_week', false)
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
      .select('id, weight, reps, set_order, set_type, rir')
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
    const weightNum = parseFloat(weight)
    const repsNum = parseInt(reps)

    const { error } = await supabase.from('sets').insert({
      exercise_id: exerciseId,
      weight: weightNum,
      reps: repsNum,
      completed: true,
      set_order: currentSetNumber,
      rest_time_seconds: restTimeSeconds,
      set_type: setType === 'normal' ? null : setType,
      rir,
      is_deload_week: isDeloadWeek,
    })

    if (error) {
      console.error('Error saving set:', error)
      alert(
        isOnline
          ? 'Failed to save set. Please try again.'
          : "You're offline - this set wasn't saved. Reconnect, then log it again."
      )
      setLoading(false)
      return
    }

    // PR check - only for a real top-set attempt (not a drop/myo follow-on,
    // and not a deload-week set, which is intentionally light and was never
    // trying to be a PR). Silently updates the tracked best either way, so
    // a second beat within the same session is still caught; only fires
    // the celebration when there was real prior history to beat - a first-
    // ever logged set for this exercise has nothing to celebrate against.
    if (setType === 'normal' && !isDeloadWeek) {
      const newEst1RM = estimateOneRepMax(weightNum, repsNum)
      if (personalBestEst1RM != null && newEst1RM > personalBestEst1RM) {
        setShowPrCelebration(true)
        setTimeout(() => setShowPrCelebration(false), 4000)
      }
      if (personalBestEst1RM == null || newEst1RM > personalBestEst1RM) {
        setPersonalBestEst1RM(newEst1RM)
      }
    }

    // Prepare for next set
    setCurrentSetNumber(prev => prev + 1)
    setReps('')
    setSetType('normal')
    setRir(null)
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
    setEditRir(set.rir)
  }

  const cancelEditSet = () => {
    setEditingSetId(null)
  }

  const handleUpdateSet = async () => {
    if (!editingSetId || !editWeight || !editReps) return

    const { error } = await supabase
      .from('sets')
      .update({ weight: parseFloat(editWeight), reps: parseInt(editReps), rir: editRir })
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
      {/* Proactive - shown before a save is even attempted, so a lost
          connection is never a silent surprise mid-log. navigator.onLine
          is a real browser signal but not a guarantee (see
          use-online-status.ts) - the alert() in handleSaveSet above is
          still the real backstop if a save fails for any reason. */}
      {!isOnline && (
        <div className="flex items-center gap-2 border border-lapis-garnet/40 bg-lapis-garnet/[0.06] rounded-lapis-md px-4 py-3 text-sm text-lapis-garnet">
          <WifiOff className="w-4 h-4 shrink-0" />
          You&apos;re offline - sets won&apos;t save until you&apos;re back online.
        </div>
      )}

      {/* Exercise Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-lapis-text-primary mb-1">
          {exerciseName}
        </h2>
        {previousSet && (
          <div className="text-lapis-text-tertiary text-sm">
            Last: {previousSet.weight} × {previousSet.reps}
          </div>
        )}
        {aiSuggestion?.status === 'ok' && (
          <div className="text-lapis-text-tertiary text-sm mt-1">
            Suggested: {aiSuggestion.weight} kg × {aiSuggestion.reps}
          </div>
        )}
        {(aiSuggestion?.status === 'ok' || aiSuggestion?.status === 'not_enough_history') && (
          <button
            type="button"
            onClick={handleToggleNutrition}
            className="mt-1.5 px-2.5 py-1 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle hover:bg-lapis-surface-2 hover:text-lapis-text-secondary transition-colors"
          >
            Nutrition {includeNutrition ? 'factored in' : 'not factored in'}
          </button>
        )}
      </div>

      {/* Equipment Variant Picker — only shown when this exercise has any
          defined; optional, defaults to none. */}
      {variants.length > 0 && (
        <div>
          <div className="text-lapis-text-tertiary text-xs mb-2">Equipment (optional)</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSelectVariant(null)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                selectedVariantId === null
                  ? 'bg-lapis-accent-500 text-lapis-text-primary'
                  : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2'
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
                    ? 'bg-lapis-accent-500 text-lapis-text-primary'
                    : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2'
                }`}
              >
                {variant.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Swap Exercise — only before any sets are logged for this instance;
          this never changes the template, just this session's exercise. */}
      {alternatives.length > 0 && savedSets.length === 0 && (
        <div>
          <div className="text-lapis-text-tertiary text-xs mb-2">Swap exercise (optional)</div>
          <div className="flex flex-wrap gap-2">
            {alternatives.map((alt) => (
              <button
                key={alt.exerciseLibraryId}
                type="button"
                disabled={swapping}
                onClick={() => handleSwapExercise(alt.exerciseLibraryId)}
                className="px-3 py-1.5 rounded-full text-sm bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2 transition-colors disabled:opacity-50"
              >
                {alt.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PR celebration - brief, auto-dismissing, gold accent (same treatment
          dashboard-client.tsx already uses for its own gold-accented callout)
          rather than a new visual language. No confetti/emoji - a clean
          bordered callout that fades in and clears itself. */}
      {showPrCelebration && (
        <div className="animate-in fade-in zoom-in-95 duration-300 border border-lapis-gold-500/40 rounded-lapis-md bg-lapis-gold-500/[0.08] px-4 py-3 flex items-center gap-2.5">
          <Trophy className="w-4 h-4 text-lapis-gold-500 shrink-0" />
          <p className="text-lapis-text-primary text-sm">New PR — that beat your previous best on this exercise.</p>
        </div>
      )}

      {/* Saved Sets */}
      {savedSets.length > 0 && (
        <div className="space-y-2">
          {savedSets.map((set) => (
            <div
              key={set.id}
              className="flex items-center justify-between border border-lapis-border-subtle rounded-lapis-md bg-lapis-surface-1 p-4"
            >
              {editingSetId === set.id ? (
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lapis-text-tertiary text-sm shrink-0">Set {set.set_order}</span>
                    <Input
                      type="number"
                      step="0.5"
                      value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)}
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary h-9 w-20 text-center"
                      autoFocus
                    />
                    <span className="text-lapis-text-tertiary">×</span>
                    <Input
                      type="number"
                      value={editReps}
                      onChange={(e) => setEditReps(e.target.value)}
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary h-9 w-16 text-center"
                    />
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={handleUpdateSet}
                        disabled={!editWeight || !editReps}
                        className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 text-lapis-text-secondary hover:text-lapis-text-primary transition-colors disabled:opacity-30"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEditSet}
                        className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-lapis-text-tertiary text-xs mr-1">RIR</span>
                    {RIR_VALUES.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setEditRir(editRir === value ? null : value)}
                        className={`w-6 h-6 rounded-full text-[10px] font-medium transition-colors ${
                          editRir === value
                            ? 'bg-lapis-accent-500 text-lapis-text-primary'
                            : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-3'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <span className="text-lapis-text-tertiary text-sm">Set {set.set_order}</span>
                    <span className="text-lapis-text-primary font-medium">{set.weight} × {set.reps}</span>
                    {set.set_type && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle">
                        {SET_TYPE_TAG[set.set_type]}
                      </span>
                    )}
                    {set.rir != null && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle">
                        RIR {set.rir}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEditSet(set)}
                      className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteSetModal(set.id)}
                      className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors"
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
        <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-lapis-text-tertiary text-xs mb-1">Rest</div>
            <div className="text-2xl font-semibold text-lapis-text-primary tabular-nums">
              {formatRestTime(restElapsedSeconds)}
            </div>
            <div className="text-lapis-text-disabled text-xs mt-1">Target: {formatRestTime(restTarget)}</div>
          </div>
          <div className="flex items-center gap-2">
            {/* Myo-reps use very short rest-pause intervals (~10-20s) between
                mini-sets, well under the normal presets - only shown while
                the CURRENT set being logged is tagged myo. */}
            {(setType === 'myo' ? [15, 60, 90, 120] : [60, 90, 120]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRestTarget(preset)}
                className={`px-3 py-1.5 rounded-lapis-sm text-xs font-medium transition-colors ${
                  restTarget === preset ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                }`}
              >
                {preset}s
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRestStartedAt(null)}
              className="px-3 py-1.5 rounded-lapis-sm text-xs font-medium bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2 transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Current Set */}
      <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
        <div className="text-lapis-text-tertiary text-sm mb-4">
          Set {currentSetNumber}
        </div>

        <div className="space-y-4">
          {/* Weight Input */}
          <div className="space-y-2">
            <label className="text-lapis-text-secondary text-sm">Weight (kg)</label>
            <Input
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="82.5"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary text-2xl font-semibold h-16 text-center placeholder:text-lapis-text-disabled"
              autoFocus
            />
          </div>

          {/* Reps Input */}
          <div className="space-y-2">
            <label className="text-lapis-text-secondary text-sm">Reps</label>
            <Input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="8"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary text-2xl font-semibold h-16 text-center placeholder:text-lapis-text-disabled"
            />
          </div>

          {/* Technique - always visible, defaults to Normal. Mirrors the
              Equipment Variant picker's pill-button style above. */}
          <div className="space-y-2">
            <label className="text-lapis-text-secondary text-sm">Technique</label>
            <div className="flex flex-wrap gap-2">
              {(['normal', 'drop', 'myo'] as SetType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSetType(t)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    setType === t ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2'
                  }`}
                >
                  {SET_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* RIR (reps in reserve) - optional, defaults unset. Per-set,
              not per-session (see migration 075/session_rir's own
              retirement) - 0 = failure, 10 = very easy. Tapping the
              already-selected value clears it, same toggle-off precedent
              as the session-level picker this replaces. */}
          <div className="space-y-2">
            <label className="text-lapis-text-secondary text-sm">RIR (reps in reserve, optional)</label>
            <div className="flex flex-wrap gap-1.5">
              {RIR_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRir(rir === value ? null : value)}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                    rir === value
                      ? 'bg-lapis-accent-500 text-lapis-text-primary'
                      : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-3'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSaveSet}
              disabled={loading || !weight || !reps}
              className="flex-1 bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-14 text-base font-medium"
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
              className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 h-14 px-4"
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
        className="w-full border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 h-12"
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
