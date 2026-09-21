import type { JourneyGoal } from "./journey";
export type WorldSummary = {
  xp: number;
  todayXp: number;
  country: string | null;
  sources: Record<string, number>;
  activity: {
    kind: string;
    day: string;
    xp: number;
    title: string;
    href: string | null;
  }[];
  goals: Record<string, { sessions: number; checkins: number }>;
};
export const WORLD_XP_PER_LEVEL = 300;
export function worldLevel(xp: number) {
  const safe = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  return {
    level: Math.floor(safe / WORLD_XP_PER_LEVEL) + 1,
    earned: safe % WORLD_XP_PER_LEVEL,
    next: WORLD_XP_PER_LEVEL - (safe % WORLD_XP_PER_LEVEL),
  };
}
export function goalProgress(goal: Pick<JourneyGoal, "status" | "milestones">) {
  const milestones = (goal.milestones ?? []).filter(
    (m) => m.status !== "archived",
  );
  const reached = milestones.filter((m) => m.status === "done").length;
  const fraction = milestones.length ? reached / milestones.length : 0;
  return {
    reached,
    total: milestones.length,
    fraction,
    // The summit is reserved for the explicit completion of the goal itself.
    ascent: goal.status === "done" ? 1 : fraction * 0.88,
    next: milestones.find((m) => m.status === "active") ?? null,
  };
}
export const worldScenery = (style: string) =>
  `/images/world/ascent-${["summit", "trail", "basecamp"].includes(style) ? style : "summit"}.webp`;
export const worldChapter = (level: number) =>
  level >= 10
    ? "A world of your own"
    : level >= 7
      ? "Beyond the clouds"
      : level >= 4
        ? "A place to grow"
        : level >= 2
          ? "Finding your stride"
          : "The first foothold";
export function localTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
