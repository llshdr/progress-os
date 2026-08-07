'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Plus, Search, Star, Archive, Trash2, Pencil, Dumbbell } from 'lucide-react'
import { ConfirmationModal } from '@/components/ui/confirmation-modal'
import { PageSkeleton } from '@/components/ui/page-skeleton'

type Exercise = {
  id: string
  name: string
  primary_muscle_group: string
  secondary_muscle_groups: string[]
  equipment_type: string
  category: string
  favorite: boolean
  archived: boolean
}

const PAGE_SIZE = 30
const SEARCH_DEBOUNCE_MS = 300

export default function ExerciseLibraryPage() {
  // Paginated browse list (used when there's no active search)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // Server-searched results (used when searchQuery is non-empty) — search
  // result sets are naturally small, so these aren't paginated further.
  const [searchResults, setSearchResults] = useState<Exercise[] | null>(null)
  const [searching, setSearching] = useState(false)

  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFavorites, setShowFavorites] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showDeleteExerciseModal, setShowDeleteExerciseModal] = useState(false)
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null)
  const supabase = createClient()
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchExercises(0, false)
  }, [])

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)

    if (!searchQuery.trim()) {
      setSearchResults(null)
      setSearching(false)
      return
    }

    setSearching(true)
    searchDebounce.current = setTimeout(() => runSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS)

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
    }
  }, [searchQuery])

  const fetchExercises = async (offset: number, append: boolean) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('exercise_library')
      .select('*')
      .eq('user_id', user.id)
      .order('favorite', { ascending: false })
      .order('name', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('Error fetching exercises:', error)
    } else {
      setExercises((prev) => (append ? [...prev, ...(data || [])] : data || []))
      setHasMore((data?.length ?? 0) === PAGE_SIZE)
    }
    setLoading(false)
    setLoadingMore(false)
  }

  // Two separate ilike queries merged client-side, rather than a single
  // .or() built via string interpolation — a search term containing a
  // comma or other PostgREST-significant character would otherwise break
  // or misbehave (see the same fix on the exercise detail page).
  const runSearch = async (query: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const pattern = `%${query}%`
    const columns = ['name', 'primary_muscle_group', 'equipment_type', 'category'] as const
    const results = await Promise.all(
      columns.map((column) =>
        supabase.from('exercise_library').select('*').eq('user_id', user.id).ilike(column, pattern).limit(200)
      )
    )

    const firstError = results.find((r) => r.error)?.error
    if (firstError) {
      console.error('Error searching exercises:', firstError)
      setSearching(false)
      return
    }

    const seen = new Set<string>()
    const merged: Exercise[] = []
    for (const result of results) {
      for (const row of (result.data || []) as Exercise[]) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        merged.push(row)
      }
    }
    merged.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    setSearchResults(merged)
    setSearching(false)
  }

  const refresh = () => {
    if (searchQuery.trim()) {
      runSearch(searchQuery.trim())
    } else {
      fetchExercises(0, false)
    }
  }

  const handleLoadMore = () => {
    setLoadingMore(true)
    fetchExercises(exercises.length, true)
  }

  const getFilteredExercises = () => {
    let filtered = searchQuery.trim() ? searchResults ?? [] : exercises

    if (showFavorites) {
      filtered = filtered.filter((exercise) => exercise.favorite)
    }
    if (!showArchived) {
      filtered = filtered.filter((exercise) => !exercise.archived)
    }

    return filtered
  }

  const toggleFavorite = async (exerciseId: string, currentFavorite: boolean) => {
    const { error } = await supabase
      .from('exercise_library')
      .update({ favorite: !currentFavorite })
      .eq('id', exerciseId)

    if (error) {
      console.error('Error toggling favorite:', error)
    } else {
      refresh()
    }
  }

  const toggleArchive = async (exerciseId: string, currentArchived: boolean) => {
    const { error } = await supabase
      .from('exercise_library')
      .update({ archived: !currentArchived })
      .eq('id', exerciseId)

    if (error) {
      console.error('Error toggling archive:', error)
    } else {
      refresh()
    }
  }

  const deleteExercise = async () => {
    if (!exerciseToDelete) return

    const exercise = [...exercises, ...(searchResults || [])].find((e) => e.id === exerciseToDelete)

    // Backfill exercise_name onto any workout history rows first, so past
    // workouts still show the real exercise name after exercise_library_id
    // is nulled out by ON DELETE SET NULL.
    if (exercise) {
      const { error: backfillError } = await supabase
        .from('exercises')
        .update({ exercise_name: exercise.name })
        .eq('exercise_library_id', exerciseToDelete)

      if (backfillError) {
        console.error('Error backfilling exercise name:', backfillError)
      }
    }

    const { error } = await supabase
      .from('exercise_library')
      .delete()
      .eq('id', exerciseToDelete)

    if (error) {
      console.error('Error deleting exercise:', error)
    } else {
      refresh()
    }
    setExerciseToDelete(null)
  }

  const openDeleteExerciseModal = (exerciseId: string) => {
    setExerciseToDelete(exerciseId)
    setShowDeleteExerciseModal(true)
  }

  const filteredExercises = getFilteredExercises()
  const showLoadMore = !searchQuery.trim() && hasMore

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/gym/library" className="text-lapis-text-tertiary hover:text-lapis-text-secondary transition-colors mb-6 block">
          ← Back
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-lapis-text-primary mb-2">
              Exercise Library
            </h1>
            <p className="text-lapis-text-tertiary text-sm">
              Manage your exercise collection
            </p>
          </div>
          <Link href="/gym/exercises/new">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-lapis-md bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110 transition-colors">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Exercise</span>
            </button>
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-8">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-lapis-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exercises..."
              className="w-full bg-lapis-surface-2 border-lapis-border-subtle text-lapis-text-primary rounded-lapis-md pl-12 pr-4 py-3 placeholder:text-lapis-text-disabled"
            />
          </div>

          {/* Filter Toggles */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lapis-sm transition-colors ${
                showFavorites
                  ? 'bg-lapis-surface-2 text-lapis-text-primary border-lapis-border-strong'
                  : 'bg-lapis-surface-2 text-lapis-text-secondary border-lapis-border-subtle'
              } border`}
            >
              <Star className={`w-4 h-4 ${showFavorites ? 'fill-lapis-gold-500 text-lapis-gold-500' : ''}`} />
              <span className="text-sm">Favorites</span>
            </button>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lapis-sm transition-colors ${
                showArchived
                  ? 'bg-lapis-surface-2 text-lapis-text-primary border-lapis-border-strong'
                  : 'bg-lapis-surface-2 text-lapis-text-secondary border-lapis-border-subtle'
              } border`}
            >
              <Archive className="w-4 h-4" />
              <span className="text-sm">Archived</span>
            </button>
          </div>
        </div>

        {/* Exercise List */}
        {loading || searching ? (
          <PageSkeleton />
        ) : filteredExercises.length === 0 ? (
          <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-12 text-center">
            <Dumbbell className="w-10 h-10 text-lapis-text-disabled mx-auto mb-4" />
            <p className="text-lapis-text-tertiary mb-4">
              {searchQuery ? 'No exercises found' : 'No exercises yet'}
            </p>
            {!searchQuery && (
              <Link href="/gym/exercises/new">
                <button className="px-4 py-2 rounded-lapis-sm border border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 transition-colors">
                  Add your first exercise
                </button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              {filteredExercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 hover:bg-lapis-surface-2 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link href={`/gym/exercises/${exercise.id}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-medium text-lapis-text-primary hover:text-lapis-text-secondary transition-colors truncate">
                            {exercise.name}
                          </h3>
                          {exercise.favorite && (
                            <Star className="w-4 h-4 fill-lapis-gold-500 text-lapis-gold-500 shrink-0" />
                          )}
                          {exercise.archived && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle shrink-0">
                              Archived
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-lapis-text-tertiary text-sm">
                          <span>{exercise.primary_muscle_group}</span>
                          <span>•</span>
                          <span>{exercise.equipment_type}</span>
                          <span>•</span>
                          <span>{exercise.category}</span>
                        </div>
                      </Link>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/gym/exercises/${exercise.id}/edit`}
                        className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                      >
                        <Pencil className="w-5 h-5 text-lapis-text-tertiary" />
                      </Link>
                      <button
                        onClick={() => toggleFavorite(exercise.id, exercise.favorite)}
                        className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                      >
                        <Star className={`w-5 h-5 ${exercise.favorite ? 'fill-lapis-gold-500 text-lapis-gold-500' : 'text-lapis-text-tertiary'}`} />
                      </button>
                      <button
                        onClick={() => toggleArchive(exercise.id, exercise.archived)}
                        className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                      >
                        <Archive className="w-5 h-5 text-lapis-text-tertiary" />
                      </button>
                      <button
                        onClick={() => openDeleteExerciseModal(exercise.id)}
                        className="p-2 rounded-lapis-sm hover:bg-lapis-surface-2 transition-colors"
                      >
                        <Trash2 className="w-5 h-5 text-lapis-text-tertiary" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {showLoadMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 rounded-lapis-md border border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Exercise Confirmation Modal */}
      <ConfirmationModal
        open={showDeleteExerciseModal}
        onOpenChange={setShowDeleteExerciseModal}
        title="Delete Exercise"
        description="This permanently removes the exercise from your library and cannot be undone. If you just want to stop seeing it without losing it, use Archive instead — it's reversible and keeps the exercise available."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={deleteExercise}
        destructive
      />
    </AppLayout>
  )
}
