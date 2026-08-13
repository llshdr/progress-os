'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'
import { useIsOwner } from '@/lib/use-is-owner'
import { ChefHat, Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Recipe = {
  id: string
  title: string
  category: string | null
  calories: number | null
  protein_g: number | null
  photo_url: string | null
}

export default function CookbookPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const isOwner = useIsOwner()
  const supabase = createClient()

  useEffect(() => {
    fetchRecipes()
  }, [])

  const fetchRecipes = async () => {
    const { data, error } = await supabase
      .from('cookbook_recipes')
      .select('id, title, category, calories, protein_g, photo_url')
      .order('title', { ascending: true })

    if (error) {
      console.error('Error fetching cookbook recipes:', error)
      setLoadError(true)
    } else {
      setRecipes(data || [])
    }
    setLoading(false)
  }

  // Derived from whatever categories are actually in use, not a fixed
  // list - category is free text (see migration 085's own reasoning), so
  // the filter set should just reflect real data rather than a
  // hardcoded taxonomy that could drift from it.
  const categories = Array.from(new Set(recipes.map((r) => r.category).filter((c): c is string => Boolean(c)))).sort()

  const filteredRecipes = categoryFilter ? recipes.filter((r) => r.category === categoryFilter) : recipes

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && <LoadErrorBanner message="Couldn't load the cookbook. Try refreshing." />}
        <Link href="/nutrition" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">Cookbook</h1>
            <p className="text-lapis-text-tertiary text-sm">Practical high-protein recipes, real ingredients, real macros</p>
          </div>
          {isOwner && (
            <Link href="/nutrition/cookbook/new">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lapis-md bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 transition-colors">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Recipe</span>
              </button>
            </Link>
          )}
        </div>

        {loading ? (
          <PageSkeleton />
        ) : recipes.length === 0 ? (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
            <ChefHat className="w-10 h-10 text-lapis-text-disabled mx-auto mb-4" />
            <p className="text-lapis-text-tertiary">No recipes yet</p>
          </div>
        ) : (
          <>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                <button
                  onClick={() => setCategoryFilter(null)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    categoryFilter === null
                      ? 'bg-lapis-accent-500 text-lapis-text-primary'
                      : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2'
                  }`}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      categoryFilter === category
                        ? 'bg-lapis-accent-500 text-lapis-text-primary'
                        : 'bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle hover:bg-lapis-surface-2'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRecipes.map((recipe) => (
                <Link key={recipe.id} href={`/nutrition/cookbook/${recipe.id}`} className="group">
                  <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 overflow-hidden hover:bg-lapis-surface-2 hover:border-lapis-border transition-all duration-200 h-full flex flex-col">
                    {recipe.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={recipe.photo_url} alt={recipe.title} className="w-full aspect-[4/3] object-cover" />
                    ) : (
                      <div className="w-full aspect-[4/3] bg-lapis-surface-2 flex items-center justify-center">
                        <ChefHat className="w-8 h-8 text-lapis-text-disabled" />
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      <h2 className="font-display text-lg font-medium text-lapis-text-primary mb-1 truncate">{recipe.title}</h2>
                      {recipe.category && <p className="text-lapis-text-tertiary text-xs mb-2">{recipe.category}</p>}
                      {(recipe.calories != null || recipe.protein_g != null) && (
                        <p className="font-data tabular-nums text-lapis-text-secondary text-xs mt-auto pt-2">
                          {recipe.calories != null && `${recipe.calories} kcal`}
                          {recipe.calories != null && recipe.protein_g != null && ' · '}
                          {recipe.protein_g != null && `${recipe.protein_g}g protein`}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
