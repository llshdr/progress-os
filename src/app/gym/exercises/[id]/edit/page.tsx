'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import ExerciseFormFields from '@/components/gym/exercise-form-fields'
import ExerciseVariantsManager from '@/components/gym/exercise-variants-manager'
import type { ExerciseType, CardioType, PrimaryLift } from '@/lib/exercise-constants'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'

export default function EditExercisePage() {
  const params = useParams()
  const router = useRouter()
  const [name, setName] = useState('')
  const [exerciseType, setExerciseType] = useState<ExerciseType>('strength')
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState('')
  const [secondaryMuscleGroups, setSecondaryMuscleGroups] = useState<string[]>([])
  const [muscleTargets, setMuscleTargets] = useState<string[]>([])
  const [cardioType, setCardioType] = useState<CardioType | null>(null)
  const [primaryLift, setPrimaryLift] = useState<PrimaryLift | null>(null)
  const [equipmentType, setEquipmentType] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [isUnilateral, setIsUnilateral] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchExercise()
  }, [params.id])

  const fetchExercise = async () => {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching exercise:', error)
      setLoadError(true)
      setLoading(false)
      return
    }

    setName(data.name)
    setExerciseType((data.exercise_type as ExerciseType) ?? 'strength')
    setPrimaryMuscleGroup(data.primary_muscle_group)
    setSecondaryMuscleGroups(data.secondary_muscle_groups || [])
    setMuscleTargets(data.muscle_targets || [])
    setCardioType((data.cardio_type as CardioType | null) ?? null)
    setPrimaryLift((data.primary_lift as PrimaryLift | null) ?? null)
    setEquipmentType(data.equipment_type)
    setCategory(data.category)
    setNotes(data.notes || '')
    setIsUnilateral(data.is_unilateral ?? false)
    setLoading(false)
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

  // Cardio requires cardioType instead of primaryMuscleGroup - the two
  // pickers are mutually exclusive in the form (see ExerciseFormFields).
  const requiredFieldsFilled =
    !!name && !!equipmentType && !!category && (exerciseType === 'cardio' ? !!cardioType : !!primaryMuscleGroup)

  const handleUpdateExercise = async () => {
    if (!requiredFieldsFilled) {
      return
    }

    setSaving(true)

    // Same 'Full Body' convention as exercises/new - computeSlotMuscles
    // (gym-schedule.ts) reads primary_muscle_group from any exercise in a
    // workout template, cardio included, so it still needs a sane value
    // even though cardio no longer shows the muscle-group picker.
    const { error } = await supabase
      .from('exercise_library')
      .update({
        name,
        exercise_type: exerciseType,
        primary_muscle_group: exerciseType === 'cardio' ? 'Full Body' : primaryMuscleGroup,
        secondary_muscle_groups: exerciseType === 'cardio' || secondaryMuscleGroups.length === 0 ? null : secondaryMuscleGroups,
        muscle_targets: exerciseType === 'cardio' || muscleTargets.length === 0 ? null : muscleTargets,
        cardio_type: exerciseType === 'cardio' ? cardioType : null,
        primary_lift: exerciseType === 'strength' ? primaryLift : null,
        equipment_type: equipmentType,
        category,
        notes: notes || null,
        is_unilateral: isUnilateral,
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error updating exercise:', error)
      setSaving(false)
    } else {
      router.push('/gym/exercises')
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <PageSkeleton />
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && <LoadErrorBanner message="Couldn't load this exercise. Try refreshing." />}
        <Link href="/gym/exercises" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">
          Edit Exercise
        </h1>
        <p className="text-lapis-text-tertiary text-sm mb-8">
          Update exercise details
        </p>

        <div className="max-w-2xl space-y-6">
          <ExerciseFormFields
            name={name}
            onNameChange={setName}
            exerciseType={exerciseType}
            onExerciseTypeChange={setExerciseType}
            primaryMuscleGroup={primaryMuscleGroup}
            onPrimaryMuscleGroupChange={handlePrimaryMuscleGroupChange}
            secondaryMuscleGroups={secondaryMuscleGroups}
            onToggleSecondaryMuscle={toggleSecondaryMuscle}
            muscleTargets={muscleTargets}
            onToggleMuscleTarget={toggleMuscleTarget}
            cardioType={cardioType}
            onCardioTypeChange={setCardioType}
            primaryLift={primaryLift}
            onPrimaryLiftChange={setPrimaryLift}
            equipmentType={equipmentType}
            onEquipmentTypeChange={setEquipmentType}
            category={category}
            onCategoryChange={setCategory}
            notes={notes}
            onNotesChange={setNotes}
            isUnilateral={isUnilateral}
            onIsUnilateralChange={setIsUnilateral}
          />

          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
            <ExerciseVariantsManager exerciseLibraryId={params.id as string} equipmentType={equipmentType} />
          </div>

          <Button
            onClick={handleUpdateExercise}
            disabled={saving || !requiredFieldsFilled}
            className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-auto py-4 text-base font-medium"
          >
            {saving ? 'Saving...' : 'Update Exercise'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
