'use client'

import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { computeScheduledMuscleVolume, MUSCLE_VOLUME_GUIDELINE, type MuscleVolume } from '@/lib/volume-analysis'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; volumes: MuscleVolume[] }

const STATUS_LABEL: Record<MuscleVolume['status'], string> = {
  under: 'under range',
  within: 'within range',
  over: 'over range',
}

// Deliberately button-triggered, not auto-loading like VolumeInsightCard -
// this is a one-off "analyze my plan" action on demand, not a standing
// summary. No AI call and no cache table: it's cheap deterministic math
// over the schedule/templates, safe to recompute on every click.
export default function ScheduledVolumeCard({ userId }: { userId: string }) {
  const [state, setState] = useState<State>({ status: 'idle' })
  const supabase = createClient()

  const handleAnalyze = async () => {
    setState({ status: 'loading' })
    try {
      const volumes = await computeScheduledMuscleVolume(supabase, userId)
      setState({ status: 'ok', volumes })
    } catch (err) {
      console.error('Error analyzing schedule volume:', err)
      setState({ status: 'error' })
    }
  }

  return (
    <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-4 h-4 text-lapis-text-tertiary" />
        <h3 className="text-lg font-medium text-lapis-text-primary">Your Plan (as scheduled)</h3>
      </div>

      {state.status === 'idle' && (
        <div className="space-y-3">
          <p className="text-lapis-text-tertiary text-sm">
            See total sets per muscle across your whole rotation, if followed as planned.
          </p>
          <Button onClick={handleAnalyze} className="bg-lapis-accent-500 text-lapis-text-primary hover:brightness-110">
            Analyze my plan
          </Button>
        </div>
      )}

      {state.status === 'loading' && <p className="text-lapis-text-tertiary text-sm">Analyzing your plan...</p>}

      {state.status === 'error' && (
        <p className="text-lapis-text-tertiary text-sm">Couldn&apos;t analyze your plan right now. Try again later.</p>
      )}

      {state.status === 'ok' && (
        <div className="space-y-3">
          {state.volumes.map((v) => (
            <div key={v.muscle}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-lapis-text-secondary">{v.muscle}</span>
                <span className="text-lapis-text-tertiary text-xs">
                  {v.sets} sets · {STATUS_LABEL[v.status]}
                </span>
              </div>
              <div className="w-full bg-lapis-surface-2 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    v.status === 'within' ? 'bg-lapis-accent-500' : 'bg-lapis-accent-500/40'
                  }`}
                  style={{
                    width: `${Math.min((v.sets / MUSCLE_VOLUME_GUIDELINE.maxSetsPerWeek) * 100, 100)}%`,
                  }}
                />
              </div>
              {v.imbalance && (
                <p className="text-lapis-text-disabled text-xs mt-1">
                  Uneven: {v.imbalance.highHead} ({v.imbalance.highSets} sets) vs{' '}
                  {v.imbalance.lowHead} ({v.imbalance.lowSets} sets)
                </p>
              )}
            </div>
          ))}
          <Button
            onClick={handleAnalyze}
            variant="outline"
            className="border-lapis-border-subtle text-lapis-text-primary hover:bg-lapis-surface-2 mt-2"
          >
            Re-analyze
          </Button>
        </div>
      )}
    </div>
  )
}
