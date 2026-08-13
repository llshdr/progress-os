'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import CookbookFormFields from '@/components/nutrition/cookbook-form-fields'
import { resizeImageFile } from '@/lib/image'

export default function NewRecipeClient() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [instructions, setInstructions] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [fat, setFat] = useState('')
  const [carbs, setCarbs] = useState('')
  const [servings, setServings] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const isValid = title.trim() && ingredients.trim() && instructions.trim()

  const handlePhotoSelect = async (file: File) => {
    setUploadingPhoto(true)
    try {
      const resized = await resizeImageFile(file, 1024)
      const path = `${crypto.randomUUID()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('cookbook-photos')
        .upload(path, resized, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('cookbook-photos').getPublicUrl(path)
      setPhotoUrl(publicUrlData.publicUrl)
    } catch (error) {
      console.error('Error uploading recipe photo:', error)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleCreate = async () => {
    if (!isValid) return

    setSaving(true)

    const { data, error } = await supabase
      .from('cookbook_recipes')
      .insert({
        title: title.trim(),
        category: category.trim() || null,
        ingredients: ingredients.trim(),
        instructions: instructions.trim(),
        calories: calories ? parseInt(calories, 10) : null,
        protein_g: protein ? parseFloat(protein) : null,
        fat_g: fat ? parseFloat(fat) : null,
        carbs_g: carbs ? parseFloat(carbs) : null,
        servings: servings ? parseInt(servings, 10) : null,
        photo_url: photoUrl,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating recipe:', error)
      setSaving(false)
    } else {
      router.push(`/nutrition/cookbook/${data.id}`)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/nutrition/cookbook" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">Add Recipe</h1>
        <p className="text-lapis-text-tertiary text-sm mb-8">Visible to everyone once saved</p>

        <div className="space-y-6">
          <CookbookFormFields
            title={title}
            onTitleChange={setTitle}
            category={category}
            onCategoryChange={setCategory}
            ingredients={ingredients}
            onIngredientsChange={setIngredients}
            instructions={instructions}
            onInstructionsChange={setInstructions}
            calories={calories}
            onCaloriesChange={setCalories}
            protein={protein}
            onProteinChange={setProtein}
            fat={fat}
            onFatChange={setFat}
            carbs={carbs}
            onCarbsChange={setCarbs}
            servings={servings}
            onServingsChange={setServings}
            photoPreviewUrl={photoUrl}
            onPhotoFileSelect={handlePhotoSelect}
            uploadingPhoto={uploadingPhoto}
          />

          <Button
            onClick={handleCreate}
            disabled={saving || uploadingPhoto || !isValid}
            className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-auto py-4 text-base font-medium"
          >
            {saving ? 'Creating...' : 'Create Recipe'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
