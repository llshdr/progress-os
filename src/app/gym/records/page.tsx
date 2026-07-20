'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Award, ArrowLeft } from 'lucide-react'
import { estimateOneRepMax } from '@/lib/estimate1rm'
import { MUSCLE_GROUPS } from '@/lib/exercise-constants'

type StrengthRecord = {
  id: string
  name: string
  muscleGroup: string
  bestWeight: number
  bestReps: number
  estimated1RM: number
  timesPerformed: number
}

type CardioRecord = {
  id: string
  name: string
  muscleGroup: string
  bestDistance: number
  bestPaceSecondsPerKm: number | null
  timesPerformed: number
}

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
}

export default function RecordsPage() {
  const [strengthRecords, setStrengthRecords] = useState<StrengthRecord[]>([])
  const [cardioRecords, setCardioRecords] = useState<CardioRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null)
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

    const [{ data: sets, error: setsError }, { data: cardioLogs, error: cardioError }] = await Promise.all([
      supabase.from('sets').select('exercise_id, weight, reps'),
      supabase.from('cardio_logs').select('exercise_id, distance_km, duration_seconds'),
    ])

    if (setsError) console.error('Error fetching sets:', setsError)
    if (cardioError) console.error('Error fetching cardio logs:', cardioError)

    type StrengthAgg = { bestWeight: number; bestReps: number; instanceIds: Set<string> }
    const strengthAgg = new Map<string, StrengthAgg>()

    for (const set of sets ?? []) {
      const libraryId = libraryIdByInstanceId.get(set.exercise_id)
      if (!libraryId) continue

      const weight = typeof set.weight === 'string' ? parseFloat(set.weight) : set.weight
      const reps = typeof set.reps === 'string' ? parseInt(set.reps) : set.reps

      const existing = strengthAgg.get(libraryId)
      if (!existing) {
        strengthAgg.set(libraryId, { bestWeight: weight, bestReps: reps, instanceIds: new Set([set.exercise_id]) })
      } else {
        existing.instanceIds.add(set.exercise_id)
        if (weight > existing.bestWeight || (weight === existing.bestWeight && reps > existing.bestReps)) {
          existing.bestWeight = weight
          existing.bestReps = reps
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

    const strength: StrengthRecord[] = []
    const cardio: CardioRecord[] = []

    for (const exercise of library ?? []) {
      if (exercise.exercise_type === 'cardio') {
        const agg = cardioAgg.get(exercise.id)
        if (!agg) continue
        cardio.push({
          id: exercise.id,
          name: exercise.name,
          muscleGroup: exercise.primary_muscle_group,
          bestDistance: agg.bestDistance,
          bestPaceSecondsPerKm: agg.bestPaceSecondsPerKm,
          timesPerformed: agg.instanceIds.size,
        })
      } else {
        const agg = strengthAgg.get(exercise.id)
        if (!agg) continue
        strength.push({
          id: exercise.id,
          name: exercise.name,
          muscleGroup: exercise.primary_muscle_group,
          bestWeight: agg.bestWeight,
          bestReps: agg.bestReps,
          estimated1RM: estimateOneRepMax(agg.bestWeight, agg.bestReps),
          timesPerformed: agg.instanceIds.size,
        })
      }
    }

    strength.sort((a, b) => b.estimated1RM - a.estimated1RM)
    cardio.sort((a, b) => b.bestDistance - a.bestDistance)

    setStrengthRecords(strength)
    setCardioRecords(cardio)
    setLoading(false)
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

        <div className="flex items-center gap-4 mb-8 mt-6">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <Award className="w-8 h-8 text-white/80" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-1">Personal Records</h1>
            <p className="text-white/50 text-sm">Your best lift and run for every exercise</p>
          </div>
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
                  {filteredStrength.map((record) => (
                    <Link key={record.id} href={`/gym/exercises/${record.id}`}>
                      <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-medium text-white">{record.name}</h3>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                                {record.muscleGroup}
                              </span>
                            </div>
                            <p className="text-white/40 text-sm">Performed {record.timesPerformed}x</p>
                          </div>
                          <div className="flex gap-6 text-right shrink-0">
                            <div>
                              <p className="text-xs text-white/40 mb-1">Best Set</p>
                              <p className="text-white font-semibold">
                                {record.bestWeight} × {record.bestReps}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-white/40 mb-1">Est. 1RM</p>
                              <p className="text-white font-semibold">{Math.round(record.estimated1RM)} kg</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
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
                  {filteredCardio.map((record) => (
                    <Link key={record.id} href={`/gym/exercises/${record.id}`}>
                      <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-medium text-white">{record.name}</h3>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                                {record.muscleGroup}
                              </span>
                            </div>
                            <p className="text-white/40 text-sm">Performed {record.timesPerformed}x</p>
                          </div>
                          <div className="flex gap-6 text-right shrink-0">
                            <div>
                              <p className="text-xs text-white/40 mb-1">Best Distance</p>
                              <p className="text-white font-semibold">{record.bestDistance} km</p>
                            </div>
                            <div>
                              <p className="text-xs text-white/40 mb-1">Best Pace</p>
                              <p className="text-white font-semibold">
                                {record.bestPaceSecondsPerKm != null ? formatPace(record.bestPaceSecondsPerKm) : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
