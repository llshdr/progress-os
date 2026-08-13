'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { LoadErrorBanner } from '@/components/ui/load-error-banner'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { useIsOwner } from '@/lib/use-is-owner'
import { ChefHat, ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

type Recipe = {
  id: string
  title: string
  ingredients: string
  instructions: string
  category: string | null
  servings: number | null
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  photo_url: string | null
}

export default function RecipeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const isOwner = useIsOwner()
  const supabase = createClient()

  useEffect(() => {
    fetchRecipe()
  }, [params.id])

  const fetchRecipe = async () => {
    const { data, error } = await supabase.from('cookbook_recipes').select('*').eq('id', params.id).maybeSingle()

    if (error) {
      console.error('Error fetching recipe:', error)
      setLoadError(true)
      setLoading(false)
      return
    }
    if (!data) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setRecipe(data)
    setLoading(false)
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('cookbook_recipes').delete().eq('id', params.id)
    if (error) {
      console.error('Error deleting recipe:', error)
      return
    }
    router.push('/nutrition/cookbook')
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageSkeleton />
        </div>
      </AppLayout>
    )
  }

  if (notFound || !recipe) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loadError && <LoadErrorBanner message="Couldn't load this recipe. Try refreshing." />}
          <p className="text-lapis-text-tertiary">Recipe not found.</p>
        </div>
      </AppLayout>
    )
  }

  const ingredientLines = recipe.ingredients.split('\n').map((l) => l.trim()).filter(Boolean)
  const instructionLines = recipe.instructions.split('\n').map((l) => l.trim()).filter(Boolean)
  const hasMacros = recipe.calories != null || recipe.protein_g != null || recipe.fat_g != null || recipe.carbs_g != null

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && <LoadErrorBanner message="Couldn't fully load this recipe. Try refreshing." />}
        <Link href="/nutrition/cookbook" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {recipe.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.photo_url}
            alt={recipe.title}
            className="w-full aspect-[16/9] object-cover rounded-lapis-lg border border-lapis-border-subtle mb-6"
          />
        ) : (
          <div className="w-full aspect-[16/9] rounded-lapis-lg border border-lapis-border-subtle bg-lapis-surface-1 flex items-center justify-center mb-6">
            <ChefHat className="w-10 h-10 text-lapis-text-disabled" />
          </div>
        )}

        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary">{recipe.title}</h1>
          {isOwner && (
            <div className="flex gap-2 shrink-0">
              <Link href={`/nutrition/cookbook/${recipe.id}/edit`}>
                <button className="flex items-center gap-2 px-3 py-2 rounded-lapis-md border border-lapis-border-subtle text-lapis-text-secondary hover:bg-lapis-surface-2 transition-colors text-sm">
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
              </Link>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lapis-md border border-lapis-border-subtle text-lapis-garnet hover:bg-lapis-surface-2 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          {recipe.category && (
            <span className="px-2.5 py-1 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-secondary border border-lapis-border-subtle">
              {recipe.category}
            </span>
          )}
          {recipe.servings != null && <span className="text-lapis-text-tertiary text-sm">Makes {recipe.servings} servings</span>}
        </div>

        {hasMacros && (
          <div className="grid grid-cols-4 gap-3 mb-8">
            {recipe.calories != null && (
              <div className="border border-lapis-border-subtle rounded-lapis-md bg-lapis-surface-1 p-3 text-center">
                <p className="font-data tabular-nums text-lapis-text-primary text-lg font-semibold">{recipe.calories}</p>
                <p className="text-lapis-text-tertiary text-xs">kcal</p>
              </div>
            )}
            {recipe.protein_g != null && (
              <div className="border border-lapis-border-subtle rounded-lapis-md bg-lapis-surface-1 p-3 text-center">
                <p className="font-data tabular-nums text-lapis-text-primary text-lg font-semibold">{recipe.protein_g}g</p>
                <p className="text-lapis-text-tertiary text-xs">protein</p>
              </div>
            )}
            {recipe.fat_g != null && (
              <div className="border border-lapis-border-subtle rounded-lapis-md bg-lapis-surface-1 p-3 text-center">
                <p className="font-data tabular-nums text-lapis-text-primary text-lg font-semibold">{recipe.fat_g}g</p>
                <p className="text-lapis-text-tertiary text-xs">fat</p>
              </div>
            )}
            {recipe.carbs_g != null && (
              <div className="border border-lapis-border-subtle rounded-lapis-md bg-lapis-surface-1 p-3 text-center">
                <p className="font-data tabular-nums text-lapis-text-primary text-lg font-semibold">{recipe.carbs_g}g</p>
                <p className="text-lapis-text-tertiary text-xs">carbs</p>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <h2 className="font-display text-lg font-medium text-lapis-text-primary mb-3">Ingredients</h2>
            <ul className="space-y-2">
              {ingredientLines.map((line, i) => (
                <li key={i} className="text-lapis-text-secondary text-sm flex gap-2">
                  <span className="text-lapis-text-disabled">•</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-lg font-medium text-lapis-text-primary mb-3">Instructions</h2>
            <ol className="space-y-3">
              {instructionLines.map((line, i) => (
                <li key={i} className="text-lapis-text-secondary text-sm flex gap-3">
                  <span className="font-data text-lapis-text-disabled shrink-0">{i + 1}.</span>
                  {line}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete this recipe?"
        description="This removes it from the cookbook for everyone. This can't be undone."
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        onConfirm={handleDelete}
      />
    </AppLayout>
  )
}
