'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  RACE_APPROACHES,
  RACE_APPROACH_LABELS,
  previewApproachEffect,
  describeStrengthEmphasis,
  describeMuscleImpact,
  sortMuscleImpact,
  type RaceApproach,
  type DisciplineRampInputs,
} from '@/lib/race-plan/periodization'
import type { Discipline } from '@/lib/race-plan/self-assessment'
import type { MuscleVolume } from '@/lib/volume-analysis'

interface ApproachSpectrumProps {
  value: RaceApproach
  onChange: (value: RaceApproach) => void
  currentWeeklyCardioKm: number
  currentStrengthSessionsPerWeek: number
  showFinishTime: boolean
  projectedFinishSeconds: number | null
  projectedFinishRange?: { low: number; high: number } | null
  targetFinishSeconds: number | null
  onTargetFinishSecondsChange: (seconds: number | null) => void
  disciplineInputs?: DisciplineRampInputs
  muscleVolume: MuscleVolume[]
}

const DISCIPLINE_LABELS: Record<Discipline, string> = { swim: 'Swim', bike: 'Bike', run: 'Run' }

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
  projectedFinishRange,
  targetFinishSeconds,
  onTargetFinishSecondsChange,
  disciplineInputs,
  muscleVolume,
}: ApproachSpectrumProps) {
  const index = RACE_APPROACHES.indexOf(value)
  const preview = previewApproachEffect(value, currentWeeklyCardioKm, currentStrengthSessionsPerWeek, disciplineInputs)
  const strengthEmphasisText = describeStrengthEmphasis(value, currentStrengthSessionsPerWeek)
  const muscleImpact = sortMuscleImpact(describeMuscleImpact(value, currentStrengthSessionsPerWeek, muscleVolume))

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
        {preview.previewDisciplineKm ? (
          <>
            <p className="text-white/60 text-xs">Peak weekly targets</p>
            {(['swim', 'bike', 'run'] as Discipline[]).map((discipline) => (
              <p key={discipline} className="text-white text-sm">
                {DISCIPLINE_LABELS[discipline]}: ~{preview.previewDisciplineKm![discipline]}km/week at peak
              </p>
            ))}
          </>
        ) : (
          <>
            <p className="text-white/60 text-xs">Cardio peak target</p>
            <p className="text-white text-sm">~{preview.previewPeakCardioKm}km/week at this plan's peak</p>
          </>
        )}
        <p className="text-white/60 text-xs mt-3">Strength Emphasis</p>
        <p className="text-white text-sm">{strengthEmphasisText}</p>
        {muscleImpact.length > 0 && (
          <>
            <p className="text-white/60 text-xs mt-3">Muscle Impact</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {muscleImpact.map((line) => (
                <span
                  key={line.muscle}
                  title={line.description}
                  className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-white/60 border border-white/10"
                >
                  {line.muscle}: {line.shortLabel}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {showFinishTime && (
        <div className="space-y-2">
          <Label className="text-white/80">Target finish time (optional)</Label>
          {projectedFinishRange ? (
            <p className="text-white/40 text-xs">
              Estimated range: {formatDuration(projectedFinishRange.low)}–{formatDuration(projectedFinishRange.high)}. Override below if you have your own goal.
            </p>
          ) : (
            projectedFinishSeconds != null && (
              <p className="text-white/40 text-xs">
                Estimated from your data: {formatDuration(projectedFinishSeconds)}. Override below if you have your own goal.
              </p>
            )
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
