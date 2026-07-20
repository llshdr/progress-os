'use client'

import { useMemo, useRef, useState } from 'react'
import { computeCalorieMovingAverage, type CaloriePoint } from '@/lib/nutrition-trend'

const WIDTH = 600
const HEIGHT = 220
const PADDING = { top: 16, right: 12, bottom: 16, left: 12 }

// Reuses the same custom-SVG technique as the weight-tracking chart (viewBox
// scaling, muted markers + bold line, hover crosshair) — plus a second,
// thinner line for the day's own effective target, since (unlike weight's
// flat goal) the nutrition target can vary day to day with logged activity.
export default function NutritionChart({ points }: { points: CaloriePoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const sorted = useMemo(
    () => [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [points]
  )

  const movingAverage = useMemo(() => computeCalorieMovingAverage(sorted), [sorted])

  const rawValues = sorted.map((p) => p.calories)
  const avgValues = movingAverage.map((p) => p.averageCalories)
  const hasTargets = sorted.some((p) => p.targetCalories != null)
  const targetValues = sorted.map((p) => p.targetCalories)

  const allValues = [
    ...rawValues,
    ...avgValues,
    ...targetValues.filter((v): v is number => v != null),
  ]
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

  const avgPath = avgValues.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i)} ${yForValue(v)}`).join(' ')

  // Target can be null for a given day (no maintenance_calories set yet at
  // that point) — break the line rather than drawing through a gap.
  const targetSegments: string[] = []
  let currentSegment: string[] = []
  targetValues.forEach((v, i) => {
    if (v == null) {
      if (currentSegment.length > 1) targetSegments.push(currentSegment.join(' '))
      currentSegment = []
      return
    }
    currentSegment.push(`${currentSegment.length === 0 ? 'M' : 'L'} ${xForIndex(i)} ${yForValue(v)}`)
  })
  if (currentSegment.length > 1) targetSegments.push(currentSegment.join(' '))

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

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {hasTargets &&
          targetSegments.map((d, i) => (
            <path
              key={`target-${i}`}
              d={d}
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1.5}
              strokeDasharray="2 3"
            />
          ))}

        {sorted.map((_, i) => (
          <circle key={`raw-${i}`} cx={xForIndex(i)} cy={yForValue(rawValues[i])} r={2.5} fill="rgba(255,255,255,0.25)" />
        ))}

        {avgValues.length > 1 && (
          <path d={avgPath} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
            <circle cx={xForIndex(hoverIndex)} cy={yForValue(avgValues[hoverIndex])} r={4} fill="white" />
          </>
        )}
      </svg>

      <div className="h-6 mt-2 text-sm text-white/70">
        {hoverIndex != null && sorted[hoverIndex] && (
          <>
            {formatDate(sorted[hoverIndex].date)} — trend {Math.round(avgValues[hoverIndex])} kcal
            <span className="text-white/40"> (logged: {rawValues[hoverIndex]} kcal)</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-white/25" /> Logged days
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-white" /> 7-day trend
        </span>
        {hasTargets && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 border-t border-dashed border-white/40" /> Target
          </span>
        )}
      </div>
    </div>
  )
}
