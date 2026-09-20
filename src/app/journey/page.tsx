"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Archive, ChevronRight, Check } from "lucide-react";
import AppLayout from "@/components/app-layout";
import { PageHeader } from "@/components/lapis/page";
import { worldIcons } from "@/components/lapis/journey-preview";
import { worldStyle, WORLD_LABELS, type WorldStyle } from "@/lib/journey";
import { useJourney } from "@/lib/use-journey";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { LoadErrorBanner } from "@/components/ui/load-error-banner";
export default function JourneyPage() {
  const { goals, loading, error } = useJourney();
  const [filter, setFilter] = useState<WorldStyle | "all">("all");
  const active = goals.filter((g) => g.status === "active");
  const visible = active.filter(
    (g) => filter === "all" || worldStyle(g) === filter,
  );
  return (
    <AppLayout>
      <div className="lapis-page">
        <PageHeader
          title="Journey"
          subtitle="A world shaped by what matters to you."
          action={
            <Link
              href="/goals/new"
              aria-label="Add goal"
              className="lapis-icon-button"
            >
              <Plus />
            </Link>
          }
        />
        <nav className="lapis-tabs mb-5" aria-label="Journey views">
          <Link href="/journey" aria-current="page">
            World
          </Link>
          <Link href="/goals">Goals</Link>
        </nav>
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <LoadErrorBanner message="Couldn't load your goals. Refresh to try again." />
        ) : (
          <>
            <section
              className="lapis-world flex min-h-[25rem] flex-col justify-between p-5 md:min-h-[28rem]"
              aria-label="Your world"
            >
              <p className="lapis-eyebrow">Your world</p>
              {active.length > 0 ? (
                <>
                  <div className="my-8 grid grid-cols-2 items-start gap-x-4 gap-y-8">
                    {active.slice(0, 6).map((g, index) => {
                      const Icon = worldIcons[worldStyle(g)];
                      return (
                        <Link
                          key={g.id}
                          href={`/goals/${g.id}`}
                          aria-label={`Explore ${g.title}`}
                          className={`flex min-h-20 flex-col items-center gap-2 text-center ${index % 2 ? "mt-7" : ""}`}
                        >
                          <span className="flex size-11 items-center justify-center rounded-full border border-white/35 bg-slate-950/75 text-blue-300 shadow-lg">
                            <Icon size={21} />
                          </span>
                          <span className="max-w-full break-words rounded-lg bg-slate-950/80 px-3 py-2 text-sm font-medium text-white">
                            {g.title}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {active.length} active{" "}
                      {active.length === 1 ? "destination" : "destinations"}
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      Tap a destination to see your next step.
                      {active.length > 6
                        ? " All destinations are listed below."
                        : ""}
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">
                    Your next chapter starts here.
                  </h2>
                  <p className="mt-3 text-sm text-slate-200">
                    Add an ambition, a project or a small step. Your world grows
                    with you.
                  </p>
                  <Link href="/goals/new" className="lapis-primary mt-5">
                    Create a destination
                  </Link>
                </div>
              )}
            </section>
            <div
              className="mt-7 flex flex-wrap gap-2"
              aria-label="Filter destinations"
            >
              {(["all", "summit", "basecamp", "trail"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`min-h-11 rounded-full border px-4 text-sm ${filter === f ? "border-lapis-accent-400/40 bg-lapis-accent-500/15 text-lapis-accent-400" : "border-lapis-border text-lapis-text-secondary"}`}
                >
                  {f === "all" ? "All destinations" : WORLD_LABELS[f]}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {visible.map((g) => {
                const style = worldStyle(g);
                const Icon = worldIcons[style];
                const prereq = goals.find(
                  (p) => p.id === g.depends_on_goal_id && p.status !== "done",
                );
                return (
                  <Link
                    href={`/goals/${g.id}`}
                    key={g.id}
                    className="lapis-panel group"
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="text-lapis-accent-400" size={26} />
                      <span className="lapis-eyebrow">
                        {WORLD_LABELS[style]}
                      </span>
                    </div>
                    <h2 className="mt-5 text-xl font-semibold tracking-tight">
                      {g.title}
                    </h2>
                    <p className="mt-2 text-sm text-lapis-text-secondary">
                      {prereq
                        ? `After ${prereq.title}`
                        : g.next_action || "Set your next step"}
                    </p>
                    <span className="mt-5 flex items-center gap-1 text-sm text-lapis-accent-400">
                      Open destination <ChevronRight size={16} />
                    </span>
                  </Link>
                );
              })}
            </div>
            {active.length > 0 && visible.length === 0 && (
              <p className="py-8 text-sm text-lapis-text-secondary">
                No destinations in this view yet. Change a goal’s appearance in
                its details.
              </p>
            )}
            {goals.some((g) => g.status === "done") && (
              <section className="mt-8">
                <h2 className="lapis-section">Reached along the way</h2>
                <div className="lapis-group">
                  {goals
                    .filter((g) => g.status === "done")
                    .map((g) => (
                      <Link
                        href={`/goals/${g.id}`}
                        key={g.id}
                        className="lapis-row"
                      >
                        <Check className="text-lapis-accent-400" size={20} />
                        <span>{g.title}</span>
                      </Link>
                    ))}
                </div>
              </section>
            )}
            <Link
              href="/goals/archived"
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-lapis-text-secondary"
            >
              <Archive size={18} />
              Archived destinations
            </Link>
          </>
        )}
      </div>
    </AppLayout>
  );
}
