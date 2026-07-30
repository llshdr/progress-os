'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RACE_APPROACHES, RACE_APPROACH_LABELS, previewApproachEffect, type RaceApproach } from '@/lib/race-plan/periodization'

interface ApproachSpectrumProps {
  value: RaceApproach
  onChange: (value: RaceApproach) => void
  currentWeeklyCardioKm: number
  currentStrengthSessionsPerWeek: number
  showFinishTime: boolean
  projectedFinishSeconds: number | null
  targetFinishSeconds: number | null
  onTargetFinishSecondsChange: (seconds: number | null) => void
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

function parseDurationInput(hh: string, mm: string, ss: string): number | null {
  const h = parseInt(hh || '0', 10)
  const m = parseInt(mm || '0', 10)
  const s = parseInt(ss || '0', 10)
  const total = h * 3600 + m * 60 + s
  return total > 0 ? total : null
}

// 5-stop slider replacing the old binary Full-send/Balanced toggle. The
// live "Strength Emphasis" text is computed entirely from real numbers
// already on hand (periodization.ts's own preset table + the fitness
// snapshot's current baseline) - no fabricated projection, just an honest
// description of what each stop actually does.
export default function ApproachSpectrum({
  value,
  onChange,
  currentWeeklyCardioKm,
  currentStrengthSessionsPerWeek,
  showFinishTime,
  projectedFinishSeconds,
  targetFinishSeconds,
  onTargetFinishSecondsChange,
}: ApproachSpectrumProps) {
  const index = RACE_APPROACHES.indexOf(value)
  const preview = previewApproachEffect(value, currentWeeklyCardioKm, currentStrengthSessionsPerWeek)
  const strengthBaseline = Math.round(currentStrengthSessionsPerWeek)

  let strengthEmphasisText: string
  if (currentStrengthSessionsPerWeek <= 0) {
    strengthEmphasisText = 'No recent strength training logged, so this spectrum only shapes cardio volume.'
  } else if (preview.previewSteadyStrengthSessions === strengthBaseline) {
    strengthEmphasisText = `${preview.previewSteadyStrengthSessions} strength session(s)/week — matches your current training.`
  } else if (preview.previewSteadyStrengthSessions < strengthBaseline) {
    strengthEmphasisText = `${preview.previewSteadyStrengthSessions} strength session(s)/week — a cut from your current ${strengthBaseline}/week to prioritize race prep.`
  } else {
    strengthEmphasisText = `${preview.previewSteadyStrengthSessions} strength session(s)/week — holding above your current ${strengthBaseline}/week.`
  }

  const hh = targetFinishSeconds != null ? String(Math.floor(targetFinishSeconds / 3600)) : ''
  const mm = targetFinishSeconds != null ? String(Math.floor((targetFinishSeconds % 3600) / 60)) : ''
  const ss = targetFinishSeconds != null ? String(targetFinishSeconds % 60) : ''

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between text-xs text-white/40 mb-2">
          <span>Best Race Time</span>
          <span>Best Muscle Growth</span>
        </div>
        <input
          type="range"
          min={0}
          max={RACE_APPROACHES.length - 1}
          step={1}
          value={index}
          onChange={(e) => onChange(RACE_APPROACHES[Number(e.target.value)])}
          className="w-full accent-white"
        />
        <p className="text-white text-sm font-medium text-center mt-2">{RACE_APPROACH_LABELS[value]}</p>
      </div>

      <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4 space-y-1">
        <p className="text-white/60 text-xs">Cardio peak target</p>
        <p className="text-white text-sm">~{preview.previewPeakCardioKm}km/week at this plan's peak</p>
        <p className="text-white/60 text-xs mt-3">Strength Emphasis</p>
        <p className="text-white text-sm">{strengthEmphasisText}</p>
      </div>

      {showFinishTime && (
        <div className="space-y-2">
          <Label className="text-white/80">Target finish time (optional)</Label>
          {projectedFinishSeconds != null && (
            <p className="text-white/40 text-xs">
              Estimated from your data: {formatDuration(projectedFinishSeconds)}. Override below if you have your own goal.
            </p>
          )}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={hh}
              onChange={(e) => onTargetFinishSecondsChange(parseDurationInput(e.target.value, mm, ss))}
              placeholder="hh"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 w-16"
            />
            <Input
              type="number"
              value={mm}
              onChange={(e) => onTargetFinishSecondsChange(parseDurationInput(hh, e.target.value, ss))}
              placeholder="mm"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 w-16"
            />
            <Input
              type="number"
              value={ss}
              onChange={(e) => onTargetFinishSecondsChange(parseDurationInput(hh, mm, e.target.value))}
              placeholder="ss"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 w-16"
            />
          </div>
        </div>
      )}
    </div>
  )
}
