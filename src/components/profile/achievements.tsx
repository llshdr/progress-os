"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Mountain, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
export default function Achievements({ userId }: { userId: string }) {
  const [data, setData] = useState<{
    sessions: number;
    races: number;
    goals: { id: string; title: string }[];
    reached: number;
  } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    const db = createClient();
    void Promise.all([
      db
        .from("workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("completed_at", "is", null),
      db
        .from("races")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("result_duration_seconds", "is", null),
      db
        .from("goals")
        .select("id,title", { count: "exact" })
        .eq("user_id", userId)
        .eq("status", "done")
        .order("updated_at", { ascending: false })
        .limit(4),
    ])
      .then(([sessions, races, goals]) => {
        if (!live) return;
        if (sessions.error || races.error || goals.error) {
          setError(true);
          return;
        }
        setData({
          sessions: sessions.count ?? 0,
          races: races.count ?? 0,
          goals: goals.data ?? [],
          reached: goals.count ?? 0,
        });
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, [userId]);
  return (
    <section className="mb-6">
      <h2 className="lapis-section">What you’ve built</h2>
      {error ? (
        <p className="text-sm text-lapis-text-secondary">
          Achievements could not load. Refresh to try again.
        </p>
      ) : !data ? (
        <div className="h-28 animate-pulse rounded-2xl bg-lapis-surface-1" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              [data.sessions, "Sessions"],
              [data.reached, "Goals reached"],
              [data.races, "Race finishes"],
            ].map(([n, label]) => (
              <div key={label} className="lapis-panel !p-4">
                <strong className="block text-3xl font-semibold tracking-tight">
                  {n}
                </strong>
                <span className="text-xs text-lapis-text-secondary">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="lapis-group mt-4">
            {data.goals.map((g) => (
              <Link key={g.id} href={`/goals/${g.id}`} className="lapis-row">
                <Mountain className="shrink-0 text-lapis-jade" size={20} />
                <span className="min-w-0 flex-1 text-sm">{g.title}</span>
                <ArrowUpRight size={17} />
              </Link>
            ))}
            {!data.goals.length && (
              <Link
                href="/goals"
                className="lapis-row text-sm text-lapis-text-secondary"
              >
                Your completed goals will appear here. Open your goals →
              </Link>
            )}
          </div>
        </>
      )}
    </section>
  );
}
