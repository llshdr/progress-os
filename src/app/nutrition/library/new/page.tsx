'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import FoodFormFields from '@/components/nutrition/food-form-fields'
import type { MealTag } from '@/lib/food-constants'

export default function NewFoodPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [fat, setFat] = useState('')
  const [carbs, setCarbs] = useState('')
  const [defaultMealTag, setDefaultMealTag] = useState<MealTag | null>(null)
  const [ingredients, setIngredients] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const isValid = name.trim() && calories && protein && fat && carbs

  const handleCreate = async () => {
    if (!isValid) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setLoading(true)

    const { error } = await supabase.from('food_library').insert({
      user_id: user.id,
      name: name.trim(),
      calories: parseInt(calories, 10),
      protein_g: parseFloat(protein),
      fat_g: parseFloat(fat),
      carbs_g: parseFloat(carbs),
      default_meal_tag: defaultMealTag,
      ingredients: ingredients.trim() || null,
    })

    if (error) {
      console.error('Error creating food:', error)
      setLoading(false)
    } else {
      router.push('/nutrition/library')
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/nutrition/library" className="text-white/40 hover:text-white/60 transition-colors mb-6 block">
          ← Back
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Add Food</h1>
        <p className="text-white/50 text-sm mb-8">Save a meal for one-click logging</p>

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
            onClick={handleCreate}
            disabled={loading || !isValid}
            className="w-full bg-white text-black hover:bg-white/90 h-auto py-4 text-base font-medium"
          >
            {loading ? 'Creating...' : 'Create Food'}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}
