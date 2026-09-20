"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Mountain, Plus, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Goal = { id: string; title: string; status: string };
export default function WorkoutGoalLinks({ workoutId }: { workoutId: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [linked, setLinked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const db = createClient();
        const {
          data: { user },
        } = await db.auth.getUser();
        if (!user) throw new Error("Sign in required");
        const [all, links] = await Promise.all([
          db
            .from("goals")
            .select("id, title, status")
            .eq("user_id", user.id)
            .order("created_at"),
          db
            .from("workout_goal_links")
            .select("goal_id")
            .eq("workout_id", workoutId)
            .eq("user_id", user.id),
        ]);
        if (all.error || links.error) throw new Error("Could not load links");
        if (alive) {
          setGoals(all.data ?? []);
          setLinked((links.data ?? []).map((l) => l.goal_id));
        }
      } catch {
        if (alive) setError("Goal links could not load. Refresh to try again.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [workoutId]);
  async function toggle(goalId: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error("Sign in required");
      const exists = linked.includes(goalId);
      const result = exists
        ? await db
            .from("workout_goal_links")
            .delete()
            .eq("workout_id", workoutId)
            .eq("goal_id", goalId)
            .eq("user_id", user.id)
        : await db
            .from("workout_goal_links")
            .insert({
              workout_id: workoutId,
              goal_id: goalId,
              user_id: user.id,
            });
      if (result.error) throw result.error;
      setLinked((previous) =>
        exists ? previous.filter((id) => id !== goalId) : [...previous, goalId],
      );
    } catch {
      setError("Could not save this link. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="lapis-panel my-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <Mountain size={20} className="text-lapis-accent-400" />
        What this builds toward
      </h2>
      <p className="mt-2 text-sm text-lapis-text-secondary">
        Link this session to your goals. Your workout is only logged once.
      </p>
      {loading && (
        <p className="mt-3 text-sm text-lapis-text-secondary">Loading goals…</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-lapis-text-secondary">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {goals
          .filter((g) => g.status === "active" || linked.includes(g.id))
          .map((g) => (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              disabled={pending}
              aria-pressed={linked.includes(g.id)}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm disabled:opacity-50 ${linked.includes(g.id) ? "border-lapis-accent-400/50 bg-lapis-accent-500/15 text-lapis-accent-400" : "border-lapis-border text-lapis-text-secondary"}`}
            >
              {linked.includes(g.id) ? <Check size={16} /> : <Plus size={16} />}
              {g.title}
            </button>
          ))}
      </div>
      {linked.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-5">
          {goals
            .filter((g) => linked.includes(g.id))
            .map((g) => (
              <Link
                key={g.id}
                href={`/goals/${g.id}`}
                className="inline-flex min-h-11 items-center text-sm text-lapis-accent-400"
              >
                Open {g.title} →
              </Link>
            ))}
        </div>
      )}
      {!loading && !error && goals.length === 0 && (
        <Link
          href="/goals/new"
          className="mt-3 inline-flex min-h-11 items-center text-sm text-lapis-accent-400"
        >
          Add a goal →
        </Link>
      )}
    </section>
  );
}
