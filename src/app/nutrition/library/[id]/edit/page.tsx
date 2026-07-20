'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import FoodFormFields from '@/components/nutrition/food-form-fields'
import type { MealTag } from '@/lib/food-constants'

export default function EditFoodPage() {
  const params = useParams()
  const router = useRouter()
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [fat, setFat] = useState('')
  const [carbs, setCarbs] = useState('')
  const [defaultMealTag, setDefaultMealTag] = useState<MealTag | null>(null)
  const [ingredients, setIngredients] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchFood()
  }, [params.id])

  const fetchFood = async () => {
    const { data, error } = await supabase.from('food_library').select('*').eq('id', params.id).single()

    if (error) {
      console.error('Error fetching food:', error)
      setLoading(false)
      return
    }

    setName(data.name)
    setCalories(String(data.calories))
    setProtein(String(data.protein_g))
    setFat(String(data.fat_g))
    setCarbs(String(data.carbs_g))
    setDefaultMealTag((data.default_meal_tag as MealTag) ?? null)
    setIngredients(data.ingredients || '')
    setLoading(false)
  }

  const isValid = name.trim() && calories && protein && fat && carbs

  const handleUpdate = async () => {
    if (!isValid) return

    setSaving(true)

    const { error } = await supabase
      .from('food_library')
      .update({
        name: name.trim(),
        calories: parseInt(calories, 10),
        protein_g: parseFloat(protein),
        fat_g: parseFloat(fat),
        carbs_g: parseFloat(carbs),
        default_meal_tag: defaultMealTag,
        ingredients: ingredients.trim() || null,
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error updating food:', error)
      setSaving(false)
    } else {
      router.push('/nutrition/library')
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white/40">Loading...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/nutrition/library" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Edit Food</h1>
        <p className="text-white/50 text-sm mb-8">
          Changes only affect future logging — past entries keep their own snapshot.
        </p>

        <div className="max-w-2xl space-y-6">
          <FoodFormFields
            name={name}
            onNameChange={setName}
            calories={calories}
            onCaloriesChange={setCalories}
            protein={protein}
            onProteinChange={setProtein}
            fat={fat}
            onFatChange={setFat}
            carbs={carbs}
            onCarbsChange={setCarbs}
            defaultMealTag={defaultMealTag}
            onDefaultMealTagChange={setDefaultMealTag}
            ingredients={ingredients}
            onIngredientsChange={setIngredients}
          />

          <Button
            onClick={handleUpdate}
            disabled={saving || !isValid}
            className="w-full bg-white text-black hover:bg-white/90 h-auto py-4 text-base font-medium"
          >
            {saving ? 'Saving...' : 'Update Food'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
