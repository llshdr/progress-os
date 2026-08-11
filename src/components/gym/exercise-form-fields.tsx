'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  CATEGORIES,
  EXERCISE_TYPES,
  CARDIO_TYPES,
  CARDIO_TYPE_LABELS,
  PRIMARY_LIFTS,
  PRIMARY_LIFT_LABELS,
  type ExerciseType,
  type CardioType,
  type PrimaryLift,
} from '@/lib/exercise-constants'
import { MUSCLE_TARGETS_BY_GROUP } from '@/lib/muscle-targets'

interface ExerciseFormFieldsProps {
  name: string
  onNameChange: (value: string) => void
  exerciseType: ExerciseType
  onExerciseTypeChange: (value: ExerciseType) => void
  primaryMuscleGroup: string
  onPrimaryMuscleGroupChange: (value: string) => void
  secondaryMuscleGroups: string[]
  onToggleSecondaryMuscle: (muscle: string) => void
  muscleTargets: string[]
  onToggleMuscleTarget: (target: string) => void
  cardioType: CardioType | null
  onCardioTypeChange: (value: CardioType) => void
  primaryLift: PrimaryLift | null
  onPrimaryLiftChange: (value: PrimaryLift | null) => void
  equipmentType: string
  onEquipmentTypeChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  isUnilateral: boolean
  onIsUnilateralChange: (value: boolean) => void
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
  muscleTargets,
  onToggleMuscleTarget,
  cardioType,
  onCardioTypeChange,
  primaryLift,
  onPrimaryLiftChange,
  equipmentType,
  onEquipmentTypeChange,
  category,
  onCategoryChange,
  notes,
  onNotesChange,
  isUnilateral,
  onIsUnilateralChange,
}: ExerciseFormFieldsProps) {
  const refineOptions = MUSCLE_TARGETS_BY_GROUP[primaryMuscleGroup] ?? []

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="exercise-name" className="text-lapis-text-secondary">
          Exercise Name *
        </Label>
        <Input
          id="exercise-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Bench Press"
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
        />
      </div>

      <div>
        <Label className="text-lapis-text-secondary mb-3 block">Type *</Label>
        <div className="grid grid-cols-2 gap-2">
          {EXERCISE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onExerciseTypeChange(type)}
              className={`p-3 rounded-lapis-sm border transition-all duration-200 text-sm ${
                exerciseType === type
                  ? 'bg-lapis-accent-500 text-lapis-text-primary border-lapis-border'
                  : 'bg-lapis-surface-1 border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2'
              }`}
            >
              {type === 'strength' ? 'Strength' : 'Cardio'}
            </button>
          ))}
        </div>
        {exerciseType === 'cardio' && (
          <p className="text-lapis-text-tertiary text-xs mt-2">
            Logged as distance/duration instead of weight/reps.
          </p>
        )}
      </div>

      {exerciseType === 'cardio' ? (
        <div>
          <Label className="text-lapis-text-secondary mb-3 block">Cardio Type *</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CARDIO_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onCardioTypeChange(type)}
                className={`p-3 rounded-lapis-sm border transition-all duration-200 text-sm ${
                  cardioType === type
                    ? 'bg-lapis-accent-500 text-lapis-text-primary border-lapis-border'
                    : 'bg-lapis-surface-1 border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2'
                }`}
              >
                {CARDIO_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          {(cardioType === 'running' || cardioType === 'cycling' || cardioType === 'swimming') && (
            <p className="text-lapis-text-tertiary text-xs mt-2">Counts toward Races' swim/bike/run training data automatically.</p>
          )}
        </div>
      ) : (
        <>
          <div>
            <Label className="text-lapis-text-secondary mb-3 block">Muscle Target *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MUSCLE_GROUPS.map((muscle) => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => onPrimaryMuscleGroupChange(muscle)}
                  className={`p-3 rounded-lapis-sm border transition-all duration-200 text-sm ${
                    primaryMuscleGroup === muscle
                      ? 'bg-lapis-accent-500 text-lapis-text-primary border-lapis-border'
                      : 'bg-lapis-surface-1 border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2'
                  }`}
                >
                  {muscle}
                </button>
              ))}
            </div>

            {refineOptions.length > 0 && (
              <div className="mt-3">
                <Label className="text-lapis-text-secondary mb-2 block text-xs">Get more specific (optional)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {refineOptions.map((target) => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => onToggleMuscleTarget(target)}
                      className={`p-2.5 rounded-lapis-sm border transition-all duration-200 text-xs ${
                        muscleTargets.includes(target)
                          ? 'bg-lapis-surface-2 text-lapis-text-primary border-lapis-border-strong'
                          : 'bg-lapis-surface-1 border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2'
                      }`}
                    >
                      {target}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <Label className="text-lapis-text-secondary mb-3 block">Secondary Muscle Groups (optional)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MUSCLE_GROUPS.filter((m) => m !== primaryMuscleGroup).map((muscle) => (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => onToggleSecondaryMuscle(muscle)}
                  className={`p-3 rounded-lapis-sm border transition-all duration-200 text-sm ${
                    secondaryMuscleGroups.includes(muscle)
                      ? 'bg-lapis-surface-2 text-lapis-text-primary border-lapis-border-strong'
                      : 'bg-lapis-surface-1 border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2'
                  }`}
                >
                  {muscle}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {exerciseType === 'strength' && (
        <div>
          <Label className="text-lapis-text-secondary mb-3 block">Leaderboard Lift (optional)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onPrimaryLiftChange(null)}
              className={`p-3 rounded-lapis-sm border transition-all duration-200 text-sm ${
                primaryLift === null
                  ? 'bg-lapis-accent-500 text-lapis-text-primary border-lapis-border'
                  : 'bg-lapis-surface-1 border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2'
              }`}
            >
              None
            </button>
            {PRIMARY_LIFTS.map((lift) => (
              <button
                key={lift}
                type="button"
                onClick={() => onPrimaryLiftChange(lift)}
                className={`p-3 rounded-lapis-sm border transition-all duration-200 text-sm ${
                  primaryLift === lift
                    ? 'bg-lapis-accent-500 text-lapis-text-primary border-lapis-border'
                    : 'bg-lapis-surface-1 border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2'
                }`}
              >
                {PRIMARY_LIFT_LABELS[lift]}
              </button>
            ))}
          </div>
          <p className="text-lapis-text-tertiary text-xs mt-2">
            If this is one of the four tracked lifts, tagging it feeds the strength leaderboard (real logged sets → an
            auto-estimated 1RM). Most people never need this - copying the matching exercise from the library already
            tags it automatically.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-lapis-text-secondary">
          <input type="checkbox" checked={isUnilateral} onChange={(e) => onIsUnilateralChange(e.target.checked)} />
          Unilateral (one side at a time)
        </label>
        <p className="text-lapis-text-tertiary text-xs">
          e.g. single-arm rows, Bulgarian split squats, walking lunges - helps the AI Coach reason about progression more
          carefully for this exercise.
        </p>
      </div>

      <div>
        <Label className="text-lapis-text-secondary mb-3 block">Equipment Type *</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EQUIPMENT_TYPES.map((equipment) => (
            <button
              key={equipment}
              type="button"
              onClick={() => onEquipmentTypeChange(equipment)}
              className={`p-3 rounded-lapis-sm border transition-all duration-200 text-sm ${
                equipmentType === equipment
                  ? 'bg-lapis-accent-500 text-lapis-text-primary border-lapis-border'
                  : 'bg-lapis-surface-1 border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2'
              }`}
            >
              {equipment}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-lapis-text-secondary mb-3 block">Category *</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`p-3 rounded-lapis-sm border transition-all duration-200 text-sm ${
                category === cat
                  ? 'bg-lapis-accent-500 text-lapis-text-primary border-lapis-border'
                  : 'bg-lapis-surface-1 border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="exercise-notes" className="text-lapis-text-secondary">
          Notes (optional)
        </Label>
        <Textarea
          id="exercise-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Any notes about this exercise..."
          rows={3}
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled resize-none"
        />
      </div>
    </>
  )
}
