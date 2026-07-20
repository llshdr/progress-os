export interface CaloriePoint {
  date: string // YYYY-MM-DD
  calories: number
  targetCalories: number | null // that day's effective target, if computable
}

export interface CalorieMovingAveragePoint {
  date: string
  averageCalories: number
}

const DAY_MS = 24 * 60 * 60 * 1000

// Same technique as weight-trend.ts's computeMovingAverage: one point per
// real logged day, averaging only the real entries inside its own trailing
// `windowDays` window. A day with no entry contributes zero points to any
// window — never a fabricated zero-calorie point — so gaps in logging don't
// corrupt the trend. Kept as its own module (rather than reusing
// weight-trend.ts directly) since nutrition entries are dated, not
// timestamped, and already one-per-day.
export function computeCalorieMovingAverage(points: CaloriePoint[], windowDays = 7): CalorieMovingAveragePoint[] {
  const sorted = [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return sorted.map((point) => {
    const pointTime = new Date(point.date).getTime()
    const windowStart = pointTime - (windowDays - 1) * DAY_MS

    const windowPoints = sorted.filter((p) => {
      const t = new Date(p.date).getTime()
      return t >= windowStart && t <= pointTime
    })

    const averageCalories = windowPoints.reduce((sum, p) => sum + p.calories, 0) / windowPoints.length

    return {
      date: point.date,
      averageCalories,
    }
  })
}
