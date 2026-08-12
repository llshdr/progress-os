'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
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
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const [savedLog, setSavedLog] = useState<SavedCardioLog | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchSavedLog()
  }, [exerciseId])

  const fetchSavedLog = async () => {
    const { data, error } = await supabase
      .from('cardio_logs')
      .select('id, distance_km, duration_seconds, avg_heart_rate, perceived_effort, elevation_gain_m')
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
      })
      setDistanceKm(String(data.distance_km))
      setDurationMinutes(String(data.duration_seconds / 60))
      setAvgHeartRate(data.avg_heart_rate != null ? String(data.avg_heart_rate) : '')
      setPerceivedEffort(data.perceived_effort != null ? String(data.perceived_effort) : '')
      setElevationGainM(data.elevation_gain_m != null ? String(data.elevation_gain_m) : '')
      setShowMoreDetails(data.avg_heart_rate != null || data.perceived_effort != null || data.elevation_gain_m != null)
      setEditing(false)
    } else {
      setEditing(true)
    }
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
              <p className="text-2xl font-semibold text-lapis-text-primary">{savedLog.distanceKm} km</p>
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
