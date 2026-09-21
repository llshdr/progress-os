import type { TrainingWeekSkeleton } from "./periodization";
import type { PhaseTemplates } from "./day-template";

/** Regeneration only replaces future weeks. Past/current targets and schedules stay stable. */
export function preserveStartedWeeks<T extends TrainingWeekSkeleton>(
  previous: T[],
  candidate: T[],
  templates: PhaseTemplates,
  currentMonday: string,
): T[] {
  const locked = previous
    .filter((w) => w.weekStartDate <= currentMonday)
    .map((week) => ({
      ...week,
      templateSnapshot: week.templateSnapshot ?? templates[week.phase],
      progressionIndex:
        week.progressionIndex ??
        previous.filter(
          (w) =>
            w.phase === week.phase &&
            Boolean(w.isAcclimation) === Boolean(week.isAcclimation) &&
            w.weekStartDate < week.weekStartDate,
        ).length,
    }));
  return [
    ...locked,
    ...candidate.filter((w) => w.weekStartDate > currentMonday),
  ].sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
}
