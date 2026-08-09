'use client'

import { getLocalDateString } from '@/lib/date'
import { computeHabitStreak, buildHabitHeatmapWeeks, type Habit, type HabitLog } from '@/lib/habits'

interface Props {
  habits: Habit[]
  habitLogs: HabitLog[]
}

const WEEKS_SHOWN = 8

// A real consistency view, reusing habit_logs (already presence-only,
// already built) - streak count plus a weekly heatmap grid, same shape
// as any other week-bucketed grid in this app (the weekday picker in
// HabitsCard itself, muscle-group pill grids), not a new charting
// library. Deliberately no color for "missed" days - just filled
// (logged) vs. unfilled (not logged) vs. muted (not applicable that
// day) - same "never a guilt mechanic" precedent daysSinceLastLog
// already established, held here even though streaks themselves are a
// deliberate, explicitly-requested reversal of that file's earlier
// "no streak mechanics" stance.
export default function HabitConsistencyCard({ habits, habitLogs }: Props) {
  const today = getLocalDateString()

  if (habits.length === 0) return null

  return (
    <div className="border border-lapis-border-subtle rounded-lapis-lg bg-lapis-surface-1 p-6">
      <h2 className="text-lg font-medium text-lapis-text-primary mb-1">Consistency</h2>
      <p className="text-lapis-text-tertiary text-sm mb-4">Last {WEEKS_SHOWN} weeks, oldest to newest.</p>

      <div className="space-y-5">
        {habits.map((habit) => {
          const { current, longest } = computeHabitStreak(habitLogs, habit, today)
          const weeks = buildHabitHeatmapWeeks(habitLogs, habit, today, WEEKS_SHOWN)

          return (
            <div key={habit.id}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-lapis-text-primary text-sm font-medium">{habit.name}</p>
                <p className="text-lapis-text-tertiary text-xs">
                  {current > 0 ? `${current} in a row` : 'No current streak'}
                  {longest > current && longest > 0 ? ` · Best: ${longest}` : ''}
                </p>
              </div>
              <div className="flex gap-1">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((cell) => (
                      <div
                        key={cell.date}
                        title={cell.date}
                        className={`w-3.5 h-3.5 rounded-sm ${
                          !cell.applicable
                            ? 'bg-lapis-surface-1 border border-lapis-border-subtle'
                            : cell.logged
                              ? 'bg-lapis-accent-500'
                              : 'bg-lapis-surface-2 border border-lapis-border-subtle'
                        }`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
