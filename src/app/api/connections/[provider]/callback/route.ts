import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  appOrigin,
  isProvider,
  providerConfig,
} from "@/lib/connections/config";
import { equalState, unseal } from "@/lib/connections/crypto";
import { exchange, saveTokens } from "@/lib/connections/tokens";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isProvider(provider))
    return new Response("Unknown provider", { status: 404 });
  const destination = new URL("/settings/connections", appOrigin());
  destination.searchParams.set("connection", "failed");
  try {
    const cookie = request.cookies.get(`lapis-oauth-${provider}`)?.value;
    if (!cookie) throw new Error("Missing state");
    const state = unseal<{
      uid: string;
      provider: string;
      state: string;
      verifier: string;
      expires: number;
    }>(cookie, `oauth:${provider}`);
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    const code = request.nextUrl.searchParams.get("code"),
      received = request.nextUrl.searchParams.get("state");
    if (
      !user ||
      state.uid !== user.id ||
      state.provider !== provider ||
      state.expires < Date.now() ||
      !code ||
      !received ||
      !equalState(state.state, received) ||
      request.nextUrl.searchParams.has("error")
    )
      throw new Error("Invalid callback");
    const c = providerConfig(provider);
    if (
      provider === "strava" &&
      !request.nextUrl.searchParams
        .get("scope")
        ?.split(",")
        .includes("activity:read_all")
    )
      throw new Error("Missing activity permission");
    const tokens = await exchange(provider, {
      grant_type: "authorization_code",
      code,
      redirect_uri: c.redirect,
      ...(c.pkce ? { code_verifier: state.verifier } : {}),
    });
    const granted = new Set((tokens.scope ?? "").toLowerCase().split(/[ ,]+/));
    const required = c.scope.split(" ").filter((s) => s !== "offline_access");
    if (tokens.scope && required.some((s) => !granted.has(s.toLowerCase())))
      throw new Error("Missing permission");
    await saveTokens(await createClient(), user.id, provider, tokens);
    destination.searchParams.set("connection", "connected");
  } catch {
    /* Keep provider secrets and mail out of URLs and logs. */
  }
  const response = NextResponse.redirect(destination);
  response.cookies.set(`lapis-oauth-${provider}`, "", {
    maxAge: 0,
    path: `/api/connections/${provider}/callback`,
    httpOnly: true,
    sameSite: "lax",
    secure: appOrigin().startsWith("https:"),
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
