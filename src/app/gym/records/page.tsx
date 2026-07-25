'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Award, ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { estimateOneRepMax } from '@/lib/estimate1rm'
import { MUSCLE_GROUPS, EXERCISE_TYPES, type ExerciseType } from '@/lib/exercise-constants'

type ComputedStrength = { bestWeight: number; bestReps: number; estimated1RM: number; timesPerformed: number }
type ManualStrength = { weight: number; reps: number; estimated1RM: number; date: string | null; note: string | null }

type ComputedCardio = { bestDistance: number; bestPaceSecondsPerKm: number | null; timesPerformed: number }
type ManualCardio = { distanceKm: number; durationSeconds: number; date: string | null; note: string | null }

type StrengthRecord = {
  id: string
  name: string
  muscleGroup: string
  computed: ComputedStrength | null
  manual: ManualStrength | null
}

type CardioRecord = {
  id: string
  name: string
  muscleGroup: string
  computed: ComputedCardio | null
  manual: ManualCardio | null
}

type LibraryExercise = { id: string; name: string; exercise_type: string }

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds === 0 ? `${minutes} min` : `${minutes}m ${seconds}s`
}

export default function RecordsPage() {
  const [strengthRecords, setStrengthRecords] = useState<StrengthRecord[]>([])
  const [cardioRecords, setCardioRecords] = useState<CardioRecord[]>([])
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [exerciseMode, setExerciseMode] = useState<'library' | 'custom'>('library')
  const [selectedLibraryId, setSelectedLibraryId] = useState('')
  const [customName, setCustomName] = useState('')
  const [customType, setCustomType] = useState<ExerciseType>('strength')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [recordedDate, setRecordedDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchRecords()
  }, [])

  const fetchRecords = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: library, error: libraryError } = await supabase
      .from('exercise_library')
      .select('id, name, primary_muscle_group, exercise_type')
      .eq('user_id', user.id)
      .eq('archived', false)

    if (libraryError) {
      console.error('Error fetching exercise library:', libraryError)
      setLoading(false)
      return
    }

    setLibraryExercises((library ?? []).map((l) => ({ id: l.id, name: l.name, exercise_type: l.exercise_type })))

    // One flat pair of queries reduced client-side, instead of the exercise
    // detail page's per-workout fetch repeated once per library exercise -
    // that N+1 doesn't scale to "every exercise in the library".
    const { data: instances, error: instancesError } = await supabase
      .from('exercises')
      .select('id, exercise_library_id')
      .not('exercise_library_id', 'is', null)

    if (instancesError) {
      console.error('Error fetching exercise instances:', instancesError)
      setLoading(false)
      return
    }

    const libraryIdByInstanceId = new Map<string, string>()
    for (const instance of instances ?? []) {
      libraryIdByInstanceId.set(instance.id, instance.exercise_library_id as string)
    }

    const [
      { data: sets, error: setsError },
      { data: cardioLogs, error: cardioError },
      { data: manualPrs, error: manualError },
    ] = await Promise.all([
      supabase.from('sets').select('exercise_id, weight, reps'),
      supabase.from('cardio_logs').select('exercise_id, distance_km, duration_seconds'),
      supabase
        .from('manual_prs')
        .select('exercise_library_id, exercise_name, exercise_type, weight, reps, distance_km, duration_seconds, recorded_date, note')
        .eq('user_id', user.id),
    ])

    if (setsError) console.error('Error fetching sets:', setsError)
    if (cardioError) console.error('Error fetching cardio logs:', cardioError)
    if (manualError) console.error('Error fetching manual PRs:', manualError)

    type StrengthAgg = { bestWeight: number; bestReps: number; instanceIds: Set<string> }
    const strengthAgg = new Map<string, StrengthAgg>()

    for (const set of sets ?? []) {
      const libraryId = libraryIdByInstanceId.get(set.exercise_id)
      if (!libraryId) continue

      const w = typeof set.weight === 'string' ? parseFloat(set.weight) : set.weight
      const r = typeof set.reps === 'string' ? parseInt(set.reps) : set.reps

      const existing = strengthAgg.get(libraryId)
      if (!existing) {
        strengthAgg.set(libraryId, { bestWeight: w, bestReps: r, instanceIds: new Set([set.exercise_id]) })
      } else {
        existing.instanceIds.add(set.exercise_id)
        if (w > existing.bestWeight || (w === existing.bestWeight && r > existing.bestReps)) {
          existing.bestWeight = w
          existing.bestReps = r
        }
      }
    }

    type CardioAgg = { bestDistance: number; bestPaceSecondsPerKm: number | null; instanceIds: Set<string> }
    const cardioAgg = new Map<string, CardioAgg>()

    for (const log of cardioLogs ?? []) {
      const libraryId = libraryIdByInstanceId.get(log.exercise_id)
      if (!libraryId) continue

      const distance = typeof log.distance_km === 'string' ? parseFloat(log.distance_km) : log.distance_km
      const pace = distance > 0 ? log.duration_seconds / distance : null

      const existing = cardioAgg.get(libraryId)
      if (!existing) {
        cardioAgg.set(libraryId, { bestDistance: distance, bestPaceSecondsPerKm: pace, instanceIds: new Set([log.exercise_id]) })
      } else {
        existing.instanceIds.add(log.exercise_id)
        if (distance > existing.bestDistance) existing.bestDistance = distance
        if (pace != null && (existing.bestPaceSecondsPerKm == null || pace < existing.bestPaceSecondsPerKm)) {
          existing.bestPaceSecondsPerKm = pace
        }
      }
    }

    // Manual PRs linked to a library exercise merge into that exercise's
    // row below; best-of is kept per library id in case of multiple manual
    // entries for the same exercise. Free-text ones (no library link) are
    // collected separately and rendered as their own standalone rows.
    const manualStrengthByLibraryId = new Map<string, ManualStrength>()
    const manualCardioByLibraryId = new Map<string, ManualCardio>()
    const standaloneStrength: { name: string; manual: ManualStrength }[] = []
    const standaloneCardio: { name: string; manual: ManualCardio }[] = []

    for (const pr of manualPrs ?? []) {
      const w = pr.weight != null ? (typeof pr.weight === 'string' ? parseFloat(pr.weight) : pr.weight) : null
      const d =
        pr.distance_km != null ? (typeof pr.distance_km === 'string' ? parseFloat(pr.distance_km) : pr.distance_km) : null

      if (pr.exercise_type === 'cardio') {
        if (d == null || pr.duration_seconds == null) continue
        const manual: ManualCardio = { distanceKm: d, durationSeconds: pr.duration_seconds, date: pr.recorded_date, note: pr.note }

        if (pr.exercise_library_id) {
          const existing = manualCardioByLibraryId.get(pr.exercise_library_id)
          if (!existing || manual.distanceKm > existing.distanceKm) manualCardioByLibraryId.set(pr.exercise_library_id, manual)
        } else if (pr.exercise_name) {
          standaloneCardio.push({ name: pr.exercise_name, manual })
        }
      } else {
        if (w == null || pr.reps == null) continue
        const manual: ManualStrength = { weight: w, reps: pr.reps, estimated1RM: estimateOneRepMax(w, pr.reps), date: pr.recorded_date, note: pr.note }

        if (pr.exercise_library_id) {
          const existing = manualStrengthByLibraryId.get(pr.exercise_library_id)
          if (!existing || manual.estimated1RM > existing.estimated1RM) manualStrengthByLibraryId.set(pr.exercise_library_id, manual)
        } else if (pr.exercise_name) {
          standaloneStrength.push({ name: pr.exercise_name, manual })
        }
      }
    }

    const strength: StrengthRecord[] = []
    const cardio: CardioRecord[] = []

    for (const exercise of library ?? []) {
      if (exercise.exercise_type === 'cardio') {
        const agg = cardioAgg.get(exercise.id)
        const manual = manualCardioByLibraryId.get(exercise.id) ?? null
        if (!agg && !manual) continue
        cardio.push({
          id: exercise.id,
          name: exercise.name,
          muscleGroup: exercise.primary_muscle_group,
          computed: agg
            ? { bestDistance: agg.bestDistance, bestPaceSecondsPerKm: agg.bestPaceSecondsPerKm, timesPerformed: agg.instanceIds.size }
            : null,
          manual,
        })
      } else {
        const agg = strengthAgg.get(exercise.id)
        const manual = manualStrengthByLibraryId.get(exercise.id) ?? null
        if (!agg && !manual) continue
        strength.push({
          id: exercise.id,
          name: exercise.name,
          muscleGroup: exercise.primary_muscle_group,
          computed: agg
            ? { bestWeight: agg.bestWeight, bestReps: agg.bestReps, estimated1RM: estimateOneRepMax(agg.bestWeight, agg.bestReps), timesPerformed: agg.instanceIds.size }
            : null,
          manual,
        })
      }
    }

    standaloneStrength.forEach((s, i) => {
      strength.push({ id: `manual-strength-${i}`, name: s.name, muscleGroup: 'Other', computed: null, manual: s.manual })
    })
    standaloneCardio.forEach((c, i) => {
      cardio.push({ id: `manual-cardio-${i}`, name: c.name, muscleGroup: 'Other', computed: null, manual: c.manual })
    })

    strength.sort((a, b) => headline1RM(b) - headline1RM(a))
    cardio.sort((a, b) => headlineDistance(b) - headlineDistance(a))

    setStrengthRecords(strength)
    setCardioRecords(cardio)
    setLoading(false)
  }

  const headline1RM = (r: StrengthRecord) => Math.max(r.computed?.estimated1RM ?? 0, r.manual?.estimated1RM ?? 0)
  const headlineDistance = (r: CardioRecord) => Math.max(r.computed?.bestDistance ?? 0, r.manual?.distanceKm ?? 0)

  const resetForm = () => {
    setExerciseMode('library')
    setSelectedLibraryId('')
    setCustomName('')
    setCustomType('strength')
    setWeight('')
    setReps('')
    setDistanceKm('')
    setDurationMinutes('')
    setRecordedDate('')
    setNote('')
  }

  const selectedLibraryExercise = libraryExercises.find((l) => l.id === selectedLibraryId)
  const effectiveType: ExerciseType =
    exerciseMode === 'library' ? ((selectedLibraryExercise?.exercise_type as ExerciseType) ?? 'strength') : customType

  const isValid =
    exerciseMode === 'library'
      ? Boolean(selectedLibraryId)
      : customName.trim().length > 0

  const canSave =
    isValid && (effectiveType === 'cardio' ? Boolean(distanceKm && durationMinutes) : Boolean(weight && reps))

  const handleAddManualPr = async () => {
    if (!canSave) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)

    const { error } = await supabase.from('manual_prs').insert({
      user_id: user.id,
      exercise_library_id: exerciseMode === 'library' ? selectedLibraryId : null,
      exercise_name: exerciseMode === 'custom' ? customName.trim() : null,
      exercise_type: effectiveType,
      weight: effectiveType === 'strength' ? parseFloat(weight) : null,
      reps: effectiveType === 'strength' ? parseInt(reps, 10) : null,
      distance_km: effectiveType === 'cardio' ? parseFloat(distanceKm) : null,
      duration_seconds: effectiveType === 'cardio' ? Math.round(parseFloat(durationMinutes) * 60) : null,
      recorded_date: recordedDate || null,
      note: note.trim() || null,
    })

    if (error) {
      console.error('Error adding manual PR:', error)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowAddModal(false)
    resetForm()
    fetchRecords()
  }

  const filteredStrength = strengthRecords.filter((r) => !muscleFilter || r.muscleGroup === muscleFilter)
  const filteredCardio = cardioRecords.filter((r) => !muscleFilter || r.muscleGroup === muscleFilter)

  const musclesInUse = new Set([...strengthRecords, ...cardioRecords].map((r) => r.muscleGroup))
  const availableMuscleGroups = MUSCLE_GROUPS.filter((m) => musclesInUse.has(m))

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/gym"
          className="text-white/40 hover:text-white/60 transition-colors mb-6 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Gym
        </Link>

        <div className="flex items-center justify-between gap-4 mb-8 mt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <Award className="w-8 h-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Personal Records</h1>
              <p className="text-white/50 text-sm">Your best lift and run for every exercise</p>
            </div>
          </div>

          <Dialog
            open={showAddModal}
            onOpenChange={(open) => {
              setShowAddModal(open)
              if (!open) resetForm()
            }}
          >
            <DialogTrigger>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Manual PR</span>
              </button>
            </DialogTrigger>
            <DialogContent className="bg-black border-white/10 text-white max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Manual PR</DialogTitle>
                <DialogDescription className="text-white/40">
                  For a lift or run from before this app existed, or anything you'd rather log without a full
                  workout entry.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExerciseMode('library')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      exerciseMode === 'library' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    From Library
                  </button>
                  <button
                    type="button"
                    onClick={() => setExerciseMode('custom')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      exerciseMode === 'custom' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    Not in My Library
                  </button>
                </div>

                {exerciseMode === 'library' ? (
                  <div className="space-y-2">
                    <Label className="text-white/80">Exercise</Label>
                    <select
                      value={selectedLibraryId}
                      onChange={(e) => setSelectedLibraryId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2.5"
                    >
                      <option value="" className="bg-black">
                        Select an exercise...
                      </option>
                      {libraryExercises.map((ex) => (
                        <option key={ex.id} value={ex.id} className="bg-black">
                          {ex.name} {ex.exercise_type === 'cardio' ? '(Cardio)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="pr-name" className="text-white/80">
                        Exercise name
                      </Label>
                      <Input
                        id="pr-name"
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="e.g. Bench Press"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/80">Type</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {EXERCISE_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setCustomType(type)}
                            className={`p-2.5 rounded-lg border text-sm transition-colors ${
                              customType === type
                                ? 'bg-white text-black border-white'
                                : 'bg-white/[0.02] border-white/10 text-white hover:bg-white/[0.04]'
                            }`}
                          >
                            {type === 'strength' ? 'Strength' : 'Cardio'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {effectiveType === 'strength' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pr-weight" className="text-white/80">
                        Weight (kg)
                      </Label>
                      <Input
                        id="pr-weight"
                        type="number"
                        step="0.5"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="100"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pr-reps" className="text-white/80">
                        Reps
                      </Label>
                      <Input
                        id="pr-reps"
                        type="number"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        placeholder="1"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pr-distance" className="text-white/80">
                        Distance (km)
                      </Label>
                      <Input
                        id="pr-distance"
                        type="number"
                        step="0.01"
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value)}
                        placeholder="5.0"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pr-duration" className="text-white/80">
                        Duration (minutes)
                      </Label>
                      <Input
                        id="pr-duration"
                        type="number"
                        step="0.1"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        placeholder="25"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="pr-date" className="text-white/80">
                    Date (optional)
                  </Label>
                  <Input
                    id="pr-date"
                    type="date"
                    value={recordedDate}
                    onChange={(e) => setRecordedDate(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pr-note" className="text-white/80">
                    Note (optional)
                  </Label>
                  <Textarea
                    id="pr-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any context worth remembering..."
                    rows={2}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                  />
                </div>

                <Button
                  onClick={handleAddManualPr}
                  disabled={saving || !canSave}
                  className="w-full bg-white text-black hover:bg-white/90"
                >
                  {saving ? 'Saving...' : 'Save PR'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-white/40">Loading...</div>
          </div>
        ) : (
          <>
            {availableMuscleGroups.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                <button
                  onClick={() => setMuscleFilter(null)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    muscleFilter === null
                      ? 'bg-white text-black'
                      : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  All
                </button>
                {availableMuscleGroups.map((muscle) => (
                  <button
                    key={muscle}
                    onClick={() => setMuscleFilter(muscle)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      muscleFilter === muscle
                        ? 'bg-white text-black'
                        : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {muscle}
                  </button>
                ))}
              </div>
            )}

            <div className="mb-10">
              <h2 className="text-lg font-medium text-white mb-4">Strength Records</h2>
              {filteredStrength.length === 0 ? (
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
                  <p className="text-white/40">No strength records yet — log a workout to see your bests here.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredStrength.map((record) => {
                    const computedIsHeadline =
                      (record.computed?.estimated1RM ?? -1) >= (record.manual?.estimated1RM ?? -1)
                    const headline = computedIsHeadline ? record.computed : record.manual
                    const secondary = computedIsHeadline ? record.manual : record.computed
                    const secondaryIsManual = !computedIsHeadline ? false : Boolean(record.manual)
                    const content = (
                      <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-medium text-white">{record.name}</h3>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                                {record.muscleGroup}
                              </span>
                              {!computedIsHeadline && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60 border border-white/20">
                                  Manual
                                </span>
                              )}
                            </div>
                            {record.computed && <p className="text-white/40 text-sm">Performed {record.computed.timesPerformed}x</p>}
                            {secondary && (
                              <p className="text-white/30 text-xs mt-1">
                                {secondaryIsManual ? 'Manual: ' : 'Logged: '}
                                {'weight' in secondary ? `${secondary.weight} × ${secondary.reps}` : ''}
                                {'bestWeight' in secondary ? `${secondary.bestWeight} × ${secondary.bestReps}` : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-6 text-right shrink-0">
                            <div>
                              <p className="text-xs text-white/40 mb-1">Best Set</p>
                              <p className="text-white font-semibold">
                                {headline && 'weight' in headline
                                  ? `${headline.weight} × ${headline.reps}`
                                  : headline && 'bestWeight' in headline
                                    ? `${headline.bestWeight} × ${headline.bestReps}`
                                    : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-white/40 mb-1">Est. 1RM</p>
                              <p className="text-white font-semibold">
                                {headline ? `${Math.round(headline.estimated1RM)} kg` : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )

                    return record.id.startsWith('manual-strength-') ? (
                      <div key={record.id}>{content}</div>
                    ) : (
                      <Link key={record.id} href={`/gym/exercises/${record.id}`}>
                        {content}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-medium text-white mb-4">Cardio Records</h2>
              {filteredCardio.length === 0 ? (
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
                  <p className="text-white/40">No cardio logged yet — record a run to see it here.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredCardio.map((record) => {
                    const computedIsHeadline = (record.computed?.bestDistance ?? -1) >= (record.manual?.distanceKm ?? -1)
                    const headlineDistanceVal = computedIsHeadline ? record.computed?.bestDistance : record.manual?.distanceKm
                    const headlinePace = computedIsHeadline
                      ? record.computed?.bestPaceSecondsPerKm
                      : record.manual
                        ? record.manual.durationSeconds / record.manual.distanceKm
                        : null
                    const secondary = computedIsHeadline ? record.manual : record.computed

                    const content = (
                      <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-medium text-white">{record.name}</h3>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                                {record.muscleGroup}
                              </span>
                              {!computedIsHeadline && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/60 border border-white/20">
                                  Manual
                                </span>
                              )}
                            </div>
                            {record.computed && <p className="text-white/40 text-sm">Performed {record.computed.timesPerformed}x</p>}
                            {secondary && (
                              <p className="text-white/30 text-xs mt-1">
                                {computedIsHeadline ? 'Manual: ' : 'Logged: '}
                                {'distanceKm' in secondary
                                  ? `${secondary.distanceKm} km in ${formatDuration(secondary.durationSeconds)}`
                                  : `${secondary.bestDistance} km`}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-6 text-right shrink-0">
                            <div>
                              <p className="text-xs text-white/40 mb-1">Best Distance</p>
                              <p className="text-white font-semibold">{headlineDistanceVal ?? 'N/A'} km</p>
                            </div>
                            <div>
                              <p className="text-xs text-white/40 mb-1">Best Pace</p>
                              <p className="text-white font-semibold">{headlinePace != null ? formatPace(headlinePace) : 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )

                    return record.id.startsWith('manual-cardio-') ? (
                      <div key={record.id}>{content}</div>
                    ) : (
                      <Link key={record.id} href={`/gym/exercises/${record.id}`}>
                        {content}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
