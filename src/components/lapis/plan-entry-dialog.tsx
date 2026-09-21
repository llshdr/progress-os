"use client";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getLocalDateString } from "@/lib/date";
import { changed } from "./app-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export type DayEntry = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  goal_id: string | null;
  completed_at: string | null;
  recurrence_weekdays: number[] | null;
  recurrence_end_date: string | null;
};
type GoalOption = { id: string; title: string; next_action?: string | null };
export default function PlanEntryDialog({
  onClose,
  date = getLocalDateString(),
  goal,
  goals = [],
  entry,
}: {
  onClose: () => void;
  date?: string;
  goal?: GoalOption;
  goals?: GoalOption[];
  entry?: DayEntry;
}) {
  const [title, setTitle] = useState(entry?.title ?? goal?.next_action ?? "");
  const [day, setDay] = useState(entry?.start_date ?? date);
  const [time, setTime] = useState(entry?.start_time?.slice(0, 5) ?? "");
  const [duration, setDuration] = useState(
    entry?.start_time && entry?.end_time
      ? String(
          Number(entry.end_time.slice(0, 2)) * 60 +
            Number(entry.end_time.slice(3, 5)) -
            (Number(entry.start_time.slice(0, 2)) * 60 +
              Number(entry.start_time.slice(3, 5))),
        )
      : "30",
  );
  const [goalId, setGoalId] = useState(entry?.goal_id ?? goal?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const newId = useRef<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      let end: string | null = null;
      if (time) {
        const [h, m] = time.split(":").map(Number);
        const minutes = h * 60 + m + Number(duration);
        if (minutes >= 1440)
          throw new Error(
            "Choose an earlier time, or use the detailed calendar for an event across midnight.",
          );
        end = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      }
      const values = {
        title: title.trim(),
        start_date: day,
        end_date: day,
        start_time: time || null,
        end_time: end,
        goal_id: goalId || null,
      };
      newId.current ??= crypto.randomUUID();
      const result = entry
        ? await db
            .from("calendar_entries")
            .update(values)
            .eq("id", entry.id)
            .eq("user_id", user.id)
        : await db
            .from("calendar_entries")
            .upsert(
              { id: newId.current, user_id: user.id, ...values },
              { onConflict: "id" },
            );
      if (result.error) throw result.error;
      changed();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save this step. Please retry.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!entry) return;
    setSaving(true);
    setError(null);
    try {
      const { error } = await createClient()
        .from("calendar_entries")
        .delete()
        .eq("id", entry.id);
      if (error) throw error;
      changed();
      onClose();
    } catch {
      setError("Could not delete. Please retry.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {entry
              ? "Edit your plan"
              : goal
                ? "Make room for the next step"
                : "Add to your day"}
          </DialogTitle>
          <DialogDescription>
            {goal ? goal.title : "Give it a date. Add a time if you need one."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <label className="plan-field-label">
            What will you do?
            <input
              className="lapis-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </label>
          <label className="plan-field-label">
            Date
            <input
              className="lapis-field"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="plan-field-label">
              Time · optional
              <input
                className="lapis-field"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
            {time && (
              <label className="plan-field-label">
                Make room for
                <select
                  className="lapis-field"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  {Array.from(
                    new Set([15, 30, 45, 60, 90, 120, Number(duration)]),
                  )
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} min
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          {!goal && (
            <label className="plan-field-label">
              Supports a goal
              <select
                className="lapis-field"
                aria-label="Supports a goal"
                value={goalId}
                disabled={!!entry?.completed_at}
                onChange={(e) => setGoalId(e.target.value)}
              >
                <option value="">Just an event</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {goalId && (
            <p className="text-xs leading-5 text-lapis-text-secondary">
              Completing this step in Plan adds a check-in to the goal and
              contributes to your World.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-lapis-garnet">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="lapis-primary w-full"
            disabled={saving}
          >
            {saving ? "Saving…" : entry ? "Save changes" : "Add to Plan"}
          </button>
          {entry && (
            <div className="border-t border-white/10 pt-2">
              {deleting ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span>
                    Delete this entry? Saved journal check-ins will stay.
                  </span>
                  <button
                    type="button"
                    disabled={saving}
                    className="min-h-11 text-lapis-garnet"
                    onClick={remove}
                  >
                    Delete entry
                  </button>
                  <button
                    type="button"
                    className="min-h-11"
                    onClick={() => setDeleting(false)}
                  >
                    Keep it
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="min-h-11 text-sm text-lapis-text-secondary"
                  onClick={() => setDeleting(true)}
                >
                  Delete entry
                </button>
              )}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
