'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/components/app-layout'
import Link from 'next/link'
import { Plus, Search, Star, Archive, Trash2 } from 'lucide-react'

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

export default function ExerciseLibraryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFavorites, setShowFavorites] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchExercises()
  }, [])

  useEffect(() => {
    filterExercises()
  }, [exercises, searchQuery, showFavorites, showArchived])

  const fetchExercises = async () => {
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

    if (error) {
      console.error('Error fetching exercises:', error)
    } else {
      setExercises(data || [])
    }
    setLoading(false)
  }

  const filterExercises = () => {
    let filtered = exercises

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(exercise =>
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exercise.primary_muscle_group.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by favorites
    if (showFavorites) {
      filtered = filtered.filter(exercise => exercise.favorite)
    }

    // Filter by archived
    if (!showArchived) {
      filtered = filtered.filter(exercise => !exercise.archived)
    }

    setFilteredExercises(filtered)
  }

  const toggleFavorite = async (exerciseId: string, currentFavorite: boolean) => {
    const { error } = await supabase
      .from('exercise_library')
      .update({ favorite: !currentFavorite })
      .eq('id', exerciseId)

    if (error) {
      console.error('Error toggling favorite:', error)
    } else {
      fetchExercises()
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
      fetchExercises()
    }
  }

  const deleteExercise = async (exerciseId: string) => {
    if (!confirm('Permanently delete this exercise? This cannot be undone.')) return

    const { error } = await supabase
      .from('exercise_library')
      .delete()
      .eq('id', exerciseId)

    if (error) {
      console.error('Error deleting exercise:', error)
      alert('Failed to delete exercise')
    } else {
      fetchExercises()
    }
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
              Exercise Library
            </h1>
            <p className="text-white/50 text-sm">
              Manage your exercise collection
            </p>
          </div>
          <Link href="/gym/exercises/new">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 transition-colors">
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Exercise</span>
            </button>
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-8">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exercises..."
              className="w-full bg-white/5 border-white/10 text-white rounded-xl pl-12 pr-4 py-3 placeholder:text-white/30"
            />
          </div>

          {/* Filter Toggles */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showFavorites
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-white/5 text-white/60 border-white/10'
              } border`}
            >
              <Star className={`w-4 h-4 ${showFavorites ? 'fill-white' : ''}`} />
              <span className="text-sm">Favorites</span>
            </button>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showArchived
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-white/5 text-white/60 border-white/10'
              } border`}
            >
              <Archive className="w-4 h-4" />
              <span className="text-sm">Archived</span>
            </button>
          </div>
        </div>

        {/* Exercise List */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-white/40">Loading...</div>
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-12 text-center">
            <p className="text-white/40 mb-4">
              {searchQuery ? 'No exercises found' : 'No exercises yet'}
            </p>
            {!searchQuery && (
              <Link href="/gym/exercises/new">
                <button className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors">
                  Add your first exercise
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredExercises.map((exercise) => (
              <div
                key={exercise.id}
                className="border border-white/10 rounded-2xl bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-medium text-white">
                        {exercise.name}
                      </h3>
                      {exercise.favorite && (
                        <Star className="w-4 h-4 fill-white text-white" />
                      )}
                      {exercise.archived && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-white/40 border border-white/10">
                          Archived
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-white/40 text-sm">
                      <span>{exercise.primary_muscle_group}</span>
                      <span>•</span>
                      <span>{exercise.equipment_type}</span>
                      <span>•</span>
                      <span>{exercise.category}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleFavorite(exercise.id, exercise.favorite)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <Star className={`w-5 h-5 ${exercise.favorite ? 'fill-white text-white' : 'text-white/40'}`} />
                    </button>
                    <button
                      onClick={() => toggleArchive(exercise.id, exercise.archived)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <Archive className="w-5 h-5 text-white/40" />
                    </button>
                    <button
                      onClick={() => deleteExercise(exercise.id)}
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
    </AppLayout>
  )
}
