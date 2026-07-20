'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'

interface CardioLoggerProps {
  exerciseId: string
  exerciseName: string
  onComplete?: () => void
}

interface SavedCardioLog {
  id: string
  distanceKm: number
  durationSeconds: number
}

// Cardio's MVP shape: one log per exercise-instance (a single run's
// distance/duration), not a repeating list like strength sets - there's
// only ever one row to create, edit, or delete.
export default function CardioLogger({ exerciseId, exerciseName, onComplete }: CardioLoggerProps) {
  const [distanceKm, setDistanceKm] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
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
      .select('id, distance_km, duration_seconds')
      .eq('exercise_id', exerciseId)
      .maybeSingle()

    if (!error && data) {
      setSavedLog({ id: data.id, distanceKm: data.distance_km, durationSeconds: data.duration_seconds })
      setDistanceKm(String(data.distance_km))
      setDurationMinutes(String(data.duration_seconds / 60))
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

  const formatDuration = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return seconds === 0 ? `${minutes} min` : `${minutes}m ${seconds}s`
  }

  const handleSave = async () => {
    if (!distanceKm || !durationMinutes) return

    setLoading(true)

    const distance = parseFloat(distanceKm)
    const durationSeconds = Math.round(parseFloat(durationMinutes) * 60)

    const { error } = await supabase
      .from('cardio_logs')
      .upsert(
        { exercise_id: exerciseId, distance_km: distance, duration_seconds: durationSeconds },
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
    setEditing(true)
  }

  const handleFinishExercise = () => {
    if (onComplete) onComplete()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white mb-1">{exerciseName}</h2>
      </div>

      {savedLog && !editing ? (
        <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-2xl font-semibold text-white">{savedLog.distanceKm} km</p>
              <p className="text-white/60 text-sm">{formatDuration(savedLog.durationSeconds)}</p>
              <p className="text-white/40 text-sm">{formatPace(savedLog.distanceKm, savedLog.durationSeconds)}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-white/60 text-sm">Distance (km)</label>
              <Input
                type="number"
                step="0.01"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="5.0"
                className="bg-white/5 border-white/10 text-white text-2xl font-semibold h-16 text-center placeholder:text-white/20"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-white/60 text-sm">Duration (minutes)</label>
              <Input
                type="number"
                step="0.1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="25"
                className="bg-white/5 border-white/10 text-white text-2xl font-semibold h-16 text-center placeholder:text-white/20"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={loading || !distanceKm || !durationMinutes}
                className="flex-1 bg-white text-black hover:bg-white/90 h-14 text-base font-medium"
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
                  }}
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/5 h-14 px-4"
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
        className="w-full border-white/10 text-white hover:bg-white/5 h-12"
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
