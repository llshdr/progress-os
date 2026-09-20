"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchScheduleSlots,
  computeNextSlot,
  computeSlotForWeekday,
  slotDisplayName,
} from "@/lib/gym-schedule";
import {
  getLocalDateString,
  getLocalWeekStartString,
  getLocalWeekdayIndex,
} from "@/lib/date";
import { filterWorkoutsCountingTowardGoal } from "@/lib/workout-goal";

type Workout = {
  id: string;
  date: string;
  workout_type: string | null;
  template_id: string | null;
  schedule_slot_id: string | null;
  completed_at: string | null;
  workout_templates: { name: string } | null;
};
export type TrainingOverview = {
  title: string;
  subtitle: string;
  href: string;
  action: string;
  active: boolean;
  weeklyCount: number;
  weeklyTarget: number;
  recent: { id: string; title: string; date: string }[];
  deload: boolean;
};
export function useTrainingOverview() {
  const [data, setData] = useState<TrainingOverview | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const db = createClient();
        const {
          data: { user },
        } = await db.auth.getUser();
        if (!user) throw new Error("Sign in required");
        const [settings, workouts, weekly, slots] = await Promise.all([
          db
            .from("user_settings")
            .select(
              "weekly_workout_goal, count_cardio_toward_workout_goal, schedule_mode, active_deload_started_at",
            )
            .eq("user_id", user.id)
            .maybeSingle(),
          db
            .from("workouts")
            .select(
              "id, date, workout_type, template_id, schedule_slot_id, completed_at, workout_templates(name)",
            )
            .eq("user_id", user.id)
            .order("date", { ascending: false })
            .order("started_at", { ascending: false })
            .limit(20),
          db
            .from("workouts")
            .select("id")
            .eq("user_id", user.id)
            .gte("date", getLocalWeekStartString())
            .lte("date", getLocalDateString())
            .not("completed_at", "is", null),
          fetchScheduleSlots(db, user.id),
        ]);
        if (workouts.error || weekly.error || settings.error)
          throw new Error("Training could not load");
        const rows = (workouts.data ?? []) as unknown as Workout[];
        // An unfinished session may be older than the recent history window.
        const activeResult = await db
          .from("workouts")
          .select("id, workout_type, workout_templates(name)")
          .eq("user_id", user.id)
          .is("completed_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeResult.error)
          throw new Error("Active workout could not load");
        const active = activeResult.data as unknown as Pick<
          Workout,
          "id" | "workout_type" | "workout_templates"
        > | null;
        const last = rows.find((w) => w.completed_at);
        const slot =
          settings.data?.schedule_mode === "calendar"
            ? computeSlotForWeekday(slots, getLocalWeekdayIndex())
            : computeNextSlot(
                slots,
                last
                  ? {
                      templateId: last.template_id,
                      scheduleSlotId: last.schedule_slot_id,
                    }
                  : null,
              );
        const trainedToday = last?.date === getLocalDateString();
        const next = !trainedToday ? slot : null;
        const count = await filterWorkoutsCountingTowardGoal(
          db,
          (weekly.data ?? []).map((w) => w.id),
          settings.data?.count_cardio_toward_workout_goal ?? true,
        );
        const name = (w: Pick<Workout, "workout_type" | "workout_templates">) =>
          w.workout_templates?.name || w.workout_type || "Workout";
        if (alive)
          setData({
            title: active
              ? name(active)
              : next
                ? slotDisplayName(next)
                : trainedToday
                  ? "Session complete"
                  : "Make time to train",
            subtitle: active
              ? "Your session is in progress"
              : next
                ? (next.usualTime ? `${next.usualTime.slice(0, 5)} · ` : "") +
                  (settings.data?.schedule_mode === "calendar"
                    ? "On your schedule"
                    : "Next in your rotation")
                : trainedToday
                  ? "Your training is logged for today."
                  : "Choose a saved routine or start your own.",
            href: active
              ? `/gym/workouts/${active.id}`
              : next?.templateId
                ? `/gym/workouts/new?slot=${next.id}`
                : next || trainedToday
                  ? "/gym/schedule"
                  : "/gym/workouts/new",
            action: active
              ? "Continue session"
              : next?.templateId
                ? "Start session"
                : next || trainedToday
                  ? "View schedule"
                  : "Choose workout",
            active: Boolean(active),
            weeklyCount: count.size,
            weeklyTarget: settings.data?.weekly_workout_goal || 5,
            recent: rows
              .filter((w) => w.completed_at)
              .slice(0, 3)
              .map((w) => ({ id: w.id, title: name(w), date: w.date })),
            deload: Boolean(settings.data?.active_deload_started_at),
          });
      } catch {
        if (alive) setError(true);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);
  return { data, error, loading: !data && !error };
}
