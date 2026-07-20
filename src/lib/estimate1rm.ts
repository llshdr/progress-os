// Epley formula: weight × (1 + reps/30). Shared so the exercise detail page
// and the Personal Records page can't quietly compute this differently.
export function estimateOneRepMax(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}
