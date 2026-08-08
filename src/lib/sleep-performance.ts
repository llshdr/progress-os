import { getLocalDateString } from '@/lib/date'

export interface SleepPerformancePoint {
  date: string // YYYY-MM-DD
  hoursSlept: number
}

export interface NextDayWorkout {
  date: string // YYYY-MM-DD, the workout's own date
  sessionRir: number | null
}

export interface SleepBucketStats {
  nightCount: number
  nextDayWorkoutRate: number // 0-1, fraction of nights followed by a completed workout
  avgNextDaySessionRir: number | null // null when no next-day workout in this bucket ever had an RIR logged
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

function nextCalendarDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return getLocalDateString(d)
}

// Splits sleep nights into "below your own average" vs "at/above it" -
// a personal baseline, not a fixed clinical threshold (this feature
// deliberately avoids asserting what's "enough" sleep for someone it
// knows nothing else about) - and compares next-day training signals
// between the two buckets. Two honest, separate numbers per bucket
// (workout rate, avg RIR when logged), same "no fabricated composite
// score" discipline as the Training Load card on Records.
export function computeSleepPerformanceCorrelation(
  sleepEntries: SleepPerformancePoint[],
  workoutsByDate: Map<string, NextDayWorkout>
): SleepPerformanceCorrelation | null {
  if (sleepEntries.length === 0) return null

  const personalAverageHours = sleepEntries.reduce((sum, e) => sum + e.hoursSlept, 0) / sleepEntries.length

  const below = sleepEntries.filter((e) => e.hoursSlept < personalAverageHours)
  const aboveOrAt = sleepEntries.filter((e) => e.hoursSlept >= personalAverageHours)

  const bucketStats = (nights: SleepPerformancePoint[]): SleepBucketStats => {
    let workoutCount = 0
    const rirValues: number[] = []
    for (const night of nights) {
      const nextDayWorkout = workoutsByDate.get(nextCalendarDate(night.date))
      if (nextDayWorkout) {
        workoutCount++
        if (nextDayWorkout.sessionRir != null) rirValues.push(nextDayWorkout.sessionRir)
      }
    }
    return {
      nightCount: nights.length,
      nextDayWorkoutRate: nights.length > 0 ? workoutCount / nights.length : 0,
      avgNextDaySessionRir: rirValues.length > 0 ? rirValues.reduce((sum, v) => sum + v, 0) / rirValues.length : null,
    }
  }

  return {
    belowAverage: bucketStats(below),
    aboveOrAtAverage: bucketStats(aboveOrAt),
    personalAverageHours,
  }
}
