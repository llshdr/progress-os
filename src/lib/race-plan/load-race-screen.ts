import { createClient } from "@/lib/supabase/client";
import { getLocalDateString } from "@/lib/date";
import { userResource } from "@/lib/client-resource";
import { fetchCardioActivity } from "@/lib/cardio-stats";
import { analyzeCurrentFitness } from "./analyze-fitness";
import { computeDisciplineActivityFacts } from "./discipline-weakness";
import {
  fetchCourseProfile,
  fetchCourseTimeBand,
  fetchCourseCutoffs,
} from "./course-data";

async function fetchRaceScreen(uid: string, raceId: string) {
  const db = createClient();
  const responses = await Promise.all([
    db
      .from("races")
      .select(
        "id,race_type,course_id,location,race_date,self_assessment,target_finish_seconds,discipline_weakness,training_start_date,result_duration_seconds",
      )
      .eq("id", raceId)
      .eq("user_id", uid)
      .maybeSingle(),
    db
      .from("race_training_plans")
      .select("approach,overview,weeks,phase_templates")
      .eq("race_id", raceId)
      .maybeSingle(),
    db
      .from("user_settings")
      .select("open_water_season_start_month,open_water_season_end_month")
      .eq("user_id", uid)
      .maybeSingle(),
    db
      .from("training_disruptions")
      .select("id,start_date,end_date,reason,note")
      .eq("user_id", uid)
      .order("start_date", { ascending: false }),
    db.from("race_checklist_items").select("done_at").eq("race_id", raceId),
    db
      .from("workouts")
      .select("id")
      .eq("user_id", uid)
      .eq("date", getLocalDateString())
      .not("completed_at", "is", null)
      .limit(1),
  ]);
  if (responses.some((r) => r.error))
    throw new Error("Race data could not load.");
  const [
    { data: raceRow },
    { data: planRow },
    { data: settingsRow },
    { data: disruptionRows },
    { data: checklistRows },
    { data: todayWorkoutRows },
  ] = responses;
  if (!raceRow) return { found: false as const };
  const multisport = ["ironman", "xtri"].includes(raceRow.race_type);
  const [course, disciplineFacts, activities, facts, courseDetails] =
    await Promise.all([
      raceRow.course_id
        ? db
            .from("race_courses")
            .select("name")
            .eq("id", raceRow.course_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      multisport ? computeDisciplineActivityFacts(db) : Promise.resolve(null),
      planRow ? fetchCardioActivity(db) : Promise.resolve([]),
      analyzeCurrentFitness(db, uid, raceId),
      multisport && raceRow.course_id
        ? Promise.all([
            fetchCourseProfile(db, raceRow.course_id),
            fetchCourseTimeBand(db, raceRow.course_id, "beginner"),
            fetchCourseTimeBand(db, raceRow.course_id, "intermediate"),
            fetchCourseTimeBand(db, raceRow.course_id, "advanced"),
            fetchCourseCutoffs(db, raceRow.course_id),
          ])
        : Promise.resolve(null),
    ]);
  if (course.error) throw new Error("Course data could not load.");
  return {
    found: true as const,
    raceRow,
    planRow,
    settingsRow,
    disruptionRows,
    checklistRows,
    todayWorkoutRows,
    courseName: course.data?.name ?? null,
    disciplineFacts,
    activities,
    facts,
    courseDetails,
  };
}
export async function loadRaceScreen(uid: string, raceId: string) {
  const entry = userResource<Awaited<ReturnType<typeof fetchRaceScreen>>>(
    uid,
    `race-screen:${raceId}:${getLocalDateString()}`,
  );
  await entry.load(() => fetchRaceScreen(uid, raceId));
  const { data, error } = entry.read();
  if (error || !data) throw new Error(error || "Race data could not load.");
  return data;
}
