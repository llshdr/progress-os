'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import CookbookFormFields from '@/components/nutrition/cookbook-form-fields'
import { resizeImageFile } from '@/lib/image'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'

export default function EditRecipeClient() {
  const params = useParams()
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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchRecipe()
  }, [params.id])

  const fetchRecipe = async () => {
    const { data, error } = await supabase.from('cookbook_recipes').select('*').eq('id', params.id).single()

    if (error) {
      console.error('Error fetching recipe:', error)
      setLoadError(true)
      setLoading(false)
      return
    }

    setTitle(data.title)
    setCategory(data.category || '')
    setIngredients(data.ingredients)
    setInstructions(data.instructions)
    setCalories(data.calories != null ? String(data.calories) : '')
    setProtein(data.protein_g != null ? String(data.protein_g) : '')
    setFat(data.fat_g != null ? String(data.fat_g) : '')
    setCarbs(data.carbs_g != null ? String(data.carbs_g) : '')
    setServings(data.servings != null ? String(data.servings) : '')
    setPhotoUrl(data.photo_url)
    setLoading(false)
  }

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

  const handleUpdate = async () => {
    if (!isValid) return

    setSaving(true)

    const { error } = await supabase
      .from('cookbook_recipes')
      .update({
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
      .eq('id', params.id)

    if (error) {
      console.error('Error updating recipe:', error)
      setSaving(false)
    } else {
      router.push(`/nutrition/cookbook/${params.id}`)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageSkeleton />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && <LoadErrorBanner message="Couldn't load this recipe. Try refreshing." />}
        <Link href={`/nutrition/cookbook/${params.id}`} className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">Edit Recipe</h1>
        <p className="text-lapis-text-tertiary text-sm mb-8">Changes are visible to everyone as soon as you save</p>

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
            onClick={handleUpdate}
            disabled={saving || uploadingPhoto || !isValid}
            className="w-full bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 h-auto py-4 text-base font-medium"
          >
            {saving ? 'Saving...' : 'Update Recipe'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
