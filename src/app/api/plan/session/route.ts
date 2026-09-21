import { isSameOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { loadDailyPlan } from "@/lib/daily-plan";

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request))
      return Response.json({ error: "Invalid origin" }, { status: 403 });
    const body = await request.json();
    const db = await createClient();
    const today =
      typeof body.today === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.today) &&
      Math.abs(Date.parse(body.today) - Date.now()) < 2 * 86400000
        ? body.today
        : undefined;
    const day = await loadDailyPlan(
      db,
      body.date,
      body.raceId || undefined,
      today,
    );
    const session = day.sessions.find((s) => s.key === body.key);
    if (!session)
      return Response.json(
        { error: "This session has changed. Refresh your plan." },
        { status: 409 },
      );
    const { data, error } = await db.rpc("start_planned_session", {
      p_key: session.key,
      p_date: session.date,
      p_title: session.title,
      p_kind: session.kind,
      p_race: session.raceId,
      p_template: session.templateId,
      p_slot: session.slotId,
      p_existing: body.workoutId || null,
    });
    if (error)
      throw new Error(
        "Could not save this session. Check that the database update has been applied and try again.",
      );
    return Response.json({ workoutId: data });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not open session",
      },
      { status: 400 },
    );
  }
}
