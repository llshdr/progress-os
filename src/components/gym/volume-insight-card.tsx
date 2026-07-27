'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { MuscleVolume } from '@/lib/volume-analysis'
import { MUSCLE_VOLUME_GUIDELINE } from '@/lib/volume-analysis'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not_enough_data' }
  | { status: 'ok'; volumes: MuscleVolume[]; text: string | null }

const STATUS_LABEL: Record<MuscleVolume['status'], string> = {
  under: 'under range',
  within: 'within range',
  over: 'over range',
}

// The deterministic per-muscle bars are the point and stand on their own;
// the optional AI sentence (when present) is just a wrap-up, never the
// source of the numbers themselves.
export default function VolumeInsightCard({ refreshKey }: { refreshKey: number }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    fetch('/api/ai-coach/volume-insight')
      .then(async (res) => {
        if (!res.ok) throw new Error('request failed')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        if (data.status === 'ok') {
          setState({ status: 'ok', volumes: data.volumes, text: data.text })
        } else if (data.status === 'not_enough_data') {
          setState({ status: 'not_enough_data' })
        } else {
          setState({ status: 'error' })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-white/40" />
        <h3 className="text-lg font-medium text-white">Volume This Week</h3>
      </div>

      {state.status === 'loading' && <p className="text-white/40 text-sm">Analyzing your volume...</p>}

      {state.status === 'not_enough_data' && (
        <p className="text-white/40 text-sm">Log a few sets this week to see volume per muscle.</p>
      )}

      {state.status === 'error' && (
        <p className="text-white/40 text-sm">Couldn&apos;t load volume analysis right now. Try again later.</p>
      )}

      {state.status === 'ok' && (
        <div className="space-y-3">
          {state.volumes.map((v) => (
            <div key={v.muscle}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-white/80">{v.muscle}</span>
                <span className="text-white/40 text-xs">
                  {v.sets} sets · {STATUS_LABEL[v.status]}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    v.status === 'within' ? 'bg-white' : 'bg-white/40'
                  }`}
                  style={{
                    width: `${Math.min((v.sets / MUSCLE_VOLUME_GUIDELINE.maxSetsPerWeek) * 100, 100)}%`,
                  }}
                />
              </div>
              {v.imbalance && (
                <p className="text-white/30 text-xs mt-1">
                  Uneven: {v.imbalance.highHead} ({v.imbalance.highSets} sets) vs{' '}
                  {v.imbalance.lowHead} ({v.imbalance.lowSets} sets)
                </p>
              )}
            </div>
          ))}

          {state.text && (
            <p className="text-white/70 text-sm mt-4 pt-4 border-t border-white/10">{state.text}</p>
          )}
        </div>
      )}
    </div>
  )
}
