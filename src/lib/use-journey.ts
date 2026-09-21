"use client";
import { createClient } from "@/lib/supabase/client";
import { useUserResource } from "./use-user-resource";
import type { JourneyGoal } from "./journey";
async function loadGoals(uid: string) {
  const db = createClient();
  // select * allows older databases to render with scope-derived scenery.
  const [result, links] = await Promise.all([
    db
      .from("goals")
      .select("*, milestones(id,title,status,next_action,due_date,created_at)")
      .eq("user_id", uid)
      .order("created_at", { ascending: true }),
    db.from("races").select("id,goal_id,race_type,location").eq("user_id", uid),
  ]);
  if (result.error || links.error)
    throw new Error("Your goals couldn't load. Please retry.");
  return {
    goals: (result.data ?? []).map((goal) => ({
      ...goal,
      milestones: (goal.milestones ?? [])
        .filter((m: { status: string }) => m.status !== "archived")
        .sort(
          (
            a: {
              due_date: string | null;
              created_at: string;
              id: string;
            },
            b: {
              due_date: string | null;
              created_at: string;
              id: string;
            },
          ) =>
            (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
            (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
            a.id.localeCompare(b.id),
        ),
    })) as JourneyGoal[],
    races: links.data ?? [],
  };
}
export function useJourney() {
  const { data, error, loading, refresh } = useUserResource("goals", loadGoals);
  return {
    goals: data?.goals ?? [],
    races: data?.races ?? [],
    loading,
    error: Boolean(error),
    refresh,
  };
}
