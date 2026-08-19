'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Pencil, Trash2, ChevronDown, ChevronUp, Bike } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { formatDuration } from '@/lib/format'

interface CardioLoggerProps {
  exerciseId: string
  exerciseName: string
  onComplete?: () => void
}

interface SavedCardioLog {
  id: string
  distanceKm: number
  durationSeconds: number
  avgHeartRate: number | null
  perceivedEffort: number | null
  elevationGainM: number | null
  source: 'training' | 'commute'
}

// Distance/duration only - just enough to prefill the quick-repeat
// button below, not a full log.
interface LastCommute {
  distanceKm: number
  durationSeconds: number
}

// Cardio's MVP shape: one log per exercise-instance (a single run's
// distance/duration), not a repeating list like strength sets - there's
// only ever one row to create, edit, or delete.
export default function CardioLogger({ exerciseId, exerciseName, onComplete }: CardioLoggerProps) {
  const [distanceKm, setDistanceKm] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  // All three optional, enrichment-only - never required to save a log,
  // same "easy, optional" precedent the distance/duration fields above
  // don't share (those two stay required, this MVP's actual shape).
  const [avgHeartRate, setAvgHeartRate] = useState('')
  const [perceivedEffort, setPerceivedEffort] = useState('')
  const [elevationGainM, setElevationGainM] = useState('')
  const [isCommute, setIsCommute] = useState(false)
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const [savedLog, setSavedLog] = useState<SavedCardioLog | null>(null)
  // Most recent commute-tagged log across ANY exercise (not just this
  // one) - a recurring commute is logged against a fresh exercise
  // instance each time, so "last time" means the last commute anywhere,
  // same "fetch once, prefill on tap" shape as nutrition's
  // handleQuickRepeatIntraWorkout (lastIntraWorkoutItem). RLS already
  // scopes cardio_logs to the current user via its exercises/workouts
  // chain, same as fetchSavedLog below.
  const [lastCommute, setLastCommute] = useState<LastCommute | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchSavedLog()
    fetchLastCommute()
  }, [exerciseId])

  const fetchSavedLog = async () => {
    const { data, error } = await supabase
      .from('cardio_logs')
      .select('id, distance_km, duration_seconds, avg_heart_rate, perceived_effort, elevation_gain_m, source')
      .eq('exercise_id', exerciseId)
      .maybeSingle()

    if (!error && data) {
      setSavedLog({
        id: data.id,
        distanceKm: data.distance_km,
        durationSeconds: data.duration_seconds,
        avgHeartRate: data.avg_heart_rate,
        perceivedEffort: data.perceived_effort,
        elevationGainM: data.elevation_gain_m,
        source: (data.source as 'training' | 'commute' | null) ?? 'training',
      })
      setDistanceKm(String(data.distance_km))
      setDurationMinutes(String(data.duration_seconds / 60))
      setAvgHeartRate(data.avg_heart_rate != null ? String(data.avg_heart_rate) : '')
      setPerceivedEffort(data.perceived_effort != null ? String(data.perceived_effort) : '')
      setElevationGainM(data.elevation_gain_m != null ? String(data.elevation_gain_m) : '')
      setIsCommute(data.source === 'commute')
      setShowMoreDetails(data.avg_heart_rate != null || data.perceived_effort != null || data.elevation_gain_m != null)
      setEditing(false)
    } else {
      setEditing(true)
    }
  }

  const fetchLastCommute = async () => {
    const { data } = await supabase
      .from('cardio_logs')
      .select('distance_km, duration_seconds')
      .eq('source', 'commute')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) setLastCommute({ distanceKm: data.distance_km, durationSeconds: data.duration_seconds })
  }

  // One-tap "log the same commute as last time" - prefills, doesn't
  // auto-save, same "still requires a final Save tap" precedent as
  // nutrition's handleQuickRepeatIntraWorkout.
  const handleQuickRepeatCommute = () => {
    if (!lastCommute) return
    setDistanceKm(String(lastCommute.distanceKm))
    setDurationMinutes(String(lastCommute.durationSeconds / 60))
    setIsCommute(true)
  }

  const formatPace = (distance: number, durationSeconds: number): string => {
    if (distance <= 0) return 'N/A'
    const paceMinutesPerKm = durationSeconds / 60 / distance
    const minutes = Math.floor(paceMinutesPerKm)
    const seconds = Math.round((paceMinutesPerKm - minutes) * 60)
    return `${minutes}:${String(seconds).padStart(2, '0')} /km`
  }

  const handleSave = async () => {
    if (!distanceKm || !durationMinutes) return

    setLoading(true)

    const distance = parseFloat(distanceKm)
    const durationSeconds = Math.round(parseFloat(durationMinutes) * 60)

    const { error } = await supabase.from('cardio_logs').upsert(
      {
        exercise_id: exerciseId,
        distance_km: distance,
        duration_seconds: durationSeconds,
        avg_heart_rate: avgHeartRate ? parseInt(avgHeartRate, 10) : null,
        perceived_effort: perceivedEffort ? parseInt(perceivedEffort, 10) : null,
        elevation_gain_m: elevationGainM ? parseInt(elevationGainM, 10) : null,
        source: isCommute ? 'commute' : 'training',
      },
      { onConflict: 'exercise_id' }
    )

    if (error) {
      console.error('Error saving cardio log:', error)
      alert('Failed to save')
      setLoading(false)
      return
    }

    setLoading(false)
    fetchSavedLog()
  }

  const handleDelete = async () => {
    if (!savedLog) return

    const { error } = await supabase.from('cardio_logs').delete().eq('id', savedLog.id)

    if (error) {
      console.error('Error deleting cardio log:', error)
      alert('Failed to delete')
      return
    }

    setSavedLog(null)
    setDistanceKm('')
    setDurationMinutes('')
    setAvgHeartRate('')
    setPerceivedEffort('')
    setElevationGainM('')
    setIsCommute(false)
    setShowMoreDetails(false)
    setEditing(true)
  }

  const handleFinishExercise = () => {
    if (onComplete) onComplete()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-lapis-text-primary mb-1">{exerciseName}</h2>
      </div>

      {savedLog && !editing ? (
        <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-2xl font-semibold text-lapis-text-primary">{savedLog.distanceKm} km</p>
                {savedLog.source === 'commute' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle">
                    <Bike className="w-3 h-3" />
                    Commute
                  </span>
                )}
              </div>
              <p className="text-lapis-text-secondary text-sm">{formatDuration(savedLog.durationSeconds)}</p>
              <p className="text-lapis-text-tertiary text-sm">{formatPace(savedLog.distanceKm, savedLog.durationSeconds)}</p>
              {(savedLog.avgHeartRate != null || savedLog.perceivedEffort != null || savedLog.elevationGainM != null) && (
                <p className="text-lapis-text-tertiary text-xs pt-1">
                  {[
                    savedLog.avgHeartRate != null ? `${savedLog.avgHeartRate} bpm avg` : null,
                    savedLog.perceivedEffort != null ? `RPE ${savedLog.perceivedEffort}/10` : null,
                    savedLog.elevationGainM != null ? `${savedLog.elevationGainM}m elevation` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-lapis-text-secondary text-sm">Distance (km)</label>
              <Input
                type="number"
                step="0.01"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="5.0"
                className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary text-2xl font-semibold h-16 text-center placeholder:text-lapis-text-disabled"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-lapis-text-secondary text-sm">Duration (minutes)</label>
              <Input
                type="number"
                step="0.1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="25"
                className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary text-2xl font-semibold h-16 text-center placeholder:text-lapis-text-disabled"
              />
            </div>

            {lastCommute && (
              <button
                type="button"
                onClick={handleQuickRepeatCommute}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lapis-md border border-lapis-border-subtle text-lapis-text-secondary hover:bg-lapis-surface-2 transition-colors text-sm"
              >
                <Bike className="w-4 h-4" />
                Repeat last commute ({lastCommute.distanceKm}km, {Math.round(lastCommute.durationSeconds / 60)}min)
              </button>
            )}

            <label className="flex items-center gap-2 text-sm text-lapis-text-secondary">
              <input type="checkbox" checked={isCommute} onChange={(e) => setIsCommute(e.target.checked)} />
              This was a commute ride, not dedicated training
            </label>

            <div>
              <button
                type="button"
                onClick={() => setShowMoreDetails(!showMoreDetails)}
                className="flex items-center gap-1 text-sm text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors"
              >
                {showMoreDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Add more details (optional)
              </button>

              {showMoreDetails && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="space-y-1">
                    <label className="text-lapis-text-tertiary text-xs">Avg HR (bpm)</label>
                    <Input
                      type="number"
                      value={avgHeartRate}
                      onChange={(e) => setAvgHeartRate(e.target.value)}
                      placeholder="150"
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary text-center placeholder:text-lapis-text-disabled"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-lapis-text-tertiary text-xs">RPE (0-10)</label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      value={perceivedEffort}
                      onChange={(e) => setPerceivedEffort(e.target.value)}
                      placeholder="6"
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary text-center placeholder:text-lapis-text-disabled"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-lapis-text-tertiary text-xs">Elevation (m)</label>
                    <Input
                      type="number"
                      value={elevationGainM}
                      onChange={(e) => setElevationGainM(e.target.value)}
                      placeholder="120"
                      className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary text-center placeholder:text-lapis-text-disabled"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={loading || !distanceKm || !durationMinutes}
                className="flex-1 bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-14 text-base font-medium"
              >
                {loading ? (
                  'Saving...'
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Save
                  </>
                )}
              </Button>
              {savedLog && (
                <Button
                  onClick={() => {
                    setEditing(false)
                    setDistanceKm(String(savedLog.distanceKm))
                    setDurationMinutes(String(savedLog.durationSeconds / 60))
                    setAvgHeartRate(savedLog.avgHeartRate != null ? String(savedLog.avgHeartRate) : '')
                    setPerceivedEffort(savedLog.perceivedEffort != null ? String(savedLog.perceivedEffort) : '')
                    setElevationGainM(savedLog.elevationGainM != null ? String(savedLog.elevationGainM) : '')
                    setIsCommute(savedLog.source === 'commute')
                  }}
                  variant="outline"
                  className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 h-14 px-4"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={handleFinishExercise}
        variant="outline"
        className="w-full border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 h-12"
      >
        Finish Exercise
      </Button>

      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete Cardio Log"
        description="Are you sure you want to delete this log?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  )
}
