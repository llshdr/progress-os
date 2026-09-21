"use client";
import Link from "next/link";
import {
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useWorld } from "./world-provider";
import { worldLevel, WORLD_XP_PER_LEVEL } from "@/lib/world-progress";
export function WorldBadge() {
  const { data } = useWorld();
  return (
    <Link href="/profile#level" className="world-level-badge">
      <ChartNoAxesColumnIncreasing size={17} />
      {data ? `Level ${worldLevel(data.xp).level}` : "Level"}
    </Link>
  );
}
export default function WorldMeter({ compact = false }: { compact?: boolean }) {
  const { data, error, refresh } = useWorld();
  if (error)
    return (
      <div className="world-meter">
        <p className="text-sm text-lapis-text-secondary">
          Your progress couldn’t refresh.
        </p>
        <button
          className="min-h-11 text-sm text-lapis-accent-400"
          onClick={refresh}
        >
          Retry progress
        </button>
      </div>
    );
  if (!data)
    return (
      <div
        className="world-meter h-24 animate-pulse"
        aria-label="Loading your level"
      />
    );
  const progress = worldLevel(data.xp);
  return (
    <section className="world-meter" id="level" aria-label="Your level">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-lapis-text-secondary">
            Your everyday effort
          </p>
          <h2 className="mt-1 text-xl font-semibold">Level {progress.level}</h2>
        </div>
        <span className="text-sm tabular-nums text-lapis-text-secondary">
          {progress.earned} / {WORLD_XP_PER_LEVEL} XP
        </span>
      </div>
      <progress
        className="lapis-progress mt-3 h-2 w-full"
        max={WORLD_XP_PER_LEVEL}
        value={progress.earned}
        aria-label="Experience toward your next level"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-lapis-text-secondary">
          {progress.next} XP to your next level
        </span>
        {data.todayXp > 0 && (
          <span className="flex items-center gap-1 text-lapis-accent-400">
            <Sparkles size={12} />+{data.todayXp} XP today
          </span>
        )}
      </div>
      {compact ? (
        <Link
          href="/profile#level"
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-lapis-accent-400"
        >
          Your progress <ChevronRight size={16} />
        </Link>
      ) : (
        <details className="mt-4 border-t border-white/10 pt-2">
          <summary className="min-h-11 cursor-pointer py-3 text-xs text-lapis-text-secondary">
            How your level grows
          </summary>
          <p className="text-xs leading-6 text-lapis-text-secondary">
            Training days +40. Nutrition and sleep logs +10 per day each. Habits
            +5 each, up to 20 per day. Goal check-ins +10 per goal per day, up
            to 30. Reached milestones +50. Completed goals +150. Editing a
            record adds no extra XP. Undoing or removing a record removes its
            contribution. Rest days never take XP away.
          </p>
          <p className="mt-2 text-xs leading-6 text-lapis-text-secondary">
            This is your personal Level throughout LAPIS. It also shapes your
            World. Each goal’s route follows its own milestones. Your activity
            and XP are private to you.
          </p>
        </details>
      )}
    </section>
  );
}
