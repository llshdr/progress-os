'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function NewExercisePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState('')
  const [secondaryMuscleGroups, setSecondaryMuscleGroups] = useState<string[]>([])
  const [equipmentType, setEquipmentType] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const toggleSecondaryMuscle = (muscle: string) => {
    setSecondaryMuscleGroups(prev =>
      prev.includes(muscle)
        ? prev.filter(m => m !== muscle)
        : [...prev, muscle]
    )
  }

  const handleCreateExercise = async () => {
    if (!name || !primaryMuscleGroup || !equipmentType || !category) {
      alert('Please fill in all required fields')
      return
    }

    setLoading(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Error creating exercise (auth):', userError)
      alert(`Failed to create exercise: ${userError ? getErrorMessage(userError) : 'you must be signed in.'}`)
      setLoading(false)
      return
    }

    const { error } = await supabase.from('exercise_library').insert({
      user_id: user.id,
      name,
      primary_muscle_group: primaryMuscleGroup,
      secondary_muscle_groups: secondaryMuscleGroups.length > 0 ? secondaryMuscleGroups : null,
      equipment_type: equipmentType,
      category,
      notes: notes || null,
    })

    if (error) {
      console.error('Error creating exercise:', error)
      alert(`Failed to create exercise: ${getErrorMessage(error)}`)
      setLoading(false)
    } else {
      router.push('/gym/exercises')
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym/exercises" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
          Add Exercise
        </h1>
        <p className="text-white/50 text-sm mb-8">
          Create a new exercise for your library
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

          {/* Create Button */}
          <button
            onClick={handleCreateExercise}
            disabled={loading || !name || !primaryMuscleGroup || !equipmentType || !category}
            className="w-full bg-white text-black hover:bg-white/90 rounded-xl px-4 py-4 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Exercise'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
