export interface SleepPoint {
  hoursSlept: number
  date: string // YYYY-MM-DD
}

export interface SleepMovingAveragePoint {
  date: string // YYYY-MM-DD
  averageHours: number
}

const DAY_MS = 24 * 60 * 60 * 1000

// Same shape as weight-trend.ts's computeMovingAverage - one point per raw
// entry, averaging whatever real entries fall within its own trailing
// windowDays window, so a gap in logging just means fewer points in that
// window rather than any fabricated/interpolated night. Date-keyed rather
// than timestamp-keyed since sleep_entries is one row per calendar date
// (UNIQUE(user_id, date)), unlike weight's multiple-per-day timestamps.
export function computeSleepMovingAverage(points: SleepPoint[], windowDays = 7): SleepMovingAveragePoint[] {
  const sorted = [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return sorted.map((point) => {
    const pointTime = new Date(point.date).getTime()
    const windowStart = pointTime - (windowDays - 1) * DAY_MS

    const windowPoints = sorted.filter((p) => {
      const t = new Date(p.date).getTime()
      return t >= windowStart && t <= pointTime
    })

    const averageHours = windowPoints.reduce((sum, p) => sum + p.hoursSlept, 0) / windowPoints.length

    return { date: point.date, averageHours }
  })
}
