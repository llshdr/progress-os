"use client";
import Link from "next/link";
import {
  Dumbbell,
  Play,
  Check,
  Waves,
  Bike,
  Footprints,
  ArrowUpRight,
} from "lucide-react";
import type { DailyPlan, PlannedSession } from "@/lib/daily-plan";
import { getLocalDateString } from "@/lib/date";
const icons = {
  strength: Dumbbell,
  swim: Waves,
  bike: Bike,
  run: Footprints,
  cardio: Footprints,
};
export default function TrainingHero({
  data,
  session,
  pending,
  onOpen,
}: {
  data: DailyPlan;
  session: PlannedSession | undefined;
  pending: boolean;
  onOpen: (s: PlannedSession) => void;
}) {
  const active = data.active;
  const finished =
    !active &&
    !data.sessions.some((s) => !s.completed) &&
    (data.sessions.some((s) => s.completed) ||
      data.unlinked.some((w) => w.completed_at));
  const last = data.unlinked.find((w) => w.completed_at);
  const Icon = icons[session?.kind ?? "strength"];
  const strength = finished || !session || session.kind === "strength";
  const title = active
    ? active.workout_type || "Your session"
    : finished
      ? "Session complete"
      : session?.title || "Make time to train";
  const subtitle = active
    ? "Pick up exactly where you left off."
    : finished
      ? "Your work is logged. Take a moment to enjoy it."
      : session
        ? `${session.km != null ? `${session.km.toFixed(1)} km · ` : ""}${session.time?.slice(0, 5) || "Flexible time"} · ${session.detail}`
        : "A familiar routine, or a fresh start.";
  return (
    <section className="training-hero" aria-label="Your training">
      {strength ? (
        // eslint-disable-next-line @next/next/no-img-element -- Pre-compressed art, background only.
        <img
          className="training-hero-art"
          src="/images/world/dumbbells.webp"
          alt=""
          width="1536"
          height="1024"
        />
      ) : (
        <Icon
          className="absolute -right-4 top-12 size-48 -rotate-12 text-lapis-accent-400/20"
          strokeWidth={1}
        />
      )}
      <div className="training-hero-body">
        <p className="lapis-eyebrow flex items-center gap-2">
          {finished ? <Check size={15} /> : <Icon size={15} />}Your training
        </p>
        <h2>{title}</h2>
        <p className="mt-3 max-w-72 text-sm leading-6 text-slate-300">
          {subtitle}
        </p>
        {active ? (
          <Link href={`/gym/workouts/${active.id}`} className="lapis-primary">
            <Play size={17} fill="currentColor" />
            Continue session
          </Link>
        ) : session ? (
          <button
            className="lapis-primary"
            onClick={() => onOpen(session)}
            disabled={
              pending ||
              (!session.workoutId && data.date > getLocalDateString())
            }
          >
            {session.completed ? (
              <Check size={17} />
            ) : (
              <Play size={17} fill="currentColor" />
            )}
            {pending
              ? "Opening…"
              : session.completed
                ? "View session"
                : "Start session"}
          </button>
        ) : last ? (
          <Link href={`/gym/workouts/${last.id}`} className="lapis-primary">
            <Check size={17} />
            View session
          </Link>
        ) : (
          <Link href="/gym/workouts/new" className="lapis-primary">
            <Play size={17} />
            Choose workout
          </Link>
        )}
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#07111cb3] px-6 py-3 text-xs">
        <span className="text-slate-300">
          {data.sessions.length
            ? `${data.sessions.filter((s) => s.completed).length} of ${data.sessions.length} planned sessions complete`
            : "Make the time. Keep the progress."}
        </span>
        <Link
          href={
            session?.raceId
              ? `/gym/progress/races/${session.raceId}`
              : `/plan?date=${data.date}`
          }
          className="inline-flex min-h-9 items-center gap-1 text-lapis-accent-400"
        >
          {session?.raceId ? "Your race plan" : "Your plan"}
          <ArrowUpRight size={13} />
        </Link>
      </div>
    </section>
  );
}
