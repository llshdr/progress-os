'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Label } from '@/components/ui/label'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { X } from 'lucide-react'

interface LibraryExerciseOption {
  id: string
  name: string
}

interface Alternative {
  id: string
  exerciseLibraryId: string
  name: string
}

interface ExerciseAlternativesManagerProps {
  templateExerciseId: string
  excludeExerciseLibraryId: string
  libraryExercises: LibraryExerciseOption[]
}

// Saves immediately on add/remove, same as ExerciseVariantsManager - this
// list is independent metadata, not part of the row's own Save button.
// Always rendered inline, never behind a collapse/toggle - an empty
// alternatives list just looks like an empty "add" control, nothing to
// discover or miss.
export default function ExerciseAlternativesManager({
  templateExerciseId,
  excludeExerciseLibraryId,
  libraryExercises,
}: ExerciseAlternativesManagerProps) {
  const [alternatives, setAlternatives] = useState<Alternative[]>([])
  const [selectedToAdd, setSelectedToAdd] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [altToRemove, setAltToRemove] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchAlternatives()
  }, [templateExerciseId])

  const fetchAlternatives = async () => {
    const { data, error } = await supabase
      .from('workout_template_exercise_alternatives')
      .select('id, alternative_exercise_library_id, exercise_library(name)')
      .eq('template_exercise_id', templateExerciseId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching exercise alternatives:', error)
    } else {
      setAlternatives(
        (data ?? []).map((row: any) => ({
          id: row.id,
          exerciseLibraryId: row.alternative_exercise_library_id,
          name: row.exercise_library?.name ?? 'Unknown',
        }))
      )
    }
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!selectedToAdd) return

    setSaving(true)
    const { error } = await supabase.from('workout_template_exercise_alternatives').insert({
      template_exercise_id: templateExerciseId,
      alternative_exercise_library_id: selectedToAdd,
    })
    setSaving(false)

    if (error) {
      console.error('Error adding alternative:', error)
    } else {
      setSelectedToAdd('')
      fetchAlternatives()
    }
  }

  const handleRemove = async () => {
    if (!altToRemove) return

    const { error } = await supabase.from('workout_template_exercise_alternatives').delete().eq('id', altToRemove)
    setAltToRemove(null)

    if (error) {
      console.error('Error removing alternative:', error)
    } else {
      fetchAlternatives()
    }
  }

  if (loading) return null

  const alreadyAddedIds = new Set(alternatives.map((a) => a.exerciseLibraryId))
  const options = libraryExercises.filter((ex) => ex.id !== excludeExerciseLibraryId && !alreadyAddedIds.has(ex.id))

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <Label className="text-white/60 text-xs mb-2 block">Alternatives (optional)</Label>

      {alternatives.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {alternatives.map((alt) => (
            <span
              key={alt.id}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-white"
            >
              {alt.name}
              <button
                type="button"
                onClick={() => setAltToRemove(alt.id)}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {options.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selectedToAdd}
            onChange={(e) => setSelectedToAdd(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 text-white rounded-lg px-3 py-1.5 text-xs"
          >
            <option value="" className="bg-black">
              Add alternative...
            </option>
            {options.map((ex) => (
              <option key={ex.id} value={ex.id} className="bg-black">
                {ex.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !selectedToAdd}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-white hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}

      <ConfirmationModal
        open={altToRemove !== null}
        onOpenChange={(open) => !open && setAltToRemove(null)}
        title="Remove Alternative"
        description="Are you sure you want to remove this alternative?"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleRemove}
        destructive
      />
    </div>
  )
}
