import { isSameOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (typeof body?.previewId !== "string")
    return Response.json({ error: "Choose a preview" }, { status: 400 });
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Sign in again" }, { status: 401 });
  const { error } = await db.rpc("apply_race_plan_preview", {
    p_id: body.previewId,
  });
  if (error)
    return Response.json(
      {
        error:
          error.message.startsWith("Saved plan changed") ||
          error.message.startsWith("Race changed") ||
          error.message.startsWith("Preview expired")
            ? error.message
            : "Could not apply this preview. Your saved plan is unchanged.",
      },
      { status: 409 },
    );
  return Response.json({ ok: true });
}
