"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowUpRight,
  CalendarDays,
  Mountain,
} from "lucide-react";
import AppLayout from "@/components/app-layout";
import DailySessions from "@/components/lapis/daily-sessions";
import PlanEntryDialog, {
  type DayEntry,
} from "@/components/lapis/plan-entry-dialog";
import { changed } from "@/components/lapis/app-provider";
import { createClient } from "@/lib/supabase/client";
import { getLocalDateString, getLocalWeekStart } from "@/lib/date";
import { entryAppliesToDate } from "@/lib/calendar";
import { useJourney } from "@/lib/use-journey";
import { usePageState } from "@/lib/use-page-state";
import { localTimezone } from "@/lib/world-progress";
import { habitAppliesToDate, type Habit } from "@/lib/habits";
function shift(date: string, n: number) {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return getLocalDateString(d);
}
function applies(e: DayEntry, date: string) {
  return entryAppliesToDate(
    {
      id: e.id,
      title: e.title,
      startDate: e.start_date,
      endDate: e.end_date,
      startTime: e.start_time,
      endTime: e.end_time,
      note: e.note,
      recurrenceWeekdays: e.recurrence_weekdays,
      recurrenceEndDate: e.recurrence_end_date,
    },
    date,
  );
}
const subscribeHydration = () => () => {};
export default function PlanPage() {
  // A day plan uses the device's calendar day, which can differ from the server's.
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  return hydrated ? (
    <DayPlan />
  ) : (
    <AppLayout>
      <div className="lapis-page">
        <h1 className="lapis-title">Plan</h1>
        <div
          className="mt-6 h-72 animate-pulse rounded-3xl bg-lapis-surface-1"
          aria-label="Loading your day"
        />
      </div>
    </AppLayout>
  );
}
function DayPlan() {
  const today = getLocalDateString();
  const [date, setDate] = usePageState(
    "date",
    today,
    (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      getLocalDateString(new Date(v + "T12:00:00")) === v,
  );
  const journey = useJourney();
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<{ habit_id: string; id: string }[]>([]);
  const [revision, setRevision] = useState(0);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    entry?: DayEntry;
    goal?: { id: string; title: string; next_action: string | null };
  } | null>(null);
  useEffect(() => {
    const refresh = () => setRevision((v) => v + 1);
    window.addEventListener("lapis:changed", refresh);
    return () => window.removeEventListener("lapis:changed", refresh);
  }, []);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const db = createClient();
        const {
          data: { user },
        } = await db.auth.getUser();
        if (!user) throw new Error("Please sign in again.");
        const [events, habitRows, habitLogs] = await Promise.all([
          db
            .from("calendar_entries")
            .select("*")
            .eq("user_id", user.id)
            .order("start_time", { ascending: true, nullsFirst: false }),
          db
            .from("habits")
            .select("id,name,recurrence_weekdays,usual_time")
            .eq("user_id", user.id),
          db
            .from("habit_logs")
            .select("id,habit_id")
            .eq("user_id", user.id)
            .eq("date", date),
        ]);
        if (events.error || habitRows.error || habitLogs.error)
          throw new Error("Your day could not load. Please retry.");
        if (live) {
          setEntries(events.data ?? []);
          setHabits(
            (habitRows.data ?? []).map((h) => ({
              id: h.id,
              name: h.name,
              recurrenceWeekdays: h.recurrence_weekdays,
              usualTime: h.usual_time,
            })),
          );
          setLogs(habitLogs.data ?? []);
          setLoadedDate(date);
          setError(null);
        }
      } catch (e) {
        if (live)
          setError(e instanceof Error ? e.message : "Your day could not load.");
      }
    })();
    return () => {
      live = false;
    };
  }, [date, revision]);
  async function complete(entry: DayEntry) {
    setPending(entry.id);
    setError(null);
    try {
      const { error } = await createClient().rpc("set_goal_step_done", {
        p_entry: entry.id,
        p_done: !entry.completed_at,
        p_timezone: localTimezone(),
      });
      if (error) throw error;
      changed();
    } catch {
      setError("Could not save that step. Please retry.");
    } finally {
      setPending(null);
    }
  }
  async function toggleHabit(habit: Habit) {
    setPending(habit.id);
    setError(null);
    try {
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error();
      const log = logs.find((l) => l.habit_id === habit.id);
      const result = log
        ? await db.from("habit_logs").delete().eq("id", log.id)
        : await db
            .from("habit_logs")
            .upsert(
              { user_id: user.id, habit_id: habit.id, date },
              { onConflict: "habit_id,date" },
            );
      if (result.error) throw result.error;
      changed();
    } catch {
      setError("Could not save the habit. Please retry.");
    } finally {
      setPending(null);
    }
  }
  const agenda = entries.filter((e) => applies(e, date));
  const start = getLocalDateString(
    getLocalWeekStart(new Date(date + "T12:00:00")),
  );
  const dayHabits = habits.filter((h) => habitAppliesToDate(h, date));
  const focused = journey.goals
    .filter(
      (g) =>
        g.status === "active" &&
        (g.attention ?? "focus") === "focus" &&
        (!g.depends_on_goal_id ||
          journey.goals.some(
            (p) => p.id === g.depends_on_goal_id && p.status === "done",
          )) &&
        !agenda.some((e) => e.goal_id === g.id),
    )
    .slice(0, 3);
  return (
    <AppLayout>
      <div className="lapis-page">
        <header className="plan-heading">
          <div>
            <h1 className="lapis-title">Plan</h1>
            <p className="lapis-subtitle">Room for what matters.</p>
          </div>
          <button className="lapis-primary" onClick={() => setEditor({})}>
            <Plus size={18} />
            <span>Add</span>
          </button>
        </header>
        <div className="plan-day mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">
              {new Date(date + "T12:00:00").toLocaleDateString("en", {
                month: "long",
                year: "numeric",
              })}
            </p>
            <div className="plan-date-controls">
              <button
                className="lapis-icon-button"
                aria-label="Previous week"
                onClick={() => setDate(shift(date, -7))}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                className="min-h-11 px-2 text-sm text-lapis-accent-400"
                onClick={() => setDate(today)}
              >
                Today
              </button>
              <button
                className="lapis-icon-button"
                aria-label="Next week"
                onClick={() => setDate(shift(date, 7))}
              >
                <ChevronRight size={17} />
              </button>
              <label>
                <span className="sr-only">Choose date</span>
                <input
                  type="date"
                  className="min-h-11 max-w-44 rounded-xl border border-lapis-border bg-lapis-surface-2 px-3 text-sm"
                  value={date}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                />
              </label>
            </div>
          </div>
          <div className="lapis-week-strip">
            {Array.from({ length: 7 }, (_, i) => {
              const d = shift(start, i);
              const parsed = new Date(d + "T12:00:00");
              return (
                <button
                  key={d}
                  onClick={() => setDate(d)}
                  aria-pressed={d === date}
                  aria-label={parsed.toLocaleDateString("en", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                >
                  <span className="text-xs">
                    {parsed.toLocaleDateString("en", { weekday: "short" })}
                  </span>
                  <strong>{parsed.getDate()}</strong>
                </button>
              );
            })}
          </div>
        </div>
        {error && (
          <div role="alert" className="mb-5 text-sm text-lapis-garnet">
            {error}
            <button
              onClick={() => setRevision((v) => v + 1)}
              className="ml-3 min-h-11 underline"
            >
              Retry
            </button>
          </div>
        )}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="lapis-panel">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">
                  {date === today
                    ? "Today"
                    : new Date(date + "T12:00:00").toLocaleDateString("en", {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      })}
                </h2>
                <Link
                  href={`/plan/calendar?date=${date}`}
                  className="inline-flex min-h-11 items-center gap-2 text-xs text-lapis-text-secondary"
                >
                  <CalendarDays size={15} />
                  Timeline
                </Link>
              </div>
              {loadedDate !== date ? (
                <div className="h-28 animate-pulse rounded-2xl bg-lapis-surface-2" />
              ) : agenda.length ? (
                agenda.map((entry) => {
                  const goal = journey.goals.find(
                    (g) => g.id === entry.goal_id,
                  );
                  const complex =
                    entry.start_date !== entry.end_date ||
                    (entry.recurrence_weekdays?.length ?? 0) > 0;
                  return (
                    <div key={entry.id} className="plan-entry">
                      <span className="plan-time">
                        {entry.start_time?.slice(0, 5) || "Anytime"}
                      </span>
                      {entry.goal_id && (
                        <button
                          className="route-check"
                          aria-pressed={!!entry.completed_at}
                          disabled={pending !== null || date > today}
                          onClick={() => complete(entry)}
                          aria-label={`${entry.completed_at ? "Undo" : "Complete"} ${entry.title}`}
                        >
                          {entry.completed_at ? (
                            <Check size={18} />
                          ) : (
                            <span className="size-3 rounded-full border border-current" />
                          )}
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        {complex ? (
                          <Link
                            href={`/plan/calendar?date=${date}`}
                            className="text-left text-sm font-medium"
                          >
                            {entry.title}
                          </Link>
                        ) : (
                          <button
                            className={`min-h-9 text-left text-sm font-medium ${entry.completed_at ? "text-lapis-text-secondary" : ""}`}
                            onClick={() => setEditor({ entry })}
                          >
                            {entry.title}
                          </button>
                        )}
                        {goal && (
                          <Link
                            href={`/goals/${goal.id}`}
                            className="mt-1 block text-xs text-lapis-accent-400"
                          >
                            {goal.title} ↗
                          </Link>
                        )}
                        {entry.end_time && (
                          <p className="text-xs text-lapis-text-secondary">
                            Until {entry.end_time.slice(0, 5)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-5">
                  <p className="text-sm text-lapis-text-secondary">
                    A little breathing room.
                  </p>
                  <button
                    onClick={() => setEditor({})}
                    className="mt-2 min-h-11 text-sm text-lapis-accent-400"
                  >
                    Add something that matters →
                  </button>
                </div>
              )}
            </section>
            <div id="day-sessions" className="lapis-panel scroll-mt-6">
              <DailySessions date={date} compact />
            </div>
            {dayHabits.length > 0 && (
              <section className="lapis-panel">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Your rhythms</h2>
                  <Link
                    href={`/plan/calendar?date=${date}`}
                    className="min-h-11 py-3 text-xs text-lapis-text-secondary"
                  >
                    Manage habits
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dayHabits.map((h) => {
                    const done = logs.some((l) => l.habit_id === h.id);
                    return (
                      <button
                        key={h.id}
                        className="lapis-secondary"
                        aria-pressed={done}
                        disabled={
                          pending !== null ||
                          date > today ||
                          loadedDate !== date
                        }
                        onClick={() => toggleHabit(h)}
                      >
                        {done ? (
                          <Check size={16} className="text-lapis-jade" />
                        ) : (
                          <span className="size-4 rounded-full border border-lapis-border-strong" />
                        )}
                        {h.name}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
          <aside className="space-y-5">
            {focused.length > 0 && (
              <section className="lapis-panel">
                <h2 className="text-lg font-semibold">
                  A step toward your world
                </h2>
                <p className="mt-2 text-xs leading-5 text-lapis-text-secondary">
                  Choose what deserves space in this day.
                </p>
                {focused.map((g) => (
                  <div
                    key={g.id}
                    className="mt-4 border-t border-white/10 pt-4"
                  >
                    <Link
                      href={`/goals/${g.id}`}
                      className="flex items-center gap-2 text-xs text-lapis-text-secondary"
                    >
                      <Mountain size={14} />
                      {g.title}
                      <ArrowUpRight size={13} />
                    </Link>
                    <p className="mt-2 text-sm font-medium">
                      {g.next_action || "Define the next small step"}
                    </p>
                    <button
                      onClick={() => setEditor({ goal: g })}
                      className="mt-1 min-h-11 text-xs text-lapis-accent-400"
                    >
                      Make time for it →
                    </button>
                  </div>
                ))}
              </section>
            )}
            <div className="flex flex-wrap gap-3 text-xs">
              <Link
                href="/gym/schedule"
                className="min-h-11 py-3 text-lapis-text-secondary"
              >
                Training schedule ↗
              </Link>
              <Link
                href={`/plan/calendar?date=${date}`}
                className="min-h-11 py-3 text-lapis-text-secondary"
              >
                Calendar & travel tools ↗
              </Link>
            </div>
          </aside>
        </div>
        {editor && (
          <PlanEntryDialog
            date={date}
            entry={editor.entry}
            goal={editor.goal}
            goals={journey.goals.filter(
              (g) => g.status === "active" || g.id === editor.entry?.goal_id,
            )}
            onClose={() => setEditor(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
