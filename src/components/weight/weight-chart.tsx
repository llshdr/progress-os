'use client'

import { useMemo, useRef, useState } from 'react'
import { computeMovingAverage } from '@/lib/weight-trend'
import { kgToDisplay, type WeightUnit } from '@/lib/weight'

interface WeightChartProps {
  // weight in kg — conversion for display happens inside this component
  entries: { weight: number; recordedAt: string }[]
  unit: WeightUnit
  goalWeightKg?: number | null
}

const WIDTH = 600
const HEIGHT = 220
const PADDING = { top: 16, right: 12, bottom: 16, left: 12 }

// Assumes at least 2 entries — the weight page only renders this once there's
// enough data for a trend to mean anything.
export default function WeightChart({ entries, unit, goalWeightKg }: WeightChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()),
    [entries]
  )

  const movingAverage = useMemo(() => computeMovingAverage(sorted), [sorted])

  const displayRaw = sorted.map((e) => kgToDisplay(e.weight, unit))
  const displayAvg = movingAverage.map((p) => kgToDisplay(p.averageKg, unit))
  const goalDisplay = goalWeightKg != null ? kgToDisplay(goalWeightKg, unit) : null

  const allValues = [...displayRaw, ...displayAvg, ...(goalDisplay != null ? [goalDisplay] : [])]
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

  const linePath = displayAvg.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i)} ${yForValue(v)}`).join(' ')

  const goalY = goalDisplay != null ? yForValue(goalDisplay) : null

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
        {goalY != null && (
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={goalY}
            y2={goalY}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        {sorted.map((_, i) => (
          <circle key={`raw-${i}`} cx={xForIndex(i)} cy={yForValue(displayRaw[i])} r={2.5} fill="rgba(255,255,255,0.25)" />
        ))}

        {displayAvg.length > 1 && (
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
            <circle cx={xForIndex(hoverIndex)} cy={yForValue(displayAvg[hoverIndex])} r={4} fill="white" />
          </>
        )}
      </svg>

      <div className="h-6 mt-2 text-sm text-white/70">
        {hoverIndex != null && sorted[hoverIndex] && (
          <>
            {formatDate(sorted[hoverIndex].recordedAt)} — trend {displayAvg[hoverIndex].toFixed(1)} {unit}
            <span className="text-white/40"> (raw: {displayRaw[hoverIndex].toFixed(1)} {unit})</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-white/25" /> Raw weigh-ins
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-white" /> 7-day trend
        </span>
        {goalDisplay != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 border-t border-dashed border-white/40" /> Goal
          </span>
        )}
      </div>
    </div>
  )
}
