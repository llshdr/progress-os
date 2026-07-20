'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import ExerciseFormFields from '@/components/gym/exercise-form-fields'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import type { ExerciseType } from '@/lib/exercise-constants'

export default function NewExercisePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [exerciseType, setExerciseType] = useState<ExerciseType>('strength')
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState('')
  const [secondaryMuscleGroups, setSecondaryMuscleGroups] = useState<string[]>([])
  const [equipmentType, setEquipmentType] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const supabase = createClient()

  const toggleSecondaryMuscle = (muscle: string) => {
    setSecondaryMuscleGroups((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]
    )
  }

  const createExercise = async (userId: string) => {
    setLoading(true)

    const { error } = await supabase.from('exercise_library').insert({
      user_id: userId,
      name,
      exercise_type: exerciseType,
      primary_muscle_group: primaryMuscleGroup,
      secondary_muscle_groups: secondaryMuscleGroups.length > 0 ? secondaryMuscleGroups : null,
      equipment_type: equipmentType,
      category,
      notes: notes || null,
    })

    if (error) {
      console.error('Error creating exercise:', error)
      setLoading(false)
    } else {
      router.push('/gym/exercises')
    }
  }

  const handleCreateExercise = async () => {
    if (!name || !primaryMuscleGroup || !equipmentType || !category) {
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Same-named exercises (case-insensitive) can cross-contaminate each
    // other's history/stats via the ilike name-matching fallback, so warn
    // rather than silently allowing it.
    const { data: existing } = await supabase
      .from('exercise_library')
      .select('id')
      .eq('user_id', user.id)
      .ilike('name', name)
      .limit(1)
      .maybeSingle()

    if (existing) {
      setShowDuplicateModal(true)
      return
    }

    await createExercise(user.id)
  }

  const handleConfirmDuplicate = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await createExercise(user.id)
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
          <ExerciseFormFields
            name={name}
            onNameChange={setName}
            exerciseType={exerciseType}
            onExerciseTypeChange={setExerciseType}
            primaryMuscleGroup={primaryMuscleGroup}
            onPrimaryMuscleGroupChange={setPrimaryMuscleGroup}
            secondaryMuscleGroups={secondaryMuscleGroups}
            onToggleSecondaryMuscle={toggleSecondaryMuscle}
            equipmentType={equipmentType}
            onEquipmentTypeChange={setEquipmentType}
            category={category}
            onCategoryChange={setCategory}
            notes={notes}
            onNotesChange={setNotes}
          />

          <Button
            onClick={handleCreateExercise}
            disabled={loading || !name || !primaryMuscleGroup || !equipmentType || !category}
            className="w-full bg-white text-black hover:bg-white/90 h-auto py-4 text-base font-medium"
          >
            {loading ? 'Creating...' : 'Create Exercise'}
          </Button>
        </div>
      </div>

      <ConfirmationModal
        open={showDuplicateModal}
        onOpenChange={setShowDuplicateModal}
        title="Exercise Already Exists"
        description={`You already have an exercise named "${name}". Creating another one with the same name can mix up their history and stats. Create it anyway, or go back and check the existing one?`}
        confirmText="Create Anyway"
        cancelText="Go Back"
        onConfirm={handleConfirmDuplicate}
      />
    </AppLayout>
  )
}
