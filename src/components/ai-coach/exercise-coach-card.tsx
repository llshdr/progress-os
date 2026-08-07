'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getExerciseRecommendation, RecommendationResult } from '@/lib/ai-coach/client'

interface ExerciseCoachCardProps {
  exerciseLibraryId?: string | null
  exerciseName?: string | null
}

export default function ExerciseCoachCard({ exerciseLibraryId, exerciseName }: ExerciseCoachCardProps) {
  const [result, setResult] = useState<RecommendationResult | null>(null)
  const [loading, setLoading] = useState(true)
  // Optimistic default while the saved setting loads, corrected below.
  const [includeNutrition, setIncludeNutrition] = useState(true)
  const supabase = createClient()

  // Saved default for the nutrition toggle - fetched once.
  useEffect(() => {
    supabase
      .from('user_settings')
      .select('ai_coach_include_nutrition')
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) setIncludeNutrition(data.ai_coach_include_nutrition ?? true)
      })
  }, [])

  // Flipping it also persists as the new default for next time, same
  // precedent as other AI Coach/training settings already saving immediately.
  const handleToggleNutrition = async () => {
    const next = !includeNutrition
    setIncludeNutrition(next)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('user_settings')
      .update({ ai_coach_include_nutrition: next })
      .eq('user_id', user.id)

    if (error) {
      console.error('Error saving nutrition toggle:', error)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getExerciseRecommendation({ exerciseLibraryId, exerciseName, includeNutrition }).then((res) => {
      if (cancelled) return
      setResult(res)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [exerciseLibraryId, exerciseName, includeNutrition])

  return (
    <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-lapis-text-tertiary" />
        <h2 className="text-lg font-medium text-lapis-text-primary">AI Coach</h2>
      </div>

      {loading && <p className="text-lapis-text-tertiary text-sm">Analyzing your recent sets...</p>}

      {!loading && result?.status === 'not_enough_history' && (
        <p className="text-lapis-text-tertiary text-sm">
          Log a couple more sessions of this exercise and I&apos;ll suggest your next weight and reps.
        </p>
      )}

      {!loading && result?.status === 'error' && (
        <p className="text-lapis-text-tertiary text-sm">Couldn&apos;t generate a recommendation right now. Try again later.</p>
      )}

      {!loading && result?.status === 'ok' && (
        <div>
          <p className="text-2xl font-semibold text-lapis-text-primary mb-1">
            {result.weight} kg × {result.reps}
          </p>
          {result.reasoning && <p className="text-lapis-text-tertiary text-sm">{result.reasoning}</p>}
        </div>
      )}

      {!loading && (result?.status === 'ok' || result?.status === 'not_enough_history') && (
        <button
          type="button"
          onClick={handleToggleNutrition}
          className="mt-3 px-2.5 py-1 rounded-full text-xs bg-lapis-surface-2 text-lapis-text-tertiary border border-lapis-border-subtle hover:bg-lapis-surface-2 hover:text-lapis-text-secondary transition-colors"
        >
          Nutrition {includeNutrition ? 'factored in' : 'not factored in'}
        </button>
      )}
    </div>
  )
}
