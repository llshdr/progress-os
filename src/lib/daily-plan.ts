import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getLocalDateString,
  getLocalWeekStartString,
  getLocalWeekdayIndex,
} from "./date";
import {
  computeNextSlot,
  computeSlotForWeekday,
  fetchScheduleSlots,
  slotDisplayName,
  type ScheduleSlot,
} from "./gym-schedule";
import {
  slotsForWeek,
  enduranceSlotKmForWeek,
  type PhaseTemplates,
} from "./race-plan/day-template";
import type { TrainingWeekSkeleton } from "./race-plan/periodization";

export type SessionKind = "swim" | "bike" | "run" | "cardio" | "strength";
export type PlannedSession = {
  key: string;
  date: string;
  title: string;
  kind: SessionKind;
  time: string | null;
  km: number | null;
  detail: string;
  raceId: string | null;
  templateId: string | null;
  slotId: string | null;
  workoutId?: string;
  completed?: boolean;
};
export type PlanWorkout = {
  id: string;
  date: string;
  workout_type: string | null;
  completed_at: string | null;
  planned_session_key?: string | null;
  schedule_slot_id: string | null;
  template_id: string | null;
};
export type PlanRace = {
  id: string;
  race_type: string;
  location: string | null;
  race_date: string;
  goal_id?: string | null;
  target_finish_seconds: number | null;
  training_start_date: string | null;
};
export type DailyPlan = {
  date: string;
  sessions: PlannedSession[];
  unlinked: PlanWorkout[];
  active: PlanWorkout | null;
  race: PlanRace | null;
  phase: string | null;
  week: TrainingWeekSkeleton | null;
};
export const SESSION_LABELS: Record<SessionKind, string> = {
  swim: "Swim",
  bike: "Bike",
  run: "Run",
  cardio: "Cardio",
  strength: "Strength",
};

export function buildDaySessions(
  date: string,
  race: PlanRace | null,
  plan: {
    weeks: TrainingWeekSkeleton[];
    phase_templates: PhaseTemplates;
  } | null,
  gymSlot: ScheduleSlot | null,
): PlannedSession[] {
  const day = getLocalWeekdayIndex(new Date(date + "T12:00:00"));
  const week = plan?.weeks.find(
    (w) =>
      w.weekStartDate === getLocalWeekStartString(new Date(date + "T12:00:00")),
  );
  const template = week && plan?.phase_templates?.[week.phase];
  const result: PlannedSession[] = [];
  if (
    race &&
    week &&
    template &&
    date < race.race_date &&
    (!race.training_start_date || date >= race.training_start_date)
  ) {
    const slots = slotsForWeek(template, week);
    const phaseIndex =
      week.progressionIndex ??
      plan!.weeks.filter(
        (w) =>
          w.phase === week.phase &&
          Boolean(w.isAcclimation) === Boolean(week.isAcclimation) &&
          w.weekStartDate < week.weekStartDate,
      ).length;
    slots.enduranceSlots.forEach((s, i) => {
      if (s.day !== day) return;
      const km = enduranceSlotKmForWeek(
        s,
        slots.enduranceSlots.filter((x) => x.type === s.type),
        phaseIndex,
        s.type === "cardio"
          ? week.targetCardioKm
          : (week.disciplines?.[s.type]?.km ?? 0),
        s.type === "bike" ? week.disciplines?.bike.protectedKeyKm : null,
      );
      result.push({
        key: `race:${race.id}:${date}:${s.type}:${i}`,
        date,
        title: SESSION_LABELS[s.type],
        kind: s.type,
        time: s.time ?? null,
        km,
        detail: `${s.role}${slots.brickDays.includes(day) && ["bike", "run"].includes(s.type) ? " · Brick" : ""}`,
        raceId: race.id,
        templateId: null,
        slotId: null,
      });
    });
    slots.strengthSlots.forEach((s, i) => {
      if (s.day !== day) return;
      result.push({
        key: `race:${race.id}:${date}:strength:${i}`,
        date,
        title: gymSlot?.templateId
          ? slotDisplayName(gymSlot)
          : `${s.focus?.replace("_", " ") || ""} strength`.trim(),
        kind: "strength",
        time: s.time ?? gymSlot?.usualTime ?? null,
        km: null,
        detail: "Race plan · Strength",
        raceId: race.id,
        templateId: gymSlot?.templateId ?? null,
        slotId: gymSlot?.id ?? null,
      });
    });
  }
  // The same gym template fulfils the race's strength session; never add it twice.
  if (
    gymSlot &&
    date !== race?.race_date &&
    !result.some((s) => s.kind === "strength") &&
    !/\brest\b/i.test(slotDisplayName(gymSlot))
  ) {
    result.push({
      key: `gym:${gymSlot.id}:${date}`,
      date,
      title: slotDisplayName(gymSlot),
      kind: "strength",
      time: gymSlot.usualTime,
      km: null,
      detail: "Your routine",
      raceId: null,
      templateId: gymSlot.templateId,
      slotId: gymSlot.id,
    });
  }
  return result.sort((a, b) =>
    (a.time ?? "99:99").localeCompare(b.time ?? "99:99"),
  );
}

export function connectSessions(
  sessions: PlannedSession[],
  workouts: PlanWorkout[],
) {
  const used = new Set<string>();
  const connected = sessions.map((s) => {
    const match =
      workouts.find((w) => w.planned_session_key === s.key) ??
      workouts.find(
        (w) =>
          !w.planned_session_key &&
          !used.has(w.id) &&
          s.slotId &&
          w.schedule_slot_id === s.slotId,
      );
    if (!match) return s;
    used.add(match.id);
    return {
      ...s,
      workoutId: match.id,
      completed: Boolean(match.completed_at),
    };
  });
  return {
    sessions: connected,
    unlinked: workouts.filter((w) => !used.has(w.id)),
  };
}

export async function loadDailyPlan(
  db: SupabaseClient,
  date: string,
  raceId?: string,
  localToday = getLocalDateString(),
  knownUserId?: string,
): Promise<DailyPlan> {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error("Choose a valid date");
  // Server callers still verify the user here; client readers use AppProvider.
  // Every query remains owner-filtered and protected by database RLS.
  const uid = knownUserId ?? (await db.auth.getUser()).data.user?.id;
  if (!uid) throw new Error("Sign in to see your plan");
  const [settings, today, active, last, races, slots] = await Promise.all([
    db.from("user_settings").select("*").eq("user_id", uid).maybeSingle(),
    db.from("workouts").select("*").eq("user_id", uid).eq("date", date),
    db
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .lt("date", date)
      .not("completed_at", "is", null)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    raceId
      ? db.from("races").select("*").eq("user_id", uid).eq("id", raceId)
      : db
          .from("races")
          .select("*")
          .eq("user_id", uid)
          .gte("race_date", localToday)
          .is("result_duration_seconds", null)
          .order("race_date"),
    fetchScheduleSlots(db, uid, true),
  ]);
  if (
    settings.error ||
    today.error ||
    active.error ||
    last.error ||
    races.error
  )
    throw new Error("Your plan could not load. Please retry.");
  const race = (races.data?.find(
    (r) => r.id === settings.data?.active_race_id,
  ) ??
    races.data?.[0] ??
    null) as PlanRace | null;
  if (race && !race.location) {
    const raw = races.data?.find((r) => r.id === race.id);
    if (raw?.course_id) {
      const { data: course } = await db
        .from("race_courses")
        .select("name")
        .eq("id", raw.course_id)
        .maybeSingle();
      race.location = course?.name ?? null;
    }
  }
  const { data: plan, error } = race
    ? await db
        .from("race_training_plans")
        .select("*")
        .eq("race_id", race.id)
        .maybeSingle()
    : { data: null, error: null };
  if (error) throw new Error("Your race plan could not load");
  const slot =
    settings.data?.schedule_mode === "calendar"
      ? computeSlotForWeekday(
          slots,
          getLocalWeekdayIndex(new Date(date + "T12:00:00")),
        )
      : date === localToday
        ? computeNextSlot(
            slots,
            last.data
              ? {
                  templateId: last.data.template_id,
                  scheduleSlotId: last.data.schedule_slot_id,
                }
              : null,
          )
        : null;
  const rows = (today.data ?? []) as PlanWorkout[];
  const joined = connectSessions(
    buildDaySessions(date, race, plan, slot),
    rows,
  );
  const week =
    plan?.weeks?.find(
      (w: TrainingWeekSkeleton) =>
        w.weekStartDate ===
        getLocalWeekStartString(new Date(date + "T12:00:00")),
    ) ?? null;
  return {
    date,
    ...joined,
    active: active.data,
    race,
    phase: week ? (week.isAcclimation ? "Acclimation" : week.phase) : null,
    week,
  };
}

export const todayKey = () => getLocalDateString();
