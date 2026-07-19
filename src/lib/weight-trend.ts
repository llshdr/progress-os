import { getLocalDateString } from '@/lib/date'

export interface WeightPoint {
  weight: number // kg
  recordedAt: string // ISO timestamp
}

export interface MovingAveragePoint {
  date: string // YYYY-MM-DD, local calendar date of the underlying entry
  averageKg: number
}

const DAY_MS = 24 * 60 * 60 * 1000

// One moving-average point per raw entry, averaging whatever real entries fall
// within its own trailing `windowDays` window. This is what makes it resilient
// to inconsistent logging: after a multi-day gap, the window just has fewer
// points in it rather than any fabricated/interpolated data.
export function computeMovingAverage(points: WeightPoint[], windowDays = 7): MovingAveragePoint[] {
  const sorted = [...points].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  )

  return sorted.map((point) => {
    const pointTime = new Date(point.recordedAt).getTime()
    const windowStart = pointTime - (windowDays - 1) * DAY_MS

    const windowPoints = sorted.filter((p) => {
      const t = new Date(p.recordedAt).getTime()
      return t >= windowStart && t <= pointTime
    })

    const averageKg = windowPoints.reduce((sum, p) => sum + p.weight, 0) / windowPoints.length

    return {
      date: getLocalDateString(new Date(point.recordedAt)),
      averageKg,
    }
  })
}
