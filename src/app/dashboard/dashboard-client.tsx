"use client";
import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import {
  ArrowUpRight,
  Plus,
  Dumbbell,
  Apple,
  Target,
  CalendarDays,
  Flag,
  Sparkles,
} from "lucide-react";
import AppLayout from "@/components/app-layout";
import DailySessions from "@/components/lapis/daily-sessions";
import ActiveRaceCard from "@/components/lapis/active-race-card";
import { NavRow } from "@/components/lapis/page";
import { useTrainingOverview } from "@/lib/use-training-overview";
import { useJourney } from "@/lib/use-journey";
import { useLapis } from "@/components/lapis/app-provider";
import { useDailyPlan } from "@/lib/use-daily-plan";
import { getLocalDateString } from "@/lib/date";
import { LoadErrorBanner } from "@/components/ui/load-error-banner";
import TodaySuggestionsSection from "@/components/ai-coach/today-suggestions-section";

const subscribeClock = (notify: () => void) => {
  const timer = window.setInterval(notify, 60_000);
  window.addEventListener("focus", notify);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", notify);
  };
};
const readGreeting = () => {
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 18
      ? "Good afternoon"
      : "Good evening";
};
export default function DashboardClient({ user }: { user: User }) {
  const training = useTrainingOverview();
  const journey = useJourney();
  const { identity } = useLapis();
  const { data: daily } = useDailyPlan(getLocalDateString());
  const name = identity?.name || user.user_metadata?.full_name || "there";
  const todayRace =
    daily?.race?.race_date === getLocalDateString() ? daily.race.id : null;
  const greeting = useSyncExternalStore(
    subscribeClock,
    readGreeting,
    () => "Welcome back",
  );
  const priorities = journey.goals
    .filter(
      (g) =>
        g.status === "active" &&
        (g.attention ?? "focus") === "focus" &&
        (!g.depends_on_goal_id ||
          journey.goals.some(
            (p) => p.id === g.depends_on_goal_id && p.status === "done",
          )),
    )
    .sort((a, b) =>
      (a.target_date || "9999").localeCompare(b.target_date || "9999"),
    )
    .slice(0, 3);
  return (
    <AppLayout>
      <div className="lapis-page max-w-5xl">
        <header className="mb-7">
          <p className="mb-2 text-lapis-text-secondary">
            {greeting}, {name}.
          </p>
          <div className="flex items-center justify-between gap-4">
            <h1 className="lapis-title">Today</h1>
            <Link href="/plan" className="lapis-secondary">
              <CalendarDays size={17} />
              Your plan
            </Link>
          </div>
        </header>
        {todayRace && (
          <Link
            href={`/gym/progress/races/${todayRace}?tab=progress`}
            className="lapis-panel mb-5 flex items-center gap-3"
          >
            <Flag className="text-lapis-accent-400" />
            <span>
              <strong className="block">Today is race day</strong>
              <span className="text-sm text-lapis-text-secondary">
                Open your race and log your result →
              </span>
            </span>
          </Link>
        )}
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-7">
            <DailySessions hero />
            <ActiveRaceCard />
          </div>
          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between">
                <h2 className="lapis-section mb-0">Your next steps</h2>
                <Link
                  href="/goals"
                  className="inline-flex min-h-11 items-center text-sm text-lapis-accent-400"
                >
                  All goals
                </Link>
              </div>
              {journey.error ? (
                <LoadErrorBanner message="Couldn't load your goals. Try refreshing." />
              ) : journey.loading ? (
                <div className="mt-4 h-20 animate-pulse rounded-xl bg-lapis-surface-1" />
              ) : (
                <div className="mt-3 divide-y divide-lapis-border-subtle border-y border-lapis-border-subtle">
                  {priorities.map((g) => {
                    return (
                      <Link
                        key={g.id}
                        href={`/goals/${g.id}`}
                        className="flex min-h-24 items-center gap-4 py-4"
                      >
                        <Target
                          className="shrink-0 text-lapis-text-secondary"
                          size={24}
                        />
                        <span className="min-w-0 flex-1">
                          <strong className="block font-semibold">
                            {g.next_action || g.title}
                          </strong>
                          <span className="mt-1 block text-sm text-lapis-text-secondary">
                            {g.next_action
                              ? g.title
                              : "Choose your next concrete step"}
                          </span>
                        </span>
                        <ArrowUpRight
                          size={20}
                          className="shrink-0 text-lapis-accent-400"
                        />
                      </Link>
                    );
                  })}
                  {priorities.length === 0 && (
                    <Link
                      href="/goals/new"
                      className="flex min-h-20 items-center gap-3 text-lapis-text-secondary"
                    >
                      <Plus size={20} />
                      Choose one thing to work toward
                    </Link>
                  )}
                </div>
              )}
            </section>
            <details className="group border-y border-lapis-border-subtle">
              <summary className="flex min-h-20 cursor-pointer list-none items-center gap-4 py-4 [&::-webkit-details-marker]:hidden">
                <span className="lapis-icon-button">
                  <Plus size={24} />
                </span>
                <span>
                  <strong className="block">Quick log</strong>
                  <span className="text-sm text-lapis-text-secondary">
                    Workout, meal or goal check-in
                  </span>
                </span>
                <Plus size={16} className="ml-auto group-open:rotate-45" />
              </summary>
              <div className="lapis-group mb-4">
                <NavRow
                  href="/gym/workouts/new"
                  title="Workout"
                  icon={Dumbbell}
                />
                <NavRow href="/nutrition?log=1" title="Meal" icon={Apple} />
                <NavRow
                  href="/goals"
                  title="Goal check-in"
                  description="Choose a goal to add a note"
                  icon={Target}
                />
              </div>
            </details>
            {training.data && (
              <Link
                href="/gym/progress"
                className="flex min-h-16 items-center justify-between gap-3 text-sm"
              >
                <span className="text-lapis-text-secondary">
                  Training this week
                </span>
                <span>
                  {training.data.weeklyCount} / {training.data.weeklyTarget}{" "}
                  sessions →
                </span>
              </Link>
            )}
          </div>
        </div>
        {training.data?.suggestions && (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="lapis-section mb-0 flex items-center gap-2">
                <Sparkles size={19} className="text-lapis-accent-400" />A useful
                next step
              </h2>
              <Link
                href="/coach"
                className="inline-flex min-h-11 items-center text-sm text-lapis-accent-400"
              >
                Open Coach
              </Link>
            </div>
            <TodaySuggestionsSection limit={1} />
          </section>
        )}
      </div>
    </AppLayout>
  );
}
