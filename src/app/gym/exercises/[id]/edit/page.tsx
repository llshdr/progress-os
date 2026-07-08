'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { LoadingState } from '@/components/ui/loading-state'
import ExerciseForm, {
  type ExerciseFormValues,
} from '@/components/gym/exercise-form'

export default function EditExercisePage() {
  const params = useParams()
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [loading, setLoading] = useState(true)
  const [initialValues, setInitialValues] =
    useState<ExerciseFormValues | null>(null)

  useEffect(() => {
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

      setInitialValues({
        name: data.name,
        primaryMuscleGroup: data.primary_muscle_group,
        secondaryMuscleGroups: data.secondary_muscle_groups || [],
        equipmentType: data.equipment_type,
        category: data.category,
        notes: data.notes || '',
      })
      setLoading(false)
    }

    fetchExercise()
  }, [params.id, supabase])

  const handleUpdate = async (values: ExerciseFormValues) => {
    const { error } = await supabase
      .from('exercise_library')
      .update({
        name: values.name,
        primary_muscle_group: values.primaryMuscleGroup,
        secondary_muscle_groups:
          values.secondaryMuscleGroups.length > 0
            ? values.secondaryMuscleGroups
            : null,
        equipment_type: values.equipmentType,
        category: values.category,
        notes: values.notes || null,
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error updating exercise:', error)
      alert('Failed to update exercise')
      return
    }

    router.push('/gym/exercises')
  }

  return (
    <AppLayout>
      {loading || !initialValues ? (
        <LoadingState />
      ) : (
        <ExerciseForm
          title="Edit Exercise"
          subtitle="Update exercise details"
          backHref="/gym/exercises"
          submitLabel="Update Exercise"
          savingLabel="Saving..."
          initialValues={initialValues}
          onSubmit={handleUpdate}
        />
      )}
    </AppLayout>
  )
}
