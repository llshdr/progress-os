// Canonical human duration formatter - replaces what used to be
// independently reimplemented (and inconsistently precise) across gym,
// cardio, and race-plan surfaces. 'second' precision is the default since
// most callers (race times, cardio logs, PR efforts) care about exact
// times; gym workout-session displays pass 'minute' to keep their existing
// coarser, second-free display.
export function formatDuration(totalSeconds: number, options?: { precision?: 'minute' | 'second' }): string {
  const precision = options?.precision ?? 'second'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (precision === 'minute') {
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const seconds = Math.floor(totalSeconds % 60)
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  return seconds === 0 ? `${minutes} min` : `${minutes}m ${seconds}s`
}
