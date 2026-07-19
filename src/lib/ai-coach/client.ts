export interface RecommendationResult {
  status: 'ok' | 'not_enough_history' | 'error'
  weight?: number
  reps?: number
  reasoning?: string
}

interface RecommendationParams {
  exerciseLibraryId?: string | null
  exerciseName?: string | null
}

// In-memory, per-browser-session cache (resets on page reload). Shared by the
// exercise detail card and the live-logging suggestion so both surfaces hit
// the API at most once per exercise per session, and dedupe concurrent calls.
const cache = new Map<string, Promise<RecommendationResult>>()

export function getExerciseRecommendation(params: RecommendationParams): Promise<RecommendationResult> {
  const exerciseLibraryId = params.exerciseLibraryId ?? null
  const exerciseName = params.exerciseName ?? null
  const key = exerciseLibraryId || exerciseName

  if (!key) {
    return Promise.resolve({ status: 'error' })
  }

  const cached = cache.get(key)
  if (cached) return cached

  const promise = fetch('/api/ai-coach/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exerciseLibraryId, exerciseName }),
  })
    .then(async (res) => {
      if (!res.ok) return { status: 'error' as const }
      return (await res.json()) as RecommendationResult
    })
    .catch(() => ({ status: 'error' as const }))

  cache.set(key, promise)
  return promise
}
