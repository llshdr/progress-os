export interface RecommendationResult {
  status: 'ok' | 'not_enough_history' | 'error'
  weight?: number
  reps?: number
  reasoning?: string
}

interface RecommendationParams {
  exerciseLibraryId?: string | null
  exerciseName?: string | null
  // The equipment variant currently selected for this session, if the
  // exercise has any defined. Included in the cache key below so switching
  // variants mid-session never reuses a different variant's cached answer.
  variantLabel?: string | null
}

// In-memory, per-browser-session cache (resets on page reload). Shared by the
// exercise detail card and the live-logging suggestion so both surfaces hit
// the API at most once per exercise (and selected variant) per session, and
// dedupe concurrent calls.
const cache = new Map<string, Promise<RecommendationResult>>()

export function getExerciseRecommendation(params: RecommendationParams): Promise<RecommendationResult> {
  const exerciseLibraryId = params.exerciseLibraryId ?? null
  const exerciseName = params.exerciseName ?? null
  const variantLabel = params.variantLabel ?? null
  const baseKey = exerciseLibraryId || exerciseName

  if (!baseKey) {
    return Promise.resolve({ status: 'error' })
  }
  const key = `${baseKey}::${variantLabel ?? ''}`

  const cached = cache.get(key)
  if (cached) return cached

  const promise = fetch('/api/ai-coach/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exerciseLibraryId, exerciseName, variantLabel }),
  })
    .then(async (res) => {
      if (!res.ok) return { status: 'error' as const }
      return (await res.json()) as RecommendationResult
    })
    .catch(() => ({ status: 'error' as const }))

  cache.set(key, promise)
  return promise
}
