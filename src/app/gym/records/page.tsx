'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Award, ArrowLeft, Plus, Calendar, Dumbbell, Footprints } from 'lucide-react'
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
import { fetchCardioActivity, bucketWeeklyCardioDistance, type CardioActivity } from '@/lib/cardio-stats'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { computeStrengthFacts } from '@/lib/race-plan/analyze-fitness'
import { computeGymProgressionSignal } from '@/lib/gym-progression'
import { upsertGymProgressionSignal } from '@/lib/rank-progression'

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

type LoadWindow = { sessionCount: number; avgRir: number | null; hardestSetRir: number | null }

type BestEffort = { label: string; targetKm: number; actualKm: number; durationSeconds: number; date: string }

const RECENT_LIMIT = 20

// A bodyweight reading older than this is too stale to trust for a ratio
// PR - showing a months-old bodyweight against today's lift would silently
// misstate the ratio. No existing "how recent counts as current" constant
// to reuse here (the 90-day windows elsewhere in this app are consistency
// windows, a different question) - a fresh, explicit judgment call, not
// a borrowed one.
const BODYWEIGHT_RECENCY_DAYS = 30

// Standard recreational running distances people actually track a "PR"
// for - not an exhaustive race-distance list. Tolerance is generous
// (±5%) since a logged run rarely lands on an exact number; the honest
// part is always displaying the REAL logged distance/time for whichever
// run wins, never a projected/interpolated exact-5.00km time.
const STANDARD_RUN_DISTANCES_KM: { label: string; km: number }[] = [
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
  { label: 'Half Marathon', km: 21.1 },
  { label: 'Marathon', km: 42.2 },
]
const RUN_DISTANCE_TOLERANCE = 0.05

// Best real logged effort at each standard distance, discipline-wide
// (unions every exercise tagged cardio_type='running' - migration 073 -
// rather than per-exercise, so "Treadmill Run" and "Outdoor Run" both
// count toward one real 5K PR instead of splitting it in two). Ranked by
// pace within the tolerance band (not raw duration) so a shorter run in
// the band can't unfairly beat a longer, truly-faster-paced one - but the
// winner's own real time/distance is what's shown, never a recomputed
// "exactly 5.00km" projection.
function computeRunningBestEfforts(activities: CardioActivity[]): BestEffort[] {
  const runs = activities.filter((a) => a.cardioType === 'running')
  const efforts: BestEffort[] = []
  for (const { label, km } of STANDARD_RUN_DISTANCES_KM) {
    const eligible = runs.filter((a) => Math.abs(a.distanceKm - km) / km <= RUN_DISTANCE_TOLERANCE)
    if (eligible.length === 0) continue
    const best = eligible.reduce((fastest, a) =>
      a.durationSeconds / a.distanceKm < fastest.durationSeconds / fastest.distanceKm ? a : fastest
    )
    efforts.push({ label, targetKm: km, actualKm: best.distanceKm, durationSeconds: best.durationSeconds, date: best.date })
  }
  return efforts
}

// Two honest, separate signals - session frequency and per-set effort -
// rather than one fabricated composite "load score" that would imply a
// precision neither number actually has on its own. RIR is per-set (see
// migration 075, replacing the old session-level self-rating): every
// logged value within the window contributes to avgRir, so a session
// where more sets were rated naturally contributes more data rather than
// every session counting equally regardless of how much was actually
// rated. hardestSetRir (the window's minimum - lower RIR means closer to
// failure) is a genuinely different signal from the average - a single
// very hard set barely moves a multi-set average, but is real
// information on its own, same "two signals, not one" philosophy this
// card already has.
function computeLoadWindow(
  workoutDates: string[],
  rirEntries: { date: string; rir: number }[],
  days: number,
  today: Date
): LoadWindow {
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - days)
  const sessionCount = workoutDates.filter((d) => new Date(d) > cutoff).length
  const rirValues = rirEntries.filter((e) => new Date(e.date) > cutoff).map((e) => e.rir)
  return {
    sessionCount,
    avgRir: rirValues.length > 0 ? rirValues.reduce((sum, v) => sum + v, 0) / rirValues.length : null,
    hardestSetRir: rirValues.length > 0 ? Math.min(...rirValues) : null,
  }
}

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

function formatActivityDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RecordsPage() {
  const [strengthRecords, setStrengthRecords] = useState<StrengthRecord[]>([])
  const [cardioRecords, setCardioRecords] = useState<CardioRecord[]>([])
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([])
  const [cardioActivity, setCardioActivity] = useState<CardioActivity[]>([])
  const [cardioMuscleGroupById, setCardioMuscleGroupById] = useState<Map<string, string>>(new Map())
  const [loadStats, setLoadStats] = useState<{ sevenDay: LoadWindow; twentyEightDay: LoadWindow } | null>(null)
  const [loading, setLoading] = useState(true)
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null)
  // Null covers both "never logged" and "too stale to trust" - the ratio
  // PR below is simply omitted in either case, never guessed at.
  const [recentBodyweightKg, setRecentBodyweightKg] = useState<number | null>(null)

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

    setCardioMuscleGroupById(
      new Map((library ?? []).filter((l) => l.exercise_type === 'cardio').map((l) => [l.id as string, l.primary_muscle_group as string]))
    )

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
      cardioActivityData,
      { data: recentWorkouts, error: workoutsError },
      { data: rirSets, error: rirSetsError },
      { data: latestWeightEntry, error: weightError },
    ] = await Promise.all([
      supabase.from('sets').select('exercise_id, weight, reps'),
      supabase.from('cardio_logs').select('exercise_id, distance_km, duration_seconds'),
      supabase
        .from('manual_prs')
        .select('exercise_library_id, exercise_name, exercise_type, weight, reps, distance_km, duration_seconds, recorded_date, note')
        .eq('user_id', user.id),
      fetchCardioActivity(supabase),
      supabase.from('workouts').select('date').eq('user_id', user.id).not('completed_at', 'is', null),
      // RLS on `sets` already scopes this to the current user via its
      // exercises/workouts chain - completed:true and a real rir value
      // are the only filters that matter here. Filtered to completed
      // WORKOUTS client-side below (a set on a still-in-progress workout
      // isn't a real session data point yet).
      supabase
        .from('sets')
        .select('rir, created_at, exercise:exercises!inner(workout:workouts!inner(completed_at))')
        .eq('completed', true)
        .not('rir', 'is', null),
      supabase
        .from('weight_entries')
        .select('weight, recorded_at')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (setsError) console.error('Error fetching sets:', setsError)
    if (cardioError) console.error('Error fetching cardio logs:', cardioError)
    if (manualError) console.error('Error fetching manual PRs:', manualError)
    if (workoutsError) console.error('Error fetching workouts for load stats:', workoutsError)
    if (rirSetsError) console.error('Error fetching per-set RIR for load stats:', rirSetsError)
    if (weightError) console.error('Error fetching latest weight entry:', weightError)

    if (latestWeightEntry) {
      const daysOld = (Date.now() - new Date(latestWeightEntry.recorded_at).getTime()) / (24 * 60 * 60 * 1000)
      setRecentBodyweightKg(daysOld <= BODYWEIGHT_RECENCY_DAYS ? latestWeightEntry.weight : null)
    }

    // Feeds the rank system's progression bonus (migration 076) - fire
    // and forget, doesn't block this page's own render. Computed here
    // (rather than on the Races detail page, where a similar trend
    // read already happens for its own unrelated purpose) so a user
    // with no active race plan still earns credit for real gym
    // progress - this page is the one every gym user actually visits.
    computeStrengthFacts(supabase).then((facts) => {
      const signal = computeGymProgressionSignal(facts.muscleGroupTrends)
      upsertGymProgressionSignal(supabase, user.id, signal)
    })

    if (recentWorkouts) {
      const today = new Date()
      const workoutDates = recentWorkouts.map((w) => w.date)
      const rirEntries = ((rirSets ?? []) as any[])
        .filter((row) => row.exercise?.workout?.completed_at != null)
        .map((row) => ({ date: row.created_at as string, rir: row.rir as number }))
      setLoadStats({
        sevenDay: computeLoadWindow(workoutDates, rirEntries, 7, today),
        twentyEightDay: computeLoadWindow(workoutDates, rirEntries, 28, today),
      })
    }

    setCardioActivity(cardioActivityData)

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

  const filteredCardioActivity = cardioActivity.filter(
    (a) => !muscleFilter || cardioMuscleGroupById.get(a.exerciseLibraryId) === muscleFilter
  )
  const cardioWeeks = bucketWeeklyCardioDistance(filteredCardioActivity)
  const maxWeekKm = Math.max(...cardioWeeks.map((w) => w.totalKm), 1)
  const recentCardioActivity = filteredCardioActivity.slice(0, RECENT_LIMIT)
  const runningBestEfforts = computeRunningBestEfforts(filteredCardioActivity)

  const musclesInUse = new Set([...strengthRecords, ...cardioRecords].map((r) => r.muscleGroup))
  const availableMuscleGroups = MUSCLE_GROUPS.filter((m) => musclesInUse.has(m))

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/gym/progress"
          className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Progress
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8 mt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lapis-lg bg-lapis-surface-2 border border-lapis-border-subtle">
              <Award className="w-8 h-8 text-lapis-text-secondary" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-1">Personal Records</h1>
              <p className="text-lapis-text-tertiary text-sm">Your best lift and run for every exercise</p>
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
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lapis-md bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 transition-colors">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Manual PR</span>
              </button>
            </DialogTrigger>
            <DialogContent className="bg-lapis-bg border-lapis-border-subtle text-lapis-text-primary max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Manual PR</DialogTitle>
                <DialogDescription className="text-lapis-text-tertiary">
                  For a lift or run from before this app existed, or anything you'd rather log without a full
                  workout entry.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExerciseMode('library')}
                    className={`flex-1 px-4 py-2 rounded-lapis-sm text-sm font-medium transition-colors ${
                      exerciseMode === 'library' ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                    }`}
                  >
                    From Library
                  </button>
                  <button
                    type="button"
                    onClick={() => setExerciseMode('custom')}
                    className={`flex-1 px-4 py-2 rounded-lapis-sm text-sm font-medium transition-colors ${
                      exerciseMode === 'custom' ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
                    }`}
                  >
                    Not in My Library
                  </button>
                </div>

                {exerciseMode === 'library' ? (
                  <div className="space-y-2">
                    <Label className="text-lapis-text-secondary">Exercise</Label>
                    <select
                      value={selectedLibraryId}
                      onChange={(e) => setSelectedLibraryId(e.target.value)}
                      className="w-full bg-lapis-surface-2 border border-lapis-border-subtle text-lapis-text-primary rounded-lapis-sm px-4 py-2.5"
                    >
                      <option value="" className="bg-lapis-bg">
                        Select an exercise...
                      </option>
                      {libraryExercises.map((ex) => (
                        <option key={ex.id} value={ex.id} className="bg-lapis-bg">
                          {ex.name} {ex.exercise_type === 'cardio' ? '(Cardio)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="pr-name" className="text-lapis-text-secondary">
                        Exercise name
                      </Label>
                      <Input
                        id="pr-name"
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="e.g. Bench Press"
                        className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-lapis-text-secondary">Type</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {EXERCISE_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setCustomType(type)}
                            className={`p-2.5 rounded-lapis-sm border text-sm transition-colors ${
                              customType === type
                                ? 'bg-lapis-accent-500 text-lapis-text-primary border-lapis-border'
                                : 'bg-lapis-surface-1 border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2'
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
                      <Label htmlFor="pr-weight" className="text-lapis-text-secondary">
                        Weight (kg)
                      </Label>
                      <Input
                        id="pr-weight"
                        type="number"
                        step="0.5"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="100"
                        className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pr-reps" className="text-lapis-text-secondary">
                        Reps
                      </Label>
                      <Input
                        id="pr-reps"
                        type="number"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        placeholder="1"
                        className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pr-distance" className="text-lapis-text-secondary">
                        Distance (km)
                      </Label>
                      <Input
                        id="pr-distance"
                        type="number"
                        step="0.01"
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value)}
                        placeholder="5.0"
                        className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pr-duration" className="text-lapis-text-secondary">
                        Duration (minutes)
                      </Label>
                      <Input
                        id="pr-duration"
                        type="number"
                        step="0.1"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        placeholder="25"
                        className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="pr-date" className="text-lapis-text-secondary">
                    Date (optional)
                  </Label>
                  <Input
                    id="pr-date"
                    type="date"
                    value={recordedDate}
                    onChange={(e) => setRecordedDate(e.target.value)}
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pr-note" className="text-lapis-text-secondary">
                    Note (optional)
                  </Label>
                  <Textarea
                    id="pr-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any context worth remembering..."
                    rows={2}
                    className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled resize-none"
                  />
                </div>

                <Button
                  onClick={handleAddManualPr}
                  disabled={saving || !canSave}
                  className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110"
                >
                  {saving ? 'Saving...' : 'Save PR'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : (
          <>
            {loadStats && (loadStats.sevenDay.sessionCount > 0 || loadStats.twentyEightDay.sessionCount > 0) && (
              <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-8">
                <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Training Load</h2>
                <p className="text-lapis-text-tertiary text-sm mb-4">
                  Two separate signals, not one combined score - session count for frequency, per-set RIR for how
                  hard those sets actually felt.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-lapis-text-tertiary mb-1">Last 7 days</p>
                    <p className="text-lapis-text-primary font-semibold">{loadStats.sevenDay.sessionCount} sessions</p>
                    {loadStats.sevenDay.avgRir != null && (
                      <p className="text-lapis-text-tertiary text-xs mt-0.5">Avg RIR {loadStats.sevenDay.avgRir.toFixed(1)}</p>
                    )}
                    {loadStats.sevenDay.hardestSetRir != null && (
                      <p className="text-lapis-text-tertiary text-xs mt-0.5">Hardest set: RIR {loadStats.sevenDay.hardestSetRir}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-lapis-text-tertiary mb-1">Last 28 days</p>
                    <p className="text-lapis-text-primary font-semibold">{loadStats.twentyEightDay.sessionCount} sessions</p>
                    {loadStats.twentyEightDay.avgRir != null && (
                      <p className="text-lapis-text-tertiary text-xs mt-0.5">Avg RIR {loadStats.twentyEightDay.avgRir.toFixed(1)}</p>
                    )}
                    {loadStats.twentyEightDay.hardestSetRir != null && (
                      <p className="text-lapis-text-tertiary text-xs mt-0.5">Hardest set: RIR {loadStats.twentyEightDay.hardestSetRir}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {availableMuscleGroups.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                <button
                  onClick={() => setMuscleFilter(null)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    muscleFilter === null
                      ? 'bg-lapis-accent-500 text-lapis-text-primary'
                      : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2'
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
                        ? 'bg-lapis-accent-500 text-lapis-text-primary'
                        : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2'
                    }`}
                  >
                    {muscle}
                  </button>
                ))}
              </div>
            )}

            <div className="mb-10">
              <h2 className="text-lg font-medium text-lapis-text-primary mb-4">Strength Records</h2>
              {filteredStrength.length === 0 ? (
                <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
                  <Dumbbell className="w-10 h-10 text-lapis-text-disabled mx-auto mb-4" />
                  <p className="text-lapis-text-tertiary">No strength records yet — log a workout to see your bests here.</p>
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
                      <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 transition-all duration-200">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-medium text-lapis-text-primary">{record.name}</h3>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle">
                                {record.muscleGroup}
                              </span>
                              {!computedIsHeadline && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-strong">
                                  Manual
                                </span>
                              )}
                            </div>
                            {record.computed && <p className="text-lapis-text-tertiary text-sm">Performed {record.computed.timesPerformed}x</p>}
                            {secondary && (
                              <p className="text-lapis-text-disabled text-xs mt-1">
                                {secondaryIsManual ? 'Manual: ' : 'Logged: '}
                                {'weight' in secondary ? `${secondary.weight} × ${secondary.reps}` : ''}
                                {'bestWeight' in secondary ? `${secondary.bestWeight} × ${secondary.bestReps}` : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-6 text-right shrink-0">
                            <div>
                              <p className="text-xs text-lapis-text-tertiary mb-1">Best Set</p>
                              <p className="text-lapis-text-primary font-semibold">
                                {headline && 'weight' in headline
                                  ? `${headline.weight} × ${headline.reps}`
                                  : headline && 'bestWeight' in headline
                                    ? `${headline.bestWeight} × ${headline.bestReps}`
                                    : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-lapis-text-tertiary mb-1">Est. 1RM</p>
                              <p className="text-lapis-text-primary font-semibold">
                                {headline ? `${Math.round(headline.estimated1RM)} kg` : 'N/A'}
                              </p>
                            </div>
                            {/* Alongside the absolute PR above, never replacing
                                it - omitted entirely (not shown as "N/A") when
                                there's no recent bodyweight to divide by, since
                                a stale or missing bodyweight would make this
                                ratio actively misleading rather than just absent. */}
                            {headline && recentBodyweightKg && (
                              <div>
                                <p className="text-xs text-lapis-text-tertiary mb-1">× Bodyweight</p>
                                <p className="text-lapis-text-primary font-semibold">
                                  {(headline.estimated1RM / recentBodyweightKg).toFixed(2)}×
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* The full 1RM-over-time trend already lives on the
                            exercise detail page this card links to
                            (ExerciseProgressChart) - this just makes that
                            reachable-by-click fact visible instead of silent. */}
                        {record.computed && <p className="text-lapis-text-disabled text-xs mt-3">View progress over time →</p>}
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
              <h2 className="text-lg font-medium text-lapis-text-primary mb-4">Cardio Records</h2>

              {runningBestEfforts.length > 0 && (
                <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-6">
                  <h3 className="text-sm font-medium text-lapis-text-secondary mb-1">Best Efforts (Running)</h3>
                  <p className="text-lapis-text-disabled text-xs mb-4">
                    Your real fastest logged run near each distance - not a projected exact-distance time.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {runningBestEfforts.map((effort) => (
                      <div key={effort.label}>
                        <p className="text-xs text-lapis-text-tertiary mb-1">{effort.label}</p>
                        <p className="text-lapis-text-primary font-semibold">{formatDuration(effort.durationSeconds)}</p>
                        <p className="text-lapis-text-disabled text-xs mt-0.5">
                          {effort.actualKm.toFixed(2)} km · {formatActivityDate(effort.date)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredCardioActivity.length > 0 && (
                <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mb-6">
                  <h3 className="text-sm font-medium text-lapis-text-secondary mb-4">Weekly Distance</h3>
                  <div className="space-y-3">
                    {cardioWeeks.map((week, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-lapis-text-secondary">
                            {week.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-lapis-text-tertiary text-xs">{week.totalKm.toFixed(1)} km</span>
                        </div>
                        <div className="w-full bg-lapis-surface-2 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-lapis-accent-500 transition-all duration-300"
                            style={{ width: `${(week.totalKm / maxWeekKm) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredCardio.length === 0 ? (
                <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
                  <Footprints className="w-10 h-10 text-lapis-text-disabled mx-auto mb-4" />
                  <p className="text-lapis-text-tertiary">No cardio logged yet — record a run to see it here.</p>
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
                      <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 transition-all duration-200">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-medium text-lapis-text-primary">{record.name}</h3>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle">
                                {record.muscleGroup}
                              </span>
                              {!computedIsHeadline && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-strong">
                                  Manual
                                </span>
                              )}
                            </div>
                            {record.computed && <p className="text-lapis-text-tertiary text-sm">Performed {record.computed.timesPerformed}x</p>}
                            {secondary && (
                              <p className="text-lapis-text-disabled text-xs mt-1">
                                {computedIsHeadline ? 'Manual: ' : 'Logged: '}
                                {'distanceKm' in secondary
                                  ? `${secondary.distanceKm} km in ${formatDuration(secondary.durationSeconds)}`
                                  : `${secondary.bestDistance} km`}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-6 text-right shrink-0">
                            <div>
                              <p className="text-xs text-lapis-text-tertiary mb-1">Best Distance</p>
                              <p className="text-lapis-text-primary font-semibold">{headlineDistanceVal ?? 'N/A'} km</p>
                            </div>
                            <div>
                              <p className="text-xs text-lapis-text-tertiary mb-1">Best Pace</p>
                              <p className="text-lapis-text-primary font-semibold">{headlinePace != null ? formatPace(headlinePace) : 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                        {/* Pace-over-time trend lives on the exercise detail
                            page this card links to (CardioProgressChart). */}
                        {record.computed && <p className="text-lapis-text-disabled text-xs mt-3">View pace trend over time →</p>}
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

              {recentCardioActivity.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-medium text-lapis-text-secondary mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {recentCardioActivity.map((activity, index) => (
                      <div
                        key={index}
                        className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 flex items-center justify-between flex-wrap gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-lapis-text-tertiary" />
                          <div>
                            <span className="text-lapis-text-primary font-medium">{activity.exerciseName}</span>
                            <span className="text-lapis-text-tertiary text-sm ml-2">{formatActivityDate(activity.date)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-lapis-text-secondary text-sm">
                          <span>{activity.distanceKm} km</span>
                          <span>{formatDuration(activity.durationSeconds)}</span>
                          <span className="text-lapis-text-tertiary">
                            {activity.distanceKm > 0 ? formatPace(activity.durationSeconds / activity.distanceKm) : 'N/A'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
