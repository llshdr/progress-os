'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import ExerciseFormFields from '@/components/gym/exercise-form-fields'
import ExerciseVariantsManager from '@/components/gym/exercise-variants-manager'

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
    setSecondaryMuscleGroups((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]
    )
  }

  const handleUpdateExercise = async () => {
    if (!name || !primaryMuscleGroup || !equipmentType || !category) {
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
          <ExerciseFormFields
            name={name}
            onNameChange={setName}
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

          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
            <ExerciseVariantsManager exerciseLibraryId={params.id as string} />
          </div>

          <Button
            onClick={handleUpdateExercise}
            disabled={saving || !name || !primaryMuscleGroup || !equipmentType || !category}
            className="w-full bg-white text-black hover:bg-white/90 h-auto py-4 text-base font-medium"
          >
            {saving ? 'Saving...' : 'Update Exercise'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
