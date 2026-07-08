'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import ExerciseForm, {
  type ExerciseFormValues,
} from '@/components/gym/exercise-form'

export default function NewExercisePage() {
  const router = useRouter()
  const supabase = createClient()

  const handleCreate = async (values: ExerciseFormValues) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('exercise_library').insert({
      user_id: user.id,
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

    if (error) {
      console.error('Error creating exercise:', error)
      alert('Failed to create exercise')
      return
    }

    router.push('/gym/exercises')
  }

  return (
    <AppLayout>
      <ExerciseForm
        title="Add Exercise"
        subtitle="Create a new exercise for your library"
        backHref="/gym/exercises"
        submitLabel="Create Exercise"
        savingLabel="Creating..."
        onSubmit={handleCreate}
      />
    </AppLayout>
  )
}
