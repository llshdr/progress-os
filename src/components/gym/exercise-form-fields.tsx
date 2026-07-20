'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MUSCLE_GROUPS, EQUIPMENT_TYPES, CATEGORIES, EXERCISE_TYPES, type ExerciseType } from '@/lib/exercise-constants'

interface ExerciseFormFieldsProps {
  name: string
  onNameChange: (value: string) => void
  exerciseType: ExerciseType
  onExerciseTypeChange: (value: ExerciseType) => void
  primaryMuscleGroup: string
  onPrimaryMuscleGroupChange: (value: string) => void
  secondaryMuscleGroups: string[]
  onToggleSecondaryMuscle: (muscle: string) => void
  equipmentType: string
  onEquipmentTypeChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
}

// Shared by exercises/new and exercises/[id]/edit — same fields, same
// validation shape, so the two forms can't quietly drift from each other.
export default function ExerciseFormFields({
  name,
  onNameChange,
  exerciseType,
  onExerciseTypeChange,
  primaryMuscleGroup,
  onPrimaryMuscleGroupChange,
  secondaryMuscleGroups,
  onToggleSecondaryMuscle,
  equipmentType,
  onEquipmentTypeChange,
  category,
  onCategoryChange,
  notes,
  onNotesChange,
}: ExerciseFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="exercise-name" className="text-white/80">
          Exercise Name *
        </Label>
        <Input
          id="exercise-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Bench Press"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      <div>
        <Label className="text-white/80 mb-3 block">Type *</Label>
        <div className="grid grid-cols-2 gap-2">
          {EXERCISE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onExerciseTypeChange(type)}
              className={`p-3 rounded-lg border transition-all duration-200 text-sm ${
                exerciseType === type
                  ? 'bg-white text-black border-white'
                  : 'bg-white/[0.02] border-white/10 text-white hover:bg-white/[0.04]'
              }`}
            >
              {type === 'strength' ? 'Strength' : 'Cardio'}
            </button>
          ))}
        </div>
        {exerciseType === 'cardio' && (
          <p className="text-white/40 text-xs mt-2">
            Logged as distance/duration instead of weight/reps.
          </p>
        )}
      </div>

      <div>
        <Label className="text-white/80 mb-3 block">Primary Muscle Group *</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MUSCLE_GROUPS.map((muscle) => (
            <button
              key={muscle}
              type="button"
              onClick={() => onPrimaryMuscleGroupChange(muscle)}
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

      <div>
        <Label className="text-white/80 mb-3 block">Secondary Muscle Groups (optional)</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MUSCLE_GROUPS.filter((m) => m !== primaryMuscleGroup).map((muscle) => (
            <button
              key={muscle}
              type="button"
              onClick={() => onToggleSecondaryMuscle(muscle)}
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

      <div>
        <Label className="text-white/80 mb-3 block">Equipment Type *</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EQUIPMENT_TYPES.map((equipment) => (
            <button
              key={equipment}
              type="button"
              onClick={() => onEquipmentTypeChange(equipment)}
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

      <div>
        <Label className="text-white/80 mb-3 block">Category *</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
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

      <div className="space-y-2">
        <Label htmlFor="exercise-notes" className="text-white/80">
          Notes (optional)
        </Label>
        <Textarea
          id="exercise-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Any notes about this exercise..."
          rows={3}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
        />
      </div>
    </>
  )
}
