import { createClient } from "@/lib/supabase/server";
import { isProvider } from "@/lib/connections/config";
import { accessToken } from "@/lib/connections/tokens";
import { listSourceItems } from "@/lib/connections/items";
import { assertTimezone } from "@/lib/imports/parsers";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    const { provider } = await params;
    if (!isProvider(provider))
      return Response.json({ error: "Unknown provider" }, { status: 400 });
    const db = await createClient(),
      {
        data: { user },
      } = await db.auth.getUser();
    if (!user)
      return Response.json({ error: "Sign in again" }, { status: 401 });
    const url = new URL(request.url),
      timezone = assertTimezone(url.searchParams.get("timezone") || "UTC");
    const token = await accessToken(db, user.id, provider);
    return Response.json(
      await listSourceItems(
        provider,
        token,
        timezone,
        url.searchParams.get("message") || undefined,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Could not load provider items",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
