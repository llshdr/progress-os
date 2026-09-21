"use client";
import AppLayout from "@/components/app-layout";
import { PageHeader, NavRow } from "@/components/lapis/page";
import DailySessions from "@/components/lapis/daily-sessions";
import ActiveRaceCard from "@/components/lapis/active-race-card";
import { useTrainingOverview } from "@/lib/use-training-overview";
import {
  CalendarDays,
  BookOpen,
  TrendingUp,
  History,
  Apple,
  Plus,
  Flag,
} from "lucide-react";
import Link from "next/link";
import { LoadErrorBanner } from "@/components/ui/load-error-banner";
export default function TrainingPage() {
  const { data, error } = useTrainingOverview();
  return (
    <AppLayout>
      <div className="lapis-page">
        <PageHeader
          title="Training"
          subtitle="Build strength. Go further."
          action={
            <Link
              href="/gym/workouts/new"
              aria-label="New workout"
              className="lapis-icon-button"
            >
              <Plus size={22} />
            </Link>
          }
        />
        {error && (
          <LoadErrorBanner message="Couldn't load your training. Your library and logs are still accessible below." />
        )}
        <div className="grid gap-7 lg:grid-cols-2">
          <div className="space-y-6">
            <DailySessions hero />
            <ActiveRaceCard />
            {data && (
              <>
                <section className="lapis-panel">
                  <div className="flex justify-between gap-3">
                    <h2 className="font-semibold">This week</h2>
                    <Link
                      href="/settings/training"
                      className="text-sm text-lapis-accent-400"
                    >
                      Edit target
                    </Link>
                  </div>
                  <p className="my-3 text-lapis-text-secondary">
                    <strong className="text-3xl text-white">
                      {data.weeklyCount}
                    </strong>{" "}
                    / {data.weeklyTarget} sessions
                  </p>
                  <progress
                    aria-label="Weekly training target"
                    max={data.weeklyTarget}
                    value={Math.min(data.weeklyCount, data.weeklyTarget)}
                    className="lapis-progress h-2 w-full"
                  />
                </section>
              </>
            )}
            <div className="lapis-group">
              <NavRow
                href="/gym/schedule"
                title="Schedule"
                description="Your rotation and weekly volume"
                icon={CalendarDays}
              />
              <NavRow
                href="/gym/library"
                title="Library"
                description="Exercises and saved routines"
                icon={BookOpen}
              />
              <NavRow
                href="/gym/progress"
                title="Progress"
                description="Records, weight, races and sleep"
                icon={TrendingUp}
              />
              <NavRow
                href="/nutrition"
                title="Nutrition"
                description="Meals, food library and cookbook"
                icon={Apple}
              />
            </div>
          </div>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="lapis-section mb-0">Recent sessions</h2>
              <Link
                href="/gym/workouts"
                className="inline-flex min-h-11 items-center text-sm text-lapis-accent-400"
              >
                See all
              </Link>
            </div>
            <div className="lapis-group">
              {data?.recent.map((w) => (
                <NavRow
                  key={w.id}
                  href={`/gym/workouts/${w.id}`}
                  title={w.title}
                  description={new Date(
                    `${w.date}T12:00:00`,
                  ).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })}
                  icon={History}
                />
              ))}
              {data && data.recent.length === 0 && (
                <p className="p-5 text-sm text-lapis-text-secondary">
                  Your completed sessions will appear here.
                </p>
              )}
            </div>
            <div className="lapis-group mt-6">
              <NavRow
                href="/gym/progress/races"
                title="Your races"
                description="Training plans, preparation and results"
                icon={Flag}
              />
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
