export interface SleepPerformancePoint {
  date: string // YYYY-MM-DD
  hoursSlept: number
}

export interface SameDayWorkout {
  date: string // YYYY-MM-DD, the workout's own date
  // Average of that day's per-set RIR values (migration 075) - RIR moved
  // from a single session-level self-rating to per-set, so this is now a
  // derived per-workout figure the caller computes from real logged sets,
  // not a self-rated number. Still one value per workout-day here - this
  // feature's own granularity is "did that day's training feel harder,"
  // which a per-workout average answers without needing set-level detail.
  avgRir: number | null
}

export interface SleepBucketStats {
  nightCount: number
  sameDayWorkoutRate: number // 0-1, fraction of nights whose own date also has a completed workout
  avgSameDayRir: number | null // null when no same-day workout in this bucket ever had an RIR logged
}

export interface SleepPerformanceCorrelation {
  belowAverage: SleepBucketStats
  aboveOrAtAverage: SleepBucketStats
  personalAverageHours: number
}

// Minimum nights per bucket before showing this at all - below this, a
// "correlation" is just noise dressed up as a finding. Chosen the same
// way this feature's other honesty thresholds are (a round, defensible
// floor, not independently derived).
export const MIN_NIGHTS_PER_BUCKET = 3

// Splits sleep nights into "below your own average" vs "at/above it" -
// a personal baseline, not a fixed clinical threshold (this feature
// deliberately avoids asserting what's "enough" sleep for someone it
// knows nothing else about) - and compares same-day training signals
// between the two buckets. Two honest, separate numbers per bucket
// (workout rate, avg RIR when logged), same "no fabricated composite
// score" discipline as the Training Load card on Records.
//
// Deliberately same-day, not next-day: a sleep entry's own `date` is set
// by the log form defaulting to "today" (getLocalDateString(), see
// gym/sleep/page.tsx), logged the morning after the night it describes -
// so `date` already represents the morning that night's sleep fed into,
// and same-day training is the correct thing to correlate it against.
// Checking date+1 here previously matched the wrong day entirely.
export function computeSleepPerformanceCorrelation(
  sleepEntries: SleepPerformancePoint[],
  workoutsByDate: Map<string, SameDayWorkout>
): SleepPerformanceCorrelation | null {
  if (sleepEntries.length === 0) return null

  const personalAverageHours = sleepEntries.reduce((sum, e) => sum + e.hoursSlept, 0) / sleepEntries.length

  const below = sleepEntries.filter((e) => e.hoursSlept < personalAverageHours)
  const aboveOrAt = sleepEntries.filter((e) => e.hoursSlept >= personalAverageHours)

  const bucketStats = (nights: SleepPerformancePoint[]): SleepBucketStats => {
    let workoutCount = 0
    const rirValues: number[] = []
    for (const night of nights) {
      const sameDayWorkout = workoutsByDate.get(night.date)
      if (sameDayWorkout) {
        workoutCount++
        if (sameDayWorkout.avgRir != null) rirValues.push(sameDayWorkout.avgRir)
      }
    }
    return {
      nightCount: nights.length,
      sameDayWorkoutRate: nights.length > 0 ? workoutCount / nights.length : 0,
      avgSameDayRir: rirValues.length > 0 ? rirValues.reduce((sum, v) => sum + v, 0) / rirValues.length : null,
    }
  }

  return {
    belowAverage: bucketStats(below),
    aboveOrAtAverage: bucketStats(aboveOrAt),
    personalAverageHours,
  }
}
