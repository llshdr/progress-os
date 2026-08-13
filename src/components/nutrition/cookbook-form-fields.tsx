'use client'

import { useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface CookbookFormFieldsProps {
  title: string
  onTitleChange: (value: string) => void
  category: string
  onCategoryChange: (value: string) => void
  ingredients: string
  onIngredientsChange: (value: string) => void
  instructions: string
  onInstructionsChange: (value: string) => void
  calories: string
  onCaloriesChange: (value: string) => void
  protein: string
  onProteinChange: (value: string) => void
  fat: string
  onFatChange: (value: string) => void
  carbs: string
  onCarbsChange: (value: string) => void
  servings: string
  onServingsChange: (value: string) => void
  photoPreviewUrl: string | null
  onPhotoFileSelect: (file: File) => void
  uploadingPhoto: boolean
}

// Shared by nutrition/cookbook/new and nutrition/cookbook/[id]/edit - same
// fields, same shape, so the two forms can't quietly drift from each
// other (same precedent as FoodFormFields for food_library). Photo upload
// itself (resize, storage call) stays owned by the parent page, same as
// avatar upload in profile/page.tsx - this component only surfaces the
// file picker and a preview.
export default function CookbookFormFields({
  title,
  onTitleChange,
  category,
  onCategoryChange,
  ingredients,
  onIngredientsChange,
  instructions,
  onInstructionsChange,
  calories,
  onCaloriesChange,
  protein,
  onProteinChange,
  fat,
  onFatChange,
  carbs,
  onCarbsChange,
  servings,
  onServingsChange,
  photoPreviewUrl,
  onPhotoFileSelect,
  uploadingPhoto,
}: CookbookFormFieldsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <div className="space-y-2">
        <Label className="text-lapis-text-secondary">Photo (optional)</Label>
        <div className="flex items-center gap-4">
          {photoPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreviewUrl}
              alt=""
              className="w-24 h-24 rounded-lapis-md object-cover border border-lapis-border-subtle"
            />
          ) : (
            <div className="w-24 h-24 rounded-lapis-md bg-lapis-surface-2 border border-lapis-border-subtle" />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onPhotoFileSelect(file)
            }}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploadingPhoto}
            onClick={() => fileInputRef.current?.click()}
            className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2"
          >
            {uploadingPhoto ? 'Uploading...' : photoPreviewUrl ? 'Change photo' : 'Add photo'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipe-title" className="text-lapis-text-secondary">
          Title *
        </Label>
        <Input
          id="recipe-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="High-Protein Chicken & Rice Bowl"
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="recipe-category" className="text-lapis-text-secondary">
            Category (optional)
          </Label>
          <Input
            id="recipe-category"
            type="text"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            placeholder="High-Protein Snack"
            className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recipe-servings" className="text-lapis-text-secondary">
            Servings (optional)
          </Label>
          <Input
            id="recipe-servings"
            type="number"
            value={servings}
            onChange={(e) => onServingsChange(e.target.value)}
            placeholder="4"
            className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipe-ingredients" className="text-lapis-text-secondary">
          Ingredients *
        </Label>
        <Textarea
          id="recipe-ingredients"
          value={ingredients}
          onChange={(e) => onIngredientsChange(e.target.value)}
          placeholder={'1 lb chicken breast\n2 cups cooked rice\n1 cup broccoli\n1 tbsp olive oil'}
          rows={5}
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
        />
        <p className="text-lapis-text-tertiary text-xs">One ingredient per line.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipe-instructions" className="text-lapis-text-secondary">
          Instructions *
        </Label>
        <Textarea
          id="recipe-instructions"
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder={'Season chicken and cook until internal temp hits 165°F\nSteam broccoli for 5 minutes\nCombine everything over rice'}
          rows={5}
          className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
        />
        <p className="text-lapis-text-tertiary text-xs">One step per line - shown as a numbered list.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-lapis-text-secondary">Macros per serving (optional - fill in when known)</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="recipe-calories" className="text-lapis-text-tertiary text-xs">
              Calories
            </Label>
            <Input
              id="recipe-calories"
              type="number"
              value={calories}
              onChange={(e) => onCaloriesChange(e.target.value)}
              placeholder="650"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-protein" className="text-lapis-text-tertiary text-xs">
              Protein (g)
            </Label>
            <Input
              id="recipe-protein"
              type="number"
              step="0.1"
              value={protein}
              onChange={(e) => onProteinChange(e.target.value)}
              placeholder="55"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-fat" className="text-lapis-text-tertiary text-xs">
              Fat (g)
            </Label>
            <Input
              id="recipe-fat"
              type="number"
              step="0.1"
              value={fat}
              onChange={(e) => onFatChange(e.target.value)}
              placeholder="15"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipe-carbs" className="text-lapis-text-tertiary text-xs">
              Carbs (g)
            </Label>
            <Input
              id="recipe-carbs"
              type="number"
              step="0.1"
              value={carbs}
              onChange={(e) => onCarbsChange(e.target.value)}
              placeholder="70"
              className="bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary placeholder:text-lapis-text-disabled"
            />
          </div>
        </div>
      </div>
    </>
  )
}
