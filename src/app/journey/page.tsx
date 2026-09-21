"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Archive, Plus } from "lucide-react";
import AppLayout from "@/components/app-layout";
import JourneyHeader from "@/components/lapis/journey-header";
import WorldMap from "@/components/lapis/world-map";
import WorldMeter from "@/components/lapis/world-meter";
import { useWorld } from "@/components/lapis/world-provider";
import { useJourney } from "@/lib/use-journey";
import { usePageState } from "@/lib/use-page-state";
import { worldScenery, goalProgress } from "@/lib/world-progress";
import { worldStyle } from "@/lib/journey";
export default function JourneyPage() {
  const { goals, loading, error } = useJourney();
  const { data } = useWorld();
  const router = useRouter();
  const [selected, setSelected] = usePageState<string>("destination", "");
  const [filter, setFilter] = usePageState<string>("focus", "all", (v) =>
    ["all", "focus", "later", "paused", "done"].includes(v),
  );
  const destinations = goals.filter((g) => g.status !== "archived");
  const visible = destinations.filter(
    (g) =>
      filter === "all" ||
      (filter === "done" && g.status === "done") ||
      (g.status === "active" && (g.attention ?? "focus") === filter),
  );
  const current =
    visible.find((g) => g.id === selected) ??
    visible.find(
      (g) => g.status === "active" && (g.attention ?? "focus") === "focus",
    ) ??
    visible[0];
  return (
    <AppLayout>
      <div className="lapis-page">
        <JourneyHeader view="world" />
        <div className="world-filter" aria-label="Filter destinations">
          {[
            ["all", "All"],
            ["focus", "Focus now"],
            ["later", "Horizon"],
            ["paused", "Paused"],
            ["done", "Reached"],
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
          <p role="alert">Your world could not load. Refresh to try again.</p>
        ) : loading ? (
          <div className="h-[34rem] animate-pulse rounded-3xl bg-lapis-surface-1" />
        ) : (
          <>
            <WorldMap
              goals={destinations}
              visibleIds={visible.map((g) => g.id)}
              selected={current?.id}
              onSelect={(id) => {
                setSelected(id);
                router.push(`/goals/${id}`);
              }}
            />
            {!visible.length && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-lapis-text-secondary">
                <p>
                  {filter === "done"
                    ? "Your completed destinations will live here."
                    : "No destinations in this view yet."}
                </p>
                <Link href="/goals/new" className="lapis-secondary">
                  <Plus size={16} />
                  Create a destination
                </Link>
              </div>
            )}
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="space-y-5">
                {current && (
                  <Link
                    href={`/goals/${current.id}`}
                    className="goal-card flex min-h-40"
                  >
                    <div
                      className="w-28 shrink-0 bg-cover bg-center sm:w-40"
                      style={{
                        backgroundImage: `url('${worldScenery(worldStyle(current))}')`,
                      }}
                    />
                    <div className="min-w-0 flex-1 p-5">
                      <p className="lapis-eyebrow">
                        {current.status === "done"
                          ? "Your summit"
                          : "Continue your climb"}
                      </p>
                      <h2 className="mt-2 text-lg font-semibold">
                        {current.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-lapis-text-secondary">
                        {current.status === "done"
                          ? "Your flag is planted. Revisit the route that brought you here."
                          : current.next_action ||
                            goalProgress(current).next?.next_action ||
                            "Open your route and choose a next step."}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-2 text-xs text-lapis-accent-400">
                        Enter destination <ArrowUpRight size={15} />
                      </span>
                    </div>
                  </Link>
                )}
                <WorldMeter />
              </div>
              <section className="lapis-panel">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    What shaped your world
                  </h2>
                  <span className="text-xs text-lapis-text-secondary">
                    Recent activity
                  </span>
                </div>
                {data?.activity.length ? (
                  data.activity.slice(0, 5).map((a, i) => (
                    <Link
                      href={a.href || "/goals"}
                      key={`${a.kind}-${a.day}-${i}`}
                      className="flex min-h-16 items-center justify-between gap-4 border-t border-white/10 py-3"
                    >
                      <span className="min-w-0">
                        <strong className="block truncate text-sm font-medium">
                          {a.title}
                        </strong>
                        <span className="text-xs text-lapis-text-secondary">
                          {new Date(a.day + "T12:00:00").toLocaleDateString(
                            "en",
                            { day: "numeric", month: "short" },
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-lapis-accent-400">
                        +{a.xp} XP
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-lapis-text-secondary">
                    Your training, habits, nutrition, sleep and goal check-ins
                    leave a trace here.
                  </p>
                )}
                <Link
                  href="/plan"
                  className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-lapis-accent-400"
                >
                  Make room for your next step <ArrowUpRight size={15} />
                </Link>
              </section>
            </div>
          </>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/goals/archived"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-lapis-text-secondary"
          >
            <Archive size={16} />
            Archived destinations
          </Link>
          <Link
            href="/settings/world"
            className="inline-flex min-h-11 items-center text-sm text-lapis-text-secondary"
          >
            Arrange your world & choose your flag →
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
