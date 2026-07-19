'use client'

import { useMemo, useRef, useState } from 'react'

export interface ExerciseSessionPoint {
  date: string // YYYY-MM-DD
  topWeight: number // kg
  volume: number // kg (weight × reps, summed across the session)
}

type Metric = 'weight' | 'volume'

const WIDTH = 600
const HEIGHT = 220
const PADDING = { top: 16, right: 12, bottom: 16, left: 12 }

// Reuses the same custom-SVG technique as the weight-tracking chart (viewBox
// scaling, muted markers + bold line, hover crosshair) — but not its 7-day
// moving average. Sessions for one exercise are sparse and irregular, unlike
// daily weigh-ins, so each point here is a real per-session value rather than
// a smoothed trend.
export default function ExerciseProgressChart({ sessions }: { sessions: ExerciseSessionPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [metric, setMetric] = useState<Metric>('weight')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [sessions]
  )

  const values = sorted.map((s) => (metric === 'weight' ? s.topWeight : s.volume))

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const valueRange = maxValue - minValue || 1
  const yPad = valueRange * 0.15

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const xForIndex = (i: number) =>
    sorted.length <= 1 ? PADDING.left + plotWidth / 2 : PADDING.left + (i / (sorted.length - 1)) * plotWidth

  const yForValue = (v: number) =>
    PADDING.top + plotHeight - ((v - (minValue - yPad)) / (valueRange + yPad * 2)) * plotHeight

  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i)} ${yForValue(v)}`).join(' ')

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || sorted.length === 0) return

    const rect = svg.getBoundingClientRect()
    const relativeX = ((e.clientX - rect.left) / rect.width) * WIDTH

    let closest = 0
    let closestDist = Infinity
    for (let i = 0; i < sorted.length; i++) {
      const dist = Math.abs(xForIndex(i) - relativeX)
      if (dist < closestDist) {
        closestDist = dist
        closest = i
      }
    }
    setHoverIndex(closest)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const unitLabel = metric === 'weight' ? 'kg' : 'kg vol'

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMetric('weight')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            metric === 'weight' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          Top Set Weight
        </button>
        <button
          type="button"
          onClick={() => setMetric('volume')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            metric === 'volume' ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          Volume
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {sorted.map((_, i) => (
          <circle key={`pt-${i}`} cx={xForIndex(i)} cy={yForValue(values[i])} r={3} fill="rgba(255,255,255,0.4)" />
        ))}

        {values.length > 1 && (
          <path d={linePath} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        )}

        {hoverIndex != null && (
          <>
            <line
              x1={xForIndex(hoverIndex)}
              x2={xForIndex(hoverIndex)}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
            />
            <circle cx={xForIndex(hoverIndex)} cy={yForValue(values[hoverIndex])} r={4.5} fill="white" />
          </>
        )}
      </svg>

      <div className="h-6 mt-2 text-sm text-white/70">
        {hoverIndex != null && sorted[hoverIndex] && (
          <>
            {formatDate(sorted[hoverIndex].date)} — {values[hoverIndex].toFixed(metric === 'weight' ? 1 : 0)}{' '}
            {unitLabel}
          </>
        )}
      </div>
    </div>
  )
}
