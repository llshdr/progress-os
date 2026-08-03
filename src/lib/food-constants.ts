export type MealTag = 'breakfast' | 'lunch' | 'dinner' | 'pwo' | 'snack' | 'intra_workout'

export const MEAL_TAGS: { value: MealTag; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'pwo', label: 'PWO' },
  { value: 'snack', label: 'Snack' },
  { value: 'intra_workout', label: 'Intra-Workout' },
]

export function mealTagLabel(tag: string | null): string {
  return MEAL_TAGS.find((t) => t.value === tag)?.label ?? 'Untagged'
}
