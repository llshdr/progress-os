'use client'

import { useMemo, useRef, useState } from 'react'
import { computeSleepMovingAverage } from '@/lib/sleep-trend'

interface SleepChartProps {
  entries: { hoursSlept: number; date: string }[]
}

const WIDTH = 600
const HEIGHT = 220
const PADDING = { top: 16, right: 12, bottom: 16, left: 12 }

// Same SVG structure as WeightChart (raw points + 7-day moving-average
// line) - hours has no single-number "goal" the way weight does, so
// there's no dashed reference line here; the recommended-range comparison
// lives entirely in the text insight (see SleepInsightCard), not the
// graph. Assumes at least 2 entries, same precondition as WeightChart.
export default function SleepChart({ entries }: SleepChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const sorted = useMemo(() => [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [entries])

  const movingAverage = useMemo(() => computeSleepMovingAverage(sorted), [sorted])

  const rawValues = sorted.map((e) => e.hoursSlept)
  const avgValues = movingAverage.map((p) => p.averageHours)

  const allValues = [...rawValues, ...avgValues]
  const minValue = Math.min(...allValues)
  const maxValue = Math.max(...allValues)
  const valueRange = maxValue - minValue || 1
  const yPad = valueRange * 0.15

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const xForIndex = (i: number) =>
    sorted.length <= 1 ? PADDING.left + plotWidth / 2 : PADDING.left + (i / (sorted.length - 1)) * plotWidth

  const yForValue = (v: number) =>
    PADDING.top + plotHeight - ((v - (minValue - yPad)) / (valueRange + yPad * 2)) * plotHeight

  const linePath = avgValues.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i)} ${yForValue(v)}`).join(' ')

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

  const formatDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {sorted.map((_, i) => (
          <circle key={`raw-${i}`} cx={xForIndex(i)} cy={yForValue(rawValues[i])} r={2.5} fill="var(--color-lapis-text-secondary)" fillOpacity={0.4} />
        ))}

        {avgValues.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-lapis-accent-500)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
              cy={yForValue(avgValues[hoverIndex])}
              r={4}
              fill="var(--color-lapis-bg)"
              stroke="var(--color-lapis-accent-400)"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      <div className="font-data h-6 mt-2 text-sm tabular-nums text-lapis-text-secondary">
        {hoverIndex != null && sorted[hoverIndex] && (
          <>
            {formatDate(sorted[hoverIndex].date)} — trend {avgValues[hoverIndex].toFixed(1)}h
            <span className="text-lapis-text-tertiary"> (raw: {rawValues[hoverIndex].toFixed(1)}h)</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-lapis-text-tertiary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-lapis-text-secondary/40" /> Raw nights
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-lapis-accent-500" /> 7-day trend
        </span>
      </div>
    </div>
  )
}
