import { createClient } from "@/lib/supabase/server";
import { PROVIDERS, isConfigured } from "@/lib/connections/config";
export async function GET() {
  const db = await createClient(),
    {
      data: { user },
    } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Sign in again" }, { status: 401 });
  const { data, error } = await db
    .from("integration_connections")
    .select("provider,connected_at")
    .eq("user_id", user.id);
  return Response.json(
    {
      providers: PROVIDERS.map((provider) => ({
        provider,
        configured: isConfigured(provider),
        connected:
          !error && Boolean(data?.some((c) => c.provider === provider)),
      })),
      schemaReady: !error,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
