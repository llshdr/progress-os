'use client'

import { useMemo, useRef, useState } from 'react'

export interface CardioSessionPoint {
  date: string // YYYY-MM-DD
  distanceKm: number
  paceSecondsPerKm: number // durationSeconds / distanceKm
}

type Metric = 'pace' | 'distance'

const WIDTH = 600
const HEIGHT = 220
const PADDING = { top: 16, right: 12, bottom: 16, left: 12 }

function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`
}

// Same custom-SVG technique as ExerciseProgressChart (viewBox scaling,
// muted markers + bold line, hover crosshair) - cardio exercises have no
// equipment-variant concept the way strength ones do, so this stays a
// single line, no bucket segmentation needed. Pace is plotted in raw
// seconds/km, not inverted - "lower on the chart = faster" is called out
// in the caption rather than flipping the y-axis, since an inverted axis
// reads as a bug at a glance more often than it reads as intentional.
export default function CardioProgressChart({ sessions }: { sessions: CardioSessionPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [metric, setMetric] = useState<Metric>('pace')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [sessions]
  )

  const values = sorted.map((s) => (metric === 'pace' ? s.paceSecondsPerKm : s.distanceKm))

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

  const path = sorted.map((_, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i)} ${yForValue(values[i])}`).join(' ')

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

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMetric('pace')}
            className={`px-3 py-1.5 rounded-lapis-sm text-xs font-medium transition-colors ${
              metric === 'pace' ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
            }`}
          >
            Pace
          </button>
          <button
            type="button"
            onClick={() => setMetric('distance')}
            className={`px-3 py-1.5 rounded-lapis-sm text-xs font-medium transition-colors ${
              metric === 'distance' ? 'bg-lapis-accent-500 text-lapis-text-primary' : 'bg-lapis-surface-2 text-lapis-text-secondary hover:bg-lapis-surface-2'
            }`}
          >
            Distance
          </button>
        </div>
        {metric === 'pace' && <span className="text-lapis-text-disabled text-xs">Lower = faster</span>}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {sorted.map((_, i) => (
          <circle key={`pt-${i}`} cx={xForIndex(i)} cy={yForValue(values[i])} r={3} fill="var(--color-lapis-text-secondary)" fillOpacity={0.4} />
        ))}

        {sorted.length > 1 && (
          <path d={path} fill="none" stroke="var(--color-lapis-accent-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        )}

        {hoverIndex != null && (
          <>
            <line
              x1={xForIndex(hoverIndex)}
              x2={xForIndex(hoverIndex)}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke="var(--color-lapis-border)"
              strokeWidth={1}
            />
            <circle
              cx={xForIndex(hoverIndex)}
              cy={yForValue(values[hoverIndex])}
              r={4.5}
              fill="var(--color-lapis-bg)"
              stroke="var(--color-lapis-accent-400)"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      <div className="h-6 mt-2 text-sm text-lapis-text-secondary">
        {hoverIndex != null && sorted[hoverIndex] && (
          <>
            {formatDate(sorted[hoverIndex].date)} — {metric === 'pace' ? formatPace(values[hoverIndex]) : `${values[hoverIndex].toFixed(1)} km`}
          </>
        )}
      </div>
    </div>
  )
}
