'use client'

import { useMemo, useRef, useState } from 'react'

export interface RankHistoryPoint {
  rank: number
  recordedAt: string
}

const WIDTH = 300
const HEIGHT = 64
const PADDING = { top: 10, right: 8, bottom: 10, left: 8 }

// A step chart, not a smooth line - rank is a whole-number tier that
// jumps (1 through 5), never a continuous value in between, so a
// straight-line interpolation between two tiers would visually imply a
// "3.4" that was never real. Compact by design (this is a small trend
// indicator, not a daily-tracking chart like weight/sleep) - one row
// only ever gets written per genuine tier change (see migration 071),
// so points are naturally sparse.
export default function RankSparkline({ history }: { history: RankHistoryPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const sorted = useMemo(
    () => [...history].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()),
    [history]
  )

  const minRank = 1
  const maxRank = 5
  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom

  const xForIndex = (i: number) =>
    sorted.length <= 1 ? PADDING.left + plotWidth / 2 : PADDING.left + (i / (sorted.length - 1)) * plotWidth

  const yForRank = (r: number) => PADDING.top + plotHeight - ((r - minRank) / (maxRank - minRank)) * plotHeight

  // Step path: horizontal segment at each rank's own y, then a vertical
  // jump at the moment it changed - never a diagonal between two tiers.
  const stepPath = sorted
    .map((p, i) => {
      if (i === 0) return `M ${xForIndex(i)} ${yForRank(p.rank)}`
      return `L ${xForIndex(i)} ${yForRank(sorted[i - 1].rank)} L ${xForIndex(i)} ${yForRank(p.rank)}`
    })
    .join(' ')

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
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto touch-none"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <path d={stepPath} fill="none" stroke="var(--color-lapis-accent-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {sorted.map((p, i) => (
          <circle key={i} cx={xForIndex(i)} cy={yForRank(p.rank)} r={2.5} fill="var(--color-lapis-accent-500)" />
        ))}

        {hoverIndex != null && (
          <line
            x1={xForIndex(hoverIndex)}
            x2={xForIndex(hoverIndex)}
            y1={PADDING.top}
            y2={HEIGHT - PADDING.bottom}
            stroke="var(--color-lapis-border)"
            strokeWidth={1}
          />
        )}
      </svg>

      <div className="h-5 text-xs text-lapis-text-tertiary">
        {hoverIndex != null && sorted[hoverIndex] && (
          <>
            {formatDate(sorted[hoverIndex].recordedAt)} — Tier {sorted[hoverIndex].rank}
          </>
        )}
      </div>
    </div>
  )
}
