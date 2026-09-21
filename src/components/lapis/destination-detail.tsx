"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Flag, ArrowUpRight, Mountain } from "lucide-react";
import { type JourneyGoal, worldStyle, WORLD_LABELS } from "@/lib/journey";
import { createClient } from "@/lib/supabase/client";
import { changed } from "./app-provider";
export default function DestinationDetail({
  goal,
  races,
}: {
  goal: JourneyGoal;
  races: {
    id: string;
    goal_id: string | null;
    race_type: string;
    location: string | null;
  }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function update(values: Record<string, string>) {
    setSaving(true);
    setError(null);
    const { error } = await createClient()
      .from("goals")
      .update(values)
      .eq("id", goal.id);
    if (error)
      setError("Could not save. Your goal is unchanged. Please retry.");
    else changed();
    setSaving(false);
  }
  const milestones = goal.milestones ?? [];
  return (
    <div className="space-y-6">
      <div>
        <p className="lapis-eyebrow">
          {WORLD_LABELS[worldStyle(goal)]} ·{" "}
          {goal.status === "done" ? "Reached" : "Your destination"}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          {goal.title}
        </h2>
        {goal.description && (
          <p className="mt-3 text-sm leading-relaxed text-lapis-text-secondary">
            {goal.description}
          </p>
        )}
      </div>
      <div className="rounded-2xl border border-lapis-accent-400/20 bg-lapis-accent-500/5 p-4">
        <p className="text-xs text-lapis-accent-400">Your next step</p>
        <p className="mt-2 font-medium">
          {goal.next_action || "Choose one concrete action to move forward."}
        </p>
        <Link
          href={`/goals/${goal.id}`}
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-lapis-accent-400"
        >
          {goal.next_action ? "Open goal & log progress" : "Set next step"}
          <ArrowUpRight size={16} />
        </Link>
      </div>
      {races
        .filter((r) => r.goal_id === goal.id)
        .map((r) => (
          <Link
            key={r.id}
            href={`/gym/progress/races/${r.id}`}
            className="flex min-h-14 items-center gap-3 rounded-xl bg-lapis-surface-2 px-4 text-sm"
          >
            <Flag size={18} className="text-lapis-accent-400" />
            <span className="flex-1 capitalize">
              {r.race_type} {r.location}
            </span>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      <div>
        <h3 className="mb-3 flex items-center justify-between font-medium">
          <span>Along the route</span>
          <span className="text-xs text-lapis-text-secondary">
            {milestones.filter((m) => m.status === "done").length} /{" "}
            {milestones.length}
          </span>
        </h3>
        {milestones.length ? (
          milestones.map((m) => (
            <Link
              key={m.id}
              href={`/goals/milestones/${m.id}/edit`}
              className="flex min-h-14 items-start gap-3 border-l border-lapis-border py-3 pl-4"
            >
              <span
                className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border ${m.status === "done" ? "border-lapis-jade text-lapis-jade" : "border-lapis-border-strong"}`}
              >
                {m.status === "done" && <Check size={12} />}
              </span>
              <span>
                <strong className="block text-sm font-medium">{m.title}</strong>
                <span className="text-xs text-lapis-text-secondary">
                  {m.status === "done"
                    ? "Reached"
                    : m.next_action || "Open milestone"}
                </span>
              </span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-lapis-text-secondary">
            Break your ambition into meaningful milestones. They’ll appear along
            this route.
          </p>
        )}
        <Link
          href={`/goals/milestones/new?goalId=${goal.id}`}
          className="mt-2 inline-flex min-h-11 items-center text-sm text-lapis-accent-400"
        >
          Add milestone
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-lapis-text-secondary">
          Attention
          <select
            aria-label="Attention"
            disabled={saving || goal.status === "done"}
            value={goal.attention ?? "focus"}
            onChange={(e) => update({ attention: e.target.value })}
            className="lapis-field mt-2"
          >
            <option value="focus">Focus now</option>
            <option value="later">On the horizon</option>
            <option value="paused">Paused</option>
          </select>
        </label>
        <label className="text-xs text-lapis-text-secondary">
          Landscape
          <select
            aria-label="Landscape"
            disabled={saving}
            value={worldStyle(goal)}
            onChange={(e) => update({ world_style: e.target.value })}
            className="lapis-field mt-2"
          >
            <option value="summit">Summit</option>
            <option value="basecamp">Settlement</option>
            <option value="trail">Trail</option>
          </select>
        </label>
      </div>
      {goal.status !== "done" && (
        <button
          disabled={saving}
          onClick={() => update({ status: "done" })}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-lapis-text-secondary"
        >
          <Mountain size={16} />
          Mark destination reached
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-lapis-garnet">
          {error}
        </p>
      )}
    </div>
  );
}
