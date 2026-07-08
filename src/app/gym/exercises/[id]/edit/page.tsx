'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/utils'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Full Body',
]

const EQUIPMENT_TYPES = [
  'Barbell',
  'Dumbbell',
  'Machine',
  'Cable',
  'Bodyweight',
  'Kettlebell',
  'Resistance Band',
  'Other',
]

const CATEGORIES = [
  'Compound',
  'Isolation',
  'Cardio',
  'Mobility',
  'Stretching',
]

export default function EditExercisePage() {
  const params = useParams()
  const router = useRouter()
  const [name, setName] = useState('')
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState('')
  const [secondaryMuscleGroups, setSecondaryMuscleGroups] = useState<string[]>([])
  const [equipmentType, setEquipmentType] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchExercise()
  }, [params.id])

  const fetchExercise = async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('exercise_library')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching exercise:', error)
      setError(getErrorMessage(error))
      setLoading(false)
      return
    }

    setName(data.name)
    setPrimaryMuscleGroup(data.primary_muscle_group)
    setSecondaryMuscleGroups(data.secondary_muscle_groups || [])
    setEquipmentType(data.equipment_type)
    setCategory(data.category)
    setNotes(data.notes || '')
    setLoading(false)
  }

  const toggleSecondaryMuscle = (muscle: string) => {
    setSecondaryMuscleGroups(prev =>
      prev.includes(muscle)
        ? prev.filter(m => m !== muscle)
        : [...prev, muscle]
    )
  }

  const handleUpdateExercise = async () => {
    if (!name || !primaryMuscleGroup || !equipmentType || !category) {
      alert('Please fill in all required fields')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('exercise_library')
      .update({
        name,
        primary_muscle_group: primaryMuscleGroup,
        secondary_muscle_groups: secondaryMuscleGroups.length > 0 ? secondaryMuscleGroups : null,
        equipment_type: equipmentType,
        category,
        notes: notes || null,
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error updating exercise:', error)
      alert(`Failed to update exercise: ${getErrorMessage(error)}`)
      setSaving(false)
    } else {
      router.push('/gym/exercises')
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white/40">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/gym/exercises" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
            ← Back
          </Link>
          <div className="border border-red-500/20 rounded-2xl bg-red-500/[0.04] p-12 text-center">
            <p className="text-red-400 mb-4" role="alert">
              Couldn&apos;t load this exercise: {error}
            </p>
            <button
              onClick={() => fetchExercise()}
              className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym/exercises" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
          Edit Exercise
        </h1>
        <p className="text-white/50 text-sm mb-8">
          Update exercise details
        </p>

        <div className="max-w-2xl space-y-6">
          {/* Exercise Name */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Exercise Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bench Press"
              className="w-full bg-white/5 border-white/10 text-white rounded-xl px-4 py-3 placeholder:text-white/30"
            />
          </div>

          {/* Primary Muscle Group */}
          <div>
            <label className="text-white/60 text-sm mb-3 block">Primary Muscle Group *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MUSCLE_GROUPS.map((muscle) => (
                <button
                  key={muscle}
                  onClick={() => setPrimaryMuscleGroup(muscle)}
                  className={`p-3 rounded-lg border transition-all duration-200 text-sm ${
                    primaryMuscleGroup === muscle
                      ? 'bg-white text-black border-white'
                      : 'bg-white/[0.02] border-white/10 text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Muscle Groups */}
          <div>
            <label className="text-white/60 text-sm mb-3 block">Secondary Muscle Groups (optional)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MUSCLE_GROUPS.filter(m => m !== primaryMuscleGroup).map((muscle) => (
                <button
                  key={muscle}
                  onClick={() => toggleSecondaryMuscle(muscle)}
                  className={`p-3 rounded-lg border transition-all duration-200 text-sm ${
                    secondaryMuscleGroups.includes(muscle)
                      ? 'bg-white/10 text-white border-white/20'
                      : 'bg-white/[0.02] border-white/10 text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment Type */}
          <div>
            <label className="text-white/60 text-sm mb-3 block">Equipment Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EQUIPMENT_TYPES.map((equipment) => (
                <button
                  key={equipment}
                  onClick={() => setEquipmentType(equipment)}
                  className={`p-3 rounded-lg border transition-all duration-200 text-sm ${
                    equipmentType === equipment
                      ? 'bg-white text-black border-white'
                      : 'bg-white/[0.02] border-white/10 text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {equipment}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-white/60 text-sm mb-3 block">Category *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`p-3 rounded-lg border transition-all duration-200 text-sm ${
                    category === cat
                      ? 'bg-white text-black border-white'
                      : 'bg-white/[0.02] border-white/10 text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-white/60 text-sm mb-2 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this exercise..."
              rows={3}
              className="w-full bg-white/5 border-white/10 text-white rounded-xl px-4 py-3 placeholder:text-white/30 resize-none"
            />
          </div>

          {/* Update Button */}
          <button
            onClick={handleUpdateExercise}
            disabled={saving || !name || !primaryMuscleGroup || !equipmentType || !category}
            className="w-full bg-white text-black hover:bg-white/90 rounded-xl px-4 py-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Update Exercise'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
