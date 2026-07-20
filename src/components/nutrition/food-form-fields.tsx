'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import MealTagPicker from '@/components/nutrition/meal-tag-picker'
import type { MealTag } from '@/lib/food-constants'

interface FoodFormFieldsProps {
  name: string
  onNameChange: (value: string) => void
  calories: string
  onCaloriesChange: (value: string) => void
  protein: string
  onProteinChange: (value: string) => void
  fat: string
  onFatChange: (value: string) => void
  carbs: string
  onCarbsChange: (value: string) => void
  defaultMealTag: MealTag | null
  onDefaultMealTagChange: (value: MealTag | null) => void
  ingredients: string
  onIngredientsChange: (value: string) => void
}

// Shared by nutrition/library/new and nutrition/library/[id]/edit — same
// fields, same shape, so the two forms can't quietly drift from each other.
export default function FoodFormFields({
  name,
  onNameChange,
  calories,
  onCaloriesChange,
  protein,
  onProteinChange,
  fat,
  onFatChange,
  carbs,
  onCarbsChange,
  defaultMealTag,
  onDefaultMealTagChange,
  ingredients,
  onIngredientsChange,
}: FoodFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="food-name" className="text-white/80">
          Name *
        </Label>
        <Input
          id="food-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Chicken & Rice Bowl"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="food-calories" className="text-white/80">
            Calories *
          </Label>
          <Input
            id="food-calories"
            type="number"
            value={calories}
            onChange={(e) => onCaloriesChange(e.target.value)}
            placeholder="650"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="food-protein" className="text-white/80">
            Protein (g) *
          </Label>
          <Input
            id="food-protein"
            type="number"
            step="0.1"
            value={protein}
            onChange={(e) => onProteinChange(e.target.value)}
            placeholder="45"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="food-fat" className="text-white/80">
            Fat (g) *
          </Label>
          <Input
            id="food-fat"
            type="number"
            step="0.1"
            value={fat}
            onChange={(e) => onFatChange(e.target.value)}
            placeholder="18"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="food-carbs" className="text-white/80">
            Carbs (g) *
          </Label>
          <Input
            id="food-carbs"
            type="number"
            step="0.1"
            value={carbs}
            onChange={(e) => onCarbsChange(e.target.value)}
            placeholder="70"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-white/80">Default Meal (optional)</Label>
        <MealTagPicker value={defaultMealTag} onChange={onDefaultMealTagChange} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="food-ingredients" className="text-white/80">
          Ingredients (optional)
        </Label>
        <Textarea
          id="food-ingredients"
          value={ingredients}
          onChange={(e) => onIngredientsChange(e.target.value)}
          placeholder="Chicken breast, rice, broccoli, olive oil..."
          rows={3}
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
        />
        <p className="text-white/40 text-xs">
          Descriptive only — shown when logging and passed to the AI insight for context, never used in
          any calculation.
        </p>
      </div>
    </>
  )
}
