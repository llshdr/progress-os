'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Plus, Search, Archive, Trash2, Pencil } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { mealTagLabel } from '@/lib/food-constants'

type FoodTemplate = {
  id: string
  name: string
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  default_meal_tag: string | null
  archived: boolean
}

export default function FoodLibraryPage() {
  const [foods, setFoods] = useState<FoodTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [foodToDelete, setFoodToDelete] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchFoods()
  }, [])

  const fetchFoods = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // A food library realistically stays small (saved meals, not a food
    // database), so a plain fetch-all + client-side filter is enough — no
    // pagination/server search needed here.
    const { data, error } = await supabase
      .from('food_library')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching food library:', error)
    } else {
      setFoods(data || [])
    }
    setLoading(false)
  }

  const deleteFood = async () => {
    if (!foodToDelete) return

    // No backfill needed before delete — logged food items snapshot their
    // macros at log time, so removing a template never corrupts history.
    const { error } = await supabase.from('food_library').delete().eq('id', foodToDelete)

    if (error) {
      console.error('Error deleting food:', error)
    } else {
      fetchFoods()
    }
    setFoodToDelete(null)
  }

  const toggleArchive = async (id: string, currentArchived: boolean) => {
    const { error } = await supabase.from('food_library').update({ archived: !currentArchived }).eq('id', id)

    if (error) {
      console.error('Error toggling archive:', error)
    } else {
      fetchFoods()
    }
  }

  const openDeleteModal = (id: string) => {
    setFoodToDelete(id)
    setShowDeleteModal(true)
  }

  const filteredFoods = foods
    .filter((food) => showArchived || !food.archived)
    .filter((food) => food.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Food Library</h1>
            <p className="text-white/50 text-sm">Saved meals for one-click logging</p>
          </div>
          <Link href="/nutrition/library/new">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Food</span>
            </button>
          </Link>
        </div>

        <div className="space-y-4 mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search foods..."
              className="w-full bg-white/5 border-white/10 text-white rounded-xl pl-12 pr-4 py-3 placeholder:text-white/30"
            />
          </div>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showArchived ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-white/60 border-white/10'
            } border`}
          >
            <Archive className="w-4 h-4" />
            <span className="text-sm">Archived</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-white/40">Loading...</div>
          </div>
        ) : filteredFoods.length === 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40 mb-4">{searchQuery ? 'No foods found' : 'No saved foods yet'}</p>
            {!searchQuery && (
              <Link href="/nutrition/library/new">
                <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors">
                  Add your first food
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredFoods.map((food) => (
              <div
                key={food.id}
                className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-medium text-white">{food.name}</h3>
                      {food.default_meal_tag && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                          {mealTagLabel(food.default_meal_tag)}
                        </span>
                      )}
                      {food.archived && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                          Archived
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-white/40 text-sm">
                      <span>{food.calories} kcal</span>
                      <span>•</span>
                      <span>{food.protein_g}g protein</span>
                      <span>•</span>
                      <span>{food.fat_g}g fat</span>
                      <span>•</span>
                      <span>{food.carbs_g}g carbs</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/nutrition/library/${food.id}/edit`}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <Pencil className="w-5 h-5 text-white/40" />
                    </Link>
                    <button
                      onClick={() => toggleArchive(food.id, food.archived)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <Archive className="w-5 h-5 text-white/40" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(food.id)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-white/40" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete Food"
        description="This permanently removes the food from your library and cannot be undone. Already-logged entries keep their own snapshot of the macros, so past history isn't affected. If you just want to stop seeing it, use Archive instead."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={deleteFood}
        destructive
      />
    </AppLayout>
  )
}
