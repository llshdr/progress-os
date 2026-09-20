export type WorldStyle = "summit" | "basecamp" | "trail";
export type JourneyGoal = {
  id: string;
  title: string;
  next_action: string | null;
  status: string;
  scope: string | null;
  world_style?: WorldStyle | null;
  target_date: string | null;
  depends_on_goal_id?: string | null;
};
export function worldStyle(
  goal: Pick<JourneyGoal, "scope" | "world_style">,
): WorldStyle {
  return (
    goal.world_style ??
    (goal.scope === "long_term"
      ? "summit"
      : goal.scope === "quick_win"
        ? "trail"
        : "basecamp")
  );
}
export const WORLD_LABELS: Record<WorldStyle, string> = {
  summit: "Summit",
  basecamp: "Basecamp",
  trail: "Trail",
};
