'use client'

import { MEAL_TAGS, type MealTag } from '@/lib/food-constants'

interface MealTagPickerProps {
  value: MealTag | null
  onChange: (value: MealTag | null) => void
  allowClear?: boolean
}

// Shared by the food-library template form and every food item row (manual
// or library-sourced) in the nutrition Log dialog, so tagging stays
// consistent wherever it appears.
export default function MealTagPicker({ value, onChange, allowClear = true }: MealTagPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MEAL_TAGS.map((tag) => (
        <button
          key={tag.value}
          type="button"
          onClick={() => onChange(allowClear && value === tag.value ? null : tag.value)}
          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
            value === tag.value
              ? 'bg-white text-black'
              : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
          }`}
        >
          {tag.label}
        </button>
      ))}
    </div>
  )
}
