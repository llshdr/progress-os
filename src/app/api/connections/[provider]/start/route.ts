import { isSameOrigin } from "@/lib/request-origin";
import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  appOrigin,
  isProvider,
  isConfigured,
  providerConfig,
} from "@/lib/connections/config";
import { seal } from "@/lib/connections/crypto";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  if (!isSameOrigin(request))
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const { provider } = await params;
  if (!isProvider(provider) || !isConfigured(provider))
    return Response.json(
      {
        error:
          "This connection needs provider setup first. File and pasted-text imports are available below.",
      },
      { status: 503 },
    );
  if (request.headers.get("origin") !== appOrigin())
    return Response.json(
      {
        error:
          "Connect accounts from your main app address, not a preview deployment.",
      },
      { status: 400 },
    );
  const db = await createClient(),
    {
      data: { user },
    } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Sign in again" }, { status: 401 });
  const c = providerConfig(provider),
    state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const url = new URL(c.authorize);
  const query: Record<string, string> = {
    client_id: c.id!,
    redirect_uri: c.redirect,
    response_type: "code",
    scope: c.scope,
    state,
  };
  if (c.pkce) {
    query.code_challenge = createHash("sha256")
      .update(verifier)
      .digest("base64url");
    query.code_challenge_method = "S256";
  }
  if (provider.startsWith("google") || provider === "gmail") {
    query.access_type = "offline";
    query.prompt = "consent";
  }
  if (provider === "strava") query.approval_prompt = "force";
  url.search = new URLSearchParams(query).toString();
  const response = NextResponse.json(
    { url: url.toString() },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(
    `lapis-oauth-${provider}`,
    seal(
      { uid: user.id, provider, state, verifier, expires: Date.now() + 600000 },
      `oauth:${provider}`,
    ),
    {
      httpOnly: true,
      secure: appOrigin().startsWith("https:"),
      sameSite: "lax",
      maxAge: 600,
      path: `/api/connections/${provider}/callback`,
    },
  );
  return response;
}
