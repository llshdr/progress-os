'use client'

import { useMemo, useRef, useState } from 'react'

export interface ExerciseSessionPoint {
  date: string // YYYY-MM-DD
  topWeight: number // kg
  volume: number // kg (weight × reps, summed across the session)
  // Equipment variant used this session, if the exercise has any defined and
  // one was picked. Sessions with no variant info (the common case) all fall
  // into the same `null` bucket below, so nothing changes visually unless a
  // real mix of variants shows up in the data.
  variantLabel?: string | null
}

type Metric = 'weight' | 'volume'

const WIDTH = 600
const HEIGHT = 220
const PADDING = { top: 16, right: 12, bottom: 16, left: 12 }

// Differentiate multiple variant lines by stroke style, not color — this
// chart (and the app generally) is monochrome, and realistically there are
// only ever 2-3 variants for one exercise, so dash patterns are enough.
const LINE_STYLES: { dasharray?: string; legendClass: string }[] = [
  { dasharray: undefined, legendClass: 'border-t-2 border-solid border-white' },
  { dasharray: '6 4', legendClass: 'border-t-2 border-dashed border-white/70' },
  { dasharray: '2 3', legendClass: 'border-t-2 border-dotted border-white/70' },
]

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

  // Only segment into multiple lines when the data actually contains a real
  // mix — the overwhelmingly common single-bucket case renders exactly as
  // before, one solid line, no legend.
  const bucketKeys = useMemo(() => {
    const keys = new Set(sorted.map((s) => s.variantLabel ?? null))
    return Array.from(keys)
  }, [sorted])
  const segmented = bucketKeys.length > 1

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

  // One path per bucket, connecting only that bucket's own points (in their
  // chronological subsequence of the shared x-axis) — so a session on a
  // different variant never gets silently connected into the same trend line.
  const bucketPaths = bucketKeys.map((key) => {
    const indices = sorted
      .map((_, i) => i)
      .filter((i) => (sorted[i].variantLabel ?? null) === key)

    const path = indices.map((i, j) => `${j === 0 ? 'M' : 'L'} ${xForIndex(i)} ${yForValue(values[i])}`).join(' ')

    return { key, indices, path }
  })

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

        {bucketPaths.map(({ key, indices, path }, bucketIndex) =>
          indices.length > 1 ? (
            <path
              key={key ?? '__none__'}
              d={path}
              fill="none"
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={LINE_STYLES[bucketIndex % LINE_STYLES.length].dasharray}
            />
          ) : null
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
            {segmented && (
              <span className="text-white/40"> · {sorted[hoverIndex].variantLabel ?? 'No variant'}</span>
            )}
          </>
        )}
      </div>

      {segmented && (
        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-white/40">
          {bucketPaths.map(({ key }, bucketIndex) => (
            <span key={key ?? '__none__'} className="flex items-center gap-1.5">
              <span className={`inline-block w-4 ${LINE_STYLES[bucketIndex % LINE_STYLES.length].legendClass}`} />
              {key ?? 'No variant'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
