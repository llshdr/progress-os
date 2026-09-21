"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowUpRight, Archive } from "lucide-react";
import AppLayout from "@/components/app-layout";
import JourneyHeader from "@/components/lapis/journey-header";
import SummitFlag from "@/components/lapis/summit-flag";
import { useJourney } from "@/lib/use-journey";
import { usePageState } from "@/lib/use-page-state";
import { useWorld } from "@/components/lapis/world-provider";
import { createClient } from "@/lib/supabase/client";
import { worldStyle } from "@/lib/journey";
import { goalProgress, worldScenery } from "@/lib/world-progress";
export default function GoalsPage() {
  const { goals, loading, error } = useJourney();
  const { data } = useWorld();
  const [filter, setFilter] = usePageState<string>("focus", "focus", (v) =>
    ["all", "focus", "later", "paused", "done"].includes(v),
  );
  const [standalone, setStandalone] = useState<
    { id: string; title: string; status: string }[]
  >([]);
  useEffect(() => {
    let alive = true;
    void createClient()
      .from("milestones")
      .select("id,title,status")
      .is("goal_id", null)
      .eq("status", "active")
      .then(({ data }) => {
        if (alive) setStandalone(data ?? []);
      });
    return () => {
      alive = false;
    };
  }, []);
  const visible = goals.filter(
    (g) =>
      g.status !== "archived" &&
      (filter === "all" ||
        (filter === "done" && g.status === "done") ||
        (g.status === "active" && (g.attention ?? "focus") === filter)),
  );
  return (
    <AppLayout>
      <div className="lapis-page">
        <JourneyHeader view="goals" />
        <div className="world-filter">
          {[
            ["focus", "Focus now"],
            ["later", "Horizon"],
            ["paused", "Paused"],
            ["done", "Reached"],
            ["all", "All"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {label}
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert">Your goals could not load. Please refresh.</p>
        ) : loading ? (
          <div className="h-72 animate-pulse rounded-3xl bg-lapis-surface-1" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((g) => {
              const progress = goalProgress(g);
              const blocked = goals.find(
                (p) => p.id === g.depends_on_goal_id && p.status !== "done",
              );
              return (
                <Link href={`/goals/${g.id}`} key={g.id} className="goal-card">
                  <div
                    className="goal-card-art"
                    style={{
                      backgroundImage: `url('${worldScenery(worldStyle(g))}')`,
                    }}
                  >
                    {g.status === "done" && (
                      <span className="absolute right-5 top-5 z-10">
                        <SummitFlag
                          country={g.summit_country || data?.country}
                        />
                      </span>
                    )}
                  </div>
                  <div className="goal-card-body">
                    <p className="lapis-eyebrow mb-2">
                      {g.status === "done"
                        ? "Reached"
                        : g.attention === "later"
                          ? "On the horizon"
                          : g.attention === "paused"
                            ? "Taking a pause"
                            : worldStyle(g)}
                    </p>
                    <h2>{g.title}</h2>
                    <p className="mt-3 min-h-12 text-sm leading-6 text-lapis-text-secondary">
                      {g.status === "done"
                        ? "Your flag is planted. Look back on the climb."
                        : blocked
                          ? `First, reach ${blocked.title}`
                          : g.next_action ||
                            progress.next?.next_action ||
                            "Choose your next step."}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-2 text-xs text-lapis-text-secondary">
                      <span>
                        {progress.total
                          ? `${progress.reached} / ${progress.total} milestones`
                          : g.status === "done"
                            ? "Summit reached"
                            : "Map your first milestones"}
                      </span>
                      <ArrowUpRight size={16} />
                    </div>
                    {progress.total > 0 && (
                      <progress
                        className="lapis-progress mt-3 h-1 w-full"
                        max={progress.total || 1}
                        value={progress.reached}
                        aria-label={`${g.title} milestones`}
                      />
                    )}
                  </div>
                </Link>
              );
            })}
            <Link
              href="/goals/new"
              className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-lapis-border p-6 text-lapis-text-secondary"
            >
              <Plus size={25} />
              <span className="text-sm">Give a new ambition a place</span>
            </Link>
          </div>
        )}
        {standalone.length > 0 && (
          <section className="mt-8">
            <h2 className="lapis-section">Small steps, their own way</h2>
            <div className="lapis-group">
              {standalone.map((m) => (
                <Link
                  key={m.id}
                  href={`/goals/milestones/${m.id}/edit`}
                  className="lapis-row justify-between text-sm"
                >
                  {m.title}
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          </section>
        )}
        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <Link
            href="/goals/archived"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-lapis-text-secondary"
          >
            <Archive size={16} />
            Archived destinations
          </Link>
          <Link
            href="/goals/milestones/new"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-lapis-text-secondary"
          >
            <Plus size={16} />
            Standalone milestone
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
