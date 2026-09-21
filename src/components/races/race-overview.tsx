"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Flag,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Waves,
  Bike,
  Footprints,
  Dumbbell,
  Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trainingActuals, type TrainingWorkout } from "@/lib/training-actuals";
import { useDailyPlan } from "@/lib/use-daily-plan";
import { useUserResource } from "@/lib/use-user-resource";
import { useJourney } from "@/lib/use-journey";
import { usePageState } from "@/lib/use-page-state";
import { validDate } from "@/lib/imports/types";
import { getLocalDateString, getLocalWeekStart } from "@/lib/date";
import DailySessions from "@/components/lapis/daily-sessions";
import { changed, useLapis } from "@/components/lapis/app-provider";
import type { TrainingWeekSkeleton } from "@/lib/race-plan/periodization";
const shift = (day: string, n: number) => {
  const date = new Date(day + "T12:00:00");
  date.setDate(date.getDate() + n);
  return getLocalDateString(date);
};
const shortDate = (day: string) =>
  new Date(day + "T12:00:00").toLocaleDateString("en", {
    day: "numeric",
    month: "short",
  });
const icons = {
  swim: Waves,
  bike: Bike,
  run: Footprints,
  strength: Dumbbell,
  cardio: Activity,
};
export default function RaceOverview({
  raceId,
  weeks,
  onTab,
}: {
  raceId: string;
  weeks: TrainingWeekSkeleton[];
  onTab: (tab: "plan" | "progress" | "prep") => void;
}) {
  const [date, setDate] = usePageState("day", getLocalDateString(), validDate);
  const { data } = useDailyPlan(date, raceId);
  const { identity } = useLapis();
  const { goals } = useJourney();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weekStart = getLocalDateString(
    getLocalWeekStart(new Date(date + "T12:00:00")),
  );
  const loader = useCallback(
    async (uid: string) => {
      const db = createClient();
      const [workouts, prep, settings] = await Promise.all([
        db
          .from("workouts")
          .select(
            "id,completed_at,exercises(exercise_library(exercise_type,cardio_type),cardio_logs(distance_km,source))",
          )
          .eq("user_id", uid)
          .gte("date", weekStart)
          .lte("date", shift(weekStart, 6))
          .not("completed_at", "is", null),
        db
          .from("race_checklist_items")
          .select("title")
          .eq("race_id", raceId)
          .is("done_at", null)
          .order("display_order")
          .limit(1),
        db
          .from("user_settings")
          .select("active_race_id")
          .eq("user_id", uid)
          .maybeSingle(),
      ]);
      if (workouts.error || prep.error || settings.error)
        throw new Error("Couldn't load your week. Please retry.");
      return {
        totals: trainingActuals(
          (workouts.data ?? []) as unknown as TrainingWorkout[],
        ),
        nextPrep: prep.data?.[0]?.title,
        pinned: settings.data?.active_race_id === raceId,
      };
    },
    [raceId, weekStart],
  );
  const overview = useUserResource(`race-week:${raceId}:${weekStart}`, loader);
  async function updateGoal(id: string) {
    setSaving(true);
    setError(null);
    try {
      const result = await createClient()
        .from("races")
        .update({ goal_id: id || null })
        .eq("id", raceId);
      if (result.error) throw result.error;
      changed();
    } catch {
      setError("Couldn't link this goal. Please retry.");
    } finally {
      setSaving(false);
    }
  }
  async function pin() {
    if (!identity) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createClient()
        .from("user_settings")
        .upsert(
          { user_id: identity.id, active_race_id: raceId },
          { onConflict: "user_id" },
        );
      if (result.error) throw result.error;
      changed();
    } catch {
      setError("Couldn't change your main race. Please retry.");
    } finally {
      setSaving(false);
    }
  }
  const goalId = data?.race?.goal_id ?? "";
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(270px,1fr)]">
      <section className="min-w-0 space-y-5">
        <div className="race-week-title">
          <div>
            <p className="lapis-eyebrow">Your training week</p>
            <h2 className="mt-2 text-xl font-semibold">
              {shortDate(weekStart)} – {shortDate(shift(weekStart, 6))}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="lapis-icon-button"
              onClick={() => setDate(shift(date, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="min-h-11 px-2 text-sm text-lapis-text-secondary"
              onClick={() => setDate(getLocalDateString())}
            >
              Today
            </button>
            <button
              className="lapis-icon-button"
              onClick={() => setDate(shift(date, 7))}
              aria-label="Next week"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="lapis-week-strip" aria-label="Select training day">
          {Array.from({ length: 7 }, (_, i) => shift(weekStart, i)).map(
            (day) => (
              <button
                key={day}
                onClick={() => setDate(day)}
                aria-pressed={date === day}
                aria-label={new Date(day + "T12:00:00").toLocaleDateString(
                  "en",
                  { weekday: "long", day: "numeric", month: "long" },
                )}
              >
                <span className="text-[11px]">
                  {new Date(day + "T12:00:00").toLocaleDateString("en", {
                    weekday: "short",
                  })}
                </span>
                <strong className="text-lg">{Number(day.slice(-2))}</strong>
              </button>
            ),
          )}
        </div>
        <DailySessions date={date} raceId={raceId} />
        <div className="lapis-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="lapis-eyebrow">Selected phase</p>
              <h2 className="mt-2 text-xl font-semibold capitalize">
                {data?.phase || "Outside your saved plan"}
              </h2>
            </div>
            <button
              className="min-h-11 text-sm text-lapis-accent-400"
              onClick={() => onTab("plan")}
            >
              Full plan →
            </button>
          </div>
          <p className="my-4 text-sm leading-6 text-lapis-text-secondary">
            {(
              data?.week as
                (TrainingWeekSkeleton & { focusNote?: string }) | null
            )?.focusNote || "Open your plan to see the full route to race day."}
          </p>
          <div
            className="flex flex-wrap gap-2"
            aria-label="Explore training phases"
          >
            {weeks
              .filter(
                (w, i) =>
                  i === 0 ||
                  w.phase !== weeks[i - 1].phase ||
                  w.isAcclimation !== weeks[i - 1].isAcclimation,
              )
              .map((w) => (
                <button
                  key={w.weekStartDate}
                  onClick={() => setDate(w.weekStartDate)}
                  aria-pressed={
                    data?.week?.phase === w.phase &&
                    data?.week?.isAcclimation === w.isAcclimation
                  }
                  className="min-h-11 rounded-xl border border-lapis-border px-3 text-xs capitalize text-lapis-text-secondary aria-pressed:bg-lapis-accent-500/15 aria-pressed:text-lapis-accent-400"
                >
                  {w.isAcclimation ? "Acclimation" : w.phase}
                </button>
              ))}
          </div>
        </div>
      </section>
      <aside className="min-w-0 space-y-5">
        <section className="lapis-panel">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Weekly volume</h2>
            <button
              className="min-h-11 text-xs text-lapis-accent-400"
              onClick={() => onTab("progress")}
            >
              Trends →
            </button>
          </div>
          {(data?.week?.disciplines
            ? (["swim", "bike", "run", "strength"] as const)
            : (["cardio", "strength"] as const)
          ).map((kind) => {
            const Icon = icons[kind];
            const target =
              kind === "strength"
                ? data?.week?.targetStrengthSessions
                : kind === "cardio"
                  ? data?.week?.targetCardioKm
                  : data?.week?.disciplines?.[kind]?.km;
            const actual = overview.data?.totals[kind];
            return (
              <div className="race-metric" key={kind}>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm capitalize text-lapis-text-secondary">
                    <Icon size={17} />
                    {kind}
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {actual != null ? Number(actual.toFixed(1)) : "—"}
                    <span className="font-normal text-lapis-text-secondary">
                      {target != null ? ` / ${Number(target.toFixed(1))}` : ""}{" "}
                      {kind === "strength" ? "sessions" : "km"}
                    </span>
                  </span>
                </div>
                {actual != null && target != null && target > 0 && (
                  <progress
                    aria-label={`${kind} completed against weekly plan`}
                    className="lapis-progress mt-3 h-1.5 w-full"
                    max={target}
                    value={Math.min(actual, target)}
                  />
                )}
              </div>
            );
          })}
          <p className="mt-4 text-xs leading-5 text-lapis-text-tertiary">
            Completed training from all your sessions. Commutes excluded.
            Targets follow your saved plan.
          </p>
          {overview.error && (
            <p role="alert" className="mt-3 text-sm text-lapis-garnet">
              {overview.error}
              <button
                onClick={overview.refresh}
                className="ml-2 min-h-11 underline"
              >
                Retry
              </button>
            </p>
          )}
        </section>
        <section className="lapis-panel">
          <p className="lapis-eyebrow flex items-center gap-2">
            <Flag size={14} />
            Before the start
          </p>
          <h2 className="mt-3 text-lg font-semibold">Race preparation</h2>
          <p className="mt-2 text-sm leading-6 text-lapis-text-secondary">
            {overview.data?.nextPrep ||
              "Your checklist, equipment and race-day details."}
          </p>
          <button
            onClick={() => onTab("prep")}
            className="mt-3 flex min-h-11 items-center gap-2 text-sm text-lapis-accent-400"
            aria-label="Open preparation"
          >
            Open checklist
            <ArrowUpRight size={16} />
          </button>
          <div className="mt-2 border-t border-lapis-border-subtle pt-2">
            <Link
              href={`/gym/progress/races/${raceId}/budget`}
              className="flex min-h-11 items-center text-sm text-lapis-text-secondary"
            >
              Budget & expenses →
            </Link>
            <Link
              href="/settings/connections"
              className="flex min-h-11 items-center text-sm text-lapis-text-secondary"
            >
              Import a booking or receipt →
            </Link>
          </div>
        </section>
        <details className="lapis-panel">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">
            Race options
          </summary>
          <button
            disabled={saving || overview.data?.pinned}
            onClick={pin}
            className="mt-2 flex min-h-11 items-center gap-2 text-sm text-lapis-accent-400"
          >
            {overview.data?.pinned ? <Check size={16} /> : <Flag size={16} />}{" "}
            {overview.data?.pinned
              ? "Main race on Today"
              : "Make this my main race"}
          </button>
          <label className="mt-3 block text-sm">
            Linked goal
            <select
              value={goalId}
              disabled={saving || !data}
              onChange={(e) => updateGoal(e.target.value)}
              className="lapis-field mt-2"
            >
              <option value="">No linked goal</option>
              {goals
                .filter((g) => g.status !== "archived")
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
            </select>
          </label>
          {goalId && (
            <Link
              href={`/goals/${goalId}`}
              className="mt-2 flex min-h-11 items-center gap-2 text-sm text-lapis-accent-400"
            >
              Open linked goal
              <ArrowUpRight size={15} />
            </Link>
          )}
        </details>
        {error && (
          <p role="alert" className="text-sm text-lapis-garnet">
            {error}
          </p>
        )}
      </aside>
    </div>
  );
}
