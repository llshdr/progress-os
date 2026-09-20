"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Dumbbell } from "lucide-react";
type Session = {
  id: string;
  date: string;
  workout_type: string | null;
  completed_at: string | null;
};
export default function GoalSessions({ goalId }: { goalId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const db = createClient();
        const { data, error } = await db
          .from("workout_goal_links")
          .select("workouts(id, date, workout_type, completed_at)")
          .eq("goal_id", goalId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) throw error;
        if (alive)
          setSessions(
            (data ?? [])
              .map((row) => row.workouts as unknown as Session)
              .filter(Boolean),
          );
      } catch {
        if (alive) setError(true);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [goalId]);
  return (
    <section className="lapis-panel mb-6">
      <h2 className="lapis-section">Sessions along the way</h2>
      <p className="mb-3 text-sm text-lapis-text-secondary">
        Connect a workout from its session page. Completing a session keeps your
        milestone decisions yours.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-lapis-text-secondary">
          Linked sessions could not load. Refresh to try again.
        </p>
      ) : sessions.length ? (
        <div className="divide-y divide-lapis-border-subtle">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/gym/workouts/${s.id}`}
              className="flex min-h-16 items-center gap-3 py-3"
            >
              <Dumbbell size={20} className="text-lapis-accent-400" />
              <span>
                <strong className="block text-sm">
                  {s.workout_type || "Workout"}
                </strong>
                <span className="text-xs text-lapis-text-secondary">
                  {new Date(`${s.date}T12:00:00`).toLocaleDateString("en", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {s.completed_at ? "Logged" : "In progress"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-lapis-text-secondary">
          No linked sessions yet.
        </p>
      )}
    </section>
  );
}
