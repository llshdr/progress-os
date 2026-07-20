export type MealTag = 'breakfast' | 'lunch' | 'dinner' | 'pwo' | 'snack'

export const MEAL_TAGS: { value: MealTag; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'pwo', label: 'PWO' },
  { value: 'snack', label: 'Snack' },
]

export function mealTagLabel(tag: string | null): string {
  return MEAL_TAGS.find((t) => t.value === tag)?.label ?? 'Untagged'
}
