"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Play,
  Waves,
  Bike,
  Footprints,
  Dumbbell,
  Activity,
  Link2,
} from "lucide-react";
import { useDailyPlan } from "@/lib/use-daily-plan";
import { getLocalDateString } from "@/lib/date";
import type { PlannedSession } from "@/lib/daily-plan";
import { changed } from "./app-provider";
import TrainingHero from "./training-hero";
const icons = {
  swim: Waves,
  bike: Bike,
  run: Footprints,
  strength: Dumbbell,
  cardio: Activity,
};
export default function DailySessions({
  date = getLocalDateString(),
  raceId,
  compact = false,
  hero = false,
}: {
  date?: string;
  raceId?: string;
  compact?: boolean;
  hero?: boolean;
}) {
  const { data, error, refresh } = useDailyPlan(date, raceId);
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const router = useRouter();
  const featured =
    data?.sessions.find((s) => s.workoutId && !s.completed) ??
    data?.sessions.find((s) => !s.completed) ??
    data?.sessions[0];
  async function open(s: PlannedSession, workoutId?: string) {
    if (s.workoutId && !workoutId) {
      router.push(`/gym/workouts/${s.workoutId}`);
      return;
    }
    setPending(s.key);
    setFailure(null);
    try {
      const res = await fetch("/api/plan/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: s.key,
          date,
          today: getLocalDateString(),
          raceId: s.raceId,
          workoutId,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      changed();
      if (workoutId) {
        setLinking(null);
        refresh();
      } else router.push(`/gym/workouts/${result.workoutId}`);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Could not open session");
    } finally {
      setPending(null);
    }
  }
  if (hero && !data && !error)
    return (
      <section
        className="training-hero p-6"
        aria-label="Loading your training"
        aria-busy="true"
      >
        <div className="h-3 w-24 rounded bg-lapis-surface-2 motion-safe:animate-pulse" />
        <div className="mt-5 h-9 w-3/4 rounded bg-lapis-surface-2 motion-safe:animate-pulse" />
        <div className="mt-4 h-4 w-2/3 rounded bg-lapis-surface-2 motion-safe:animate-pulse" />
        <div className="mt-8 h-11 w-44 rounded-xl bg-lapis-surface-2 motion-safe:animate-pulse" />
      </section>
    );
  return (
    <section
      className={hero ? "space-y-4" : compact ? "" : "lapis-panel"}
      aria-label="Daily sessions"
    >
      {hero && data ? (
        <TrainingHero
          data={data}
          session={featured}
          pending={pending !== null}
          onOpen={open}
        />
      ) : (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="lapis-eyebrow">
              {date === getLocalDateString()
                ? "Today’s sessions"
                : "Planned sessions"}
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              {data
                ? data.sessions.length
                  ? `${data.sessions.filter((s) => s.completed).length} of ${data.sessions.length} planned sessions complete`
                  : "A little space in your day"
                : "Your daily plan"}
            </h2>
            {data?.phase && (
              <p className="mt-1 text-sm capitalize text-lapis-text-secondary">
                {data.phase} phase
              </p>
            )}
          </div>
          {!raceId && (
            <Link
              href={`/plan?date=${date}`}
              className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-sm text-lapis-accent-400"
            >
              Full plan
            </Link>
          )}
        </div>
      )}
      {error && (
        <div role="alert">
          <p className="text-sm text-lapis-text-secondary">{error}</p>
          <button
            onClick={refresh}
            className="min-h-11 text-sm text-lapis-accent-400"
          >
            Retry
          </button>
        </div>
      )}
      {!data && !error && (
        <div className="h-24 animate-pulse rounded-xl bg-lapis-surface-2" />
      )}
      {data && (
        <div className="space-y-3">
          {hero &&
            featured &&
            !featured.workoutId &&
            data.unlinked.some((w) => !w.planned_session_key) && (
              <div className="px-2">
                <button
                  className="inline-flex min-h-11 items-center gap-2 text-sm text-lapis-text-secondary"
                  onClick={() =>
                    setLinking(linking === featured.key ? null : featured.key)
                  }
                >
                  <Link2 size={15} />
                  Already logged {featured.title.toLowerCase()}? Link session
                </button>
                {linking === featured.key &&
                  data.unlinked
                    .filter((w) => !w.planned_session_key)
                    .map((w) => (
                      <button
                        key={w.id}
                        disabled={pending !== null}
                        onClick={() => open(featured, w.id)}
                        className="mt-2 block min-h-11 w-full rounded-lg bg-lapis-surface-2 px-3 text-left text-sm"
                      >
                        {w.workout_type || "Workout"} ·{" "}
                        {w.completed_at ? "Completed" : "In progress"}
                      </button>
                    ))}
              </div>
            )}
          {data.sessions
            .filter((s) => !hero || s.key !== featured?.key)
            .map((s) => {
              const Icon = icons[s.kind];
              return (
                <div
                  key={s.key}
                  className="rounded-2xl border border-lapis-border-subtle bg-lapis-bg/25 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${s.completed ? "bg-lapis-jade/10 text-lapis-jade" : "bg-lapis-accent-500/10 text-lapis-accent-400"}`}
                    >
                      {s.completed ? <Check size={20} /> : <Icon size={20} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block capitalize">{s.title}</strong>
                      <span className="text-xs capitalize text-lapis-text-secondary">
                        {s.time?.slice(0, 5) || "Flexible time"} ·{" "}
                        {s.km != null ? `${s.km.toFixed(1)} km · ` : ""}
                        {s.detail}
                      </span>
                    </div>
                    <button
                      onClick={() => open(s)}
                      disabled={
                        pending !== null ||
                        (!s.workoutId && date > getLocalDateString())
                      }
                      className="lapis-session-action"
                      aria-label={`${s.completed ? "View" : s.workoutId ? "Resume" : "Start"} ${s.title}`}
                    >
                      {pending === s.key ? (
                        "…"
                      ) : s.completed ? (
                        "View"
                      ) : s.workoutId ? (
                        "Resume"
                      ) : (
                        <Play size={17} />
                      )}
                    </button>
                  </div>
                  {!s.workoutId &&
                    data.unlinked.some((w) => !w.planned_session_key) && (
                      <button
                        className="mt-2 inline-flex min-h-9 items-center gap-2 text-xs text-lapis-text-secondary"
                        onClick={() =>
                          setLinking(linking === s.key ? null : s.key)
                        }
                      >
                        <Link2 size={13} />
                        Already logged? Link session
                      </button>
                    )}
                  {linking === s.key &&
                    data.unlinked
                      .filter((w) => !w.planned_session_key)
                      .map((w) => (
                        <button
                          key={w.id}
                          disabled={pending !== null}
                          onClick={() => open(s, w.id)}
                          className="mt-2 block min-h-11 w-full rounded-lg bg-lapis-surface-2 px-3 text-left text-sm"
                        >
                          {w.workout_type || "Workout"} ·{" "}
                          {w.completed_at ? "Completed" : "In progress"}
                        </button>
                      ))}
                </div>
              );
            })}
          {data.sessions.length === 0 && !hero && (
            <p className="py-3 text-sm text-lapis-text-secondary">
              No training scheduled for this day. Make room for recovery or add
              a session.
            </p>
          )}
          {data.unlinked.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs text-lapis-text-tertiary">
                Also logged this day
              </p>
              {data.unlinked.map((w) => (
                <Link
                  key={w.id}
                  href={`/gym/workouts/${w.id}`}
                  className="flex min-h-11 items-center justify-between text-sm"
                >
                  <span>{w.workout_type || "Workout"}</span>
                  <span className="text-lapis-text-secondary">
                    {w.completed_at ? "Completed" : "In progress"} →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      {failure && (
        <p role="alert" className="mt-3 text-sm text-lapis-garnet">
          {failure}
        </p>
      )}
    </section>
  );
}
