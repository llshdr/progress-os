'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { getExerciseRecommendation, RecommendationResult } from '@/lib/ai-coach/client'

interface ExerciseCoachCardProps {
  exerciseLibraryId?: string | null
  exerciseName?: string | null
}

export default function ExerciseCoachCard({ exerciseLibraryId, exerciseName }: ExerciseCoachCardProps) {
  const [result, setResult] = useState<RecommendationResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getExerciseRecommendation({ exerciseLibraryId, exerciseName }).then((res) => {
      if (cancelled) return
      setResult(res)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [exerciseLibraryId, exerciseName])

  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-white/40" />
        <h2 className="text-lg font-medium text-white">AI Coach</h2>
      </div>

      {loading && <p className="text-white/40 text-sm">Analyzing your recent sets...</p>}

      {!loading && result?.status === 'not_enough_history' && (
        <p className="text-white/40 text-sm">
          Log a couple more sessions of this exercise and I&apos;ll suggest your next weight and reps.
        </p>
      )}

      {!loading && result?.status === 'error' && (
        <p className="text-white/40 text-sm">Couldn&apos;t generate a recommendation right now. Try again later.</p>
      )}

      {!loading && result?.status === 'ok' && (
        <div>
          <p className="text-2xl font-semibold text-white mb-1">
            {result.weight} kg × {result.reps}
          </p>
          {result.reasoning && <p className="text-white/50 text-sm">{result.reasoning}</p>}
        </div>
      )}
    </div>
  )
}
