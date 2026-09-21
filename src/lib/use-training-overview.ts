"use client";
import { createClient } from "./supabase/client";
import { getLocalDateString, getLocalWeekStartString } from "./date";
import { filterWorkoutsCountingTowardGoal } from "./workout-goal";
import { useUserResource } from "./use-user-resource";
async function loadOverview(uid: string) {
  const db = createClient();
  const [settings, recent, weekly] = await Promise.all([
    db
      .from("user_settings")
      .select(
        "weekly_workout_goal,count_cardio_toward_workout_goal,show_today_suggestions",
      )
      .eq("user_id", uid)
      .maybeSingle(),
    db
      .from("workouts")
      .select("id,date,workout_type,workout_templates(name)")
      .eq("user_id", uid)
      .not("completed_at", "is", null)
      .order("date", { ascending: false })
      .order("started_at", { ascending: false })
      .limit(3),
    db
      .from("workouts")
      .select("id")
      .eq("user_id", uid)
      .gte("date", getLocalWeekStartString())
      .lte("date", getLocalDateString())
      .not("completed_at", "is", null),
  ]);
  if (settings.error || recent.error || weekly.error)
    throw new Error("Training history couldn't load.");
  const counted = await filterWorkoutsCountingTowardGoal(
    db,
    (weekly.data ?? []).map((w) => w.id),
    settings.data?.count_cardio_toward_workout_goal ?? true,
  );
  const rows = (recent.data ?? []) as unknown as {
    id: string;
    date: string;
    workout_type: string | null;
    workout_templates: { name: string } | null;
  }[];
  return {
    weeklyCount: counted.size,
    weeklyTarget: settings.data?.weekly_workout_goal || 5,
    suggestions: settings.data?.show_today_suggestions ?? true,
    recent: rows.map((w) => ({
      id: w.id,
      title: w.workout_templates?.name || w.workout_type || "Workout",
      date: w.date,
    })),
  };
}
export function useTrainingOverview() {
  return useUserResource(`training:${getLocalDateString()}`, loadOverview);
}
