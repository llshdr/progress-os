import { isSameOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { isProvider } from "@/lib/connections/config";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  if (!isSameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const { provider } = await params;
  if (!isProvider(provider))
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  const db = await createClient(),
    {
      data: { user },
    } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Sign in again" }, { status: 401 });
  const { error } = await db
    .from("integration_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);
  if (error)
    return Response.json(
      { error: "Could not disconnect. Please retry." },
      { status: 500 },
    );
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
