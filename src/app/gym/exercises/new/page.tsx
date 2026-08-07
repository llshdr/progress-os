'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import ExerciseFormFields from '@/components/gym/exercise-form-fields'
import CatalogSearch, { type CatalogEntry } from '@/components/gym/catalog-search'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import type { ExerciseType } from '@/lib/exercise-constants'
import { inferMuscleTargets } from '@/lib/muscle-targets'
import { suggestIsUnilateral } from '@/lib/unilateral'

export default function NewExercisePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [exerciseType, setExerciseType] = useState<ExerciseType>('strength')
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState('')
  const [secondaryMuscleGroups, setSecondaryMuscleGroups] = useState<string[]>([])
  const [muscleTargets, setMuscleTargets] = useState<string[]>([])
  const [equipmentType, setEquipmentType] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [isUnilateral, setIsUnilateral] = useState(false)
  // Tracks whether the user has explicitly decided this one way or
  // another (via the checkbox itself, or by picking a catalog entry
  // that already carries a real answer) - once true, typing in the name
  // field never silently overrides their choice again.
  const [unilateralTouched, setUnilateralTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const supabase = createClient()

  // Suggest-only: pre-fills the toggle from the name as the user types,
  // but only until they've made an explicit choice of their own - same
  // "suggest, never silently decide" precedent as classifyDiscipline.
  const handleNameChange = (value: string) => {
    setName(value)
    if (!unilateralTouched) setIsUnilateral(suggestIsUnilateral(value))
  }

  const handleIsUnilateralChange = (value: boolean) => {
    setIsUnilateral(value)
    setUnilateralTouched(true)
  }

  const toggleSecondaryMuscle = (muscle: string) => {
    setSecondaryMuscleGroups((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]
    )
  }

  const toggleMuscleTarget = (target: string) => {
    setMuscleTargets((prev) => (prev.includes(target) ? prev.filter((t) => t !== target) : [...prev, target]))
  }

  // Changing the broad group invalidates any refine picks made for the
  // previous one - the granular options themselves are scoped per group.
  const handlePrimaryMuscleGroupChange = (value: string) => {
    setPrimaryMuscleGroup(value)
    setMuscleTargets([])
  }

  // Explicit copy into the form's own state — not a save, not a link back
  // to the catalog. The user still reviews/edits and saves via the same
  // Create Exercise button as always. Granular muscle targets come along
  // for free here — this is the primary way they get filled in at all.
  const handleCatalogSelect = (entry: CatalogEntry) => {
    setName(entry.name)
    setExerciseType(entry.exercise_type as ExerciseType)
    setPrimaryMuscleGroup(entry.muscle_group)
    setSecondaryMuscleGroups([])
    setMuscleTargets(entry.muscle_targets ?? [])
    setEquipmentType(entry.equipment_type)
    setCategory(entry.category)
    // The catalog's own is_unilateral is a real, curated answer - a
    // stronger signal than the name-pattern guess, so treat it the same
    // as an explicit user choice (still fully overridable via the
    // checkbox afterward).
    setIsUnilateral(entry.is_unilateral)
    setUnilateralTouched(true)
  }

  const createExercise = async (userId: string) => {
    setLoading(true)

    // Only guess when the user hasn't picked anything themselves (via
    // catalog copy or the optional refine chips) - never overrides an
    // explicit choice.
    const finalMuscleTargets =
      muscleTargets.length > 0 ? muscleTargets : inferMuscleTargets(name, primaryMuscleGroup)

    const { error } = await supabase.from('exercise_library').insert({
      user_id: userId,
      name,
      exercise_type: exerciseType,
      primary_muscle_group: primaryMuscleGroup,
      secondary_muscle_groups: secondaryMuscleGroups.length > 0 ? secondaryMuscleGroups : null,
      muscle_targets: finalMuscleTargets,
      equipment_type: equipmentType,
      category,
      notes: notes || null,
      is_unilateral: isUnilateral,
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
        <Link href="/gym/exercises" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">
          Add Exercise
        </h1>
        <p className="text-lapis-text-tertiary text-sm mb-8">
          Create a new exercise for your library
        </p>

        <div className="max-w-2xl space-y-6">
          <CatalogSearch onSelect={handleCatalogSelect} />

          <div className="border-t border-lapis-border-subtle pt-6 space-y-6">
            <ExerciseFormFields
              name={name}
              onNameChange={handleNameChange}
              exerciseType={exerciseType}
              onExerciseTypeChange={setExerciseType}
              primaryMuscleGroup={primaryMuscleGroup}
              onPrimaryMuscleGroupChange={handlePrimaryMuscleGroupChange}
              secondaryMuscleGroups={secondaryMuscleGroups}
              onToggleSecondaryMuscle={toggleSecondaryMuscle}
              muscleTargets={muscleTargets}
              onToggleMuscleTarget={toggleMuscleTarget}
              equipmentType={equipmentType}
              onEquipmentTypeChange={setEquipmentType}
              category={category}
              onCategoryChange={setCategory}
              notes={notes}
              onNotesChange={setNotes}
              isUnilateral={isUnilateral}
              onIsUnilateralChange={handleIsUnilateralChange}
            />
          </div>

          <Button
            onClick={handleCreateExercise}
            disabled={loading || !name || !primaryMuscleGroup || !equipmentType || !category}
            className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-auto py-4 text-base font-medium"
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
