import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { providerConfig, type Provider } from "./config";
import { seal, unseal } from "./crypto";
export type Tokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  scope?: string;
};
export async function exchange(
  provider: Provider,
  fields: Record<string, string>,
): Promise<Tokens> {
  const c = providerConfig(provider);
  const res = await fetch(c.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.id!,
      client_secret: c.secret!,
      ...fields,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!res.ok)
    throw new Error("Provider authorization failed. Reconnect and try again.");
  const tokens = await res.json();
  if (typeof tokens.access_token !== "string")
    throw new Error("The provider did not grant access.");
  return tokens;
}
export async function saveTokens(
  db: SupabaseClient,
  uid: string,
  provider: Provider,
  tokens: Tokens,
) {
  const seconds = Number(
    tokens.expires_at ?? Date.now() / 1000 + Number(tokens.expires_in ?? 3600),
  );
  if (!Number.isFinite(seconds)) throw new Error("Invalid provider expiry");
  const { error } = await db.from("integration_connections").upsert(
    {
      user_id: uid,
      provider,
      encrypted_tokens: seal(tokens, `connection:${uid}:${provider}`),
      expires_at: new Date(seconds * 1000).toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error)
    throw new Error(
      "Could not save connection. Apply the database update and retry.",
    );
}
const refreshing = new Map<string, Promise<string>>();
export async function accessToken(
  db: SupabaseClient,
  uid: string,
  provider: Provider,
): Promise<string> {
  const key = `${uid}:${provider}`;
  if (refreshing.has(key)) return refreshing.get(key)!;
  const pending = (async () => {
    const { data, error } = await db
      .from("integration_connections")
      .select("encrypted_tokens,expires_at")
      .eq("user_id", uid)
      .eq("provider", provider)
      .maybeSingle();
    if (error || !data) throw new Error("Connect this account first.");
    const tokens = unseal<Tokens>(data.encrypted_tokens, `connection:${key}`);
    if (Date.parse(data.expires_at) > Date.now() + 120000)
      return tokens.access_token;
    if (!tokens.refresh_token)
      throw new Error("Your connection expired. Reconnect to continue.");
    const refreshed = await exchange(provider, {
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    });
    const next = {
      ...refreshed,
      refresh_token: refreshed.refresh_token || tokens.refresh_token,
    };
    // Compare-and-swap prevents a stale refresh from replacing a newer token.
    const expiry = Number(
      next.expires_at ?? Date.now() / 1000 + Number(next.expires_in ?? 3600),
    );
    const { data: updated, error: saveError } = await db
      .from("integration_connections")
      .update({
        encrypted_tokens: seal(next, `connection:${key}`),
        expires_at: new Date(expiry * 1000).toISOString(),
      })
      .eq("user_id", uid)
      .eq("provider", provider)
      .eq("encrypted_tokens", data.encrypted_tokens)
      .select("provider");
    if (saveError)
      throw new Error("Could not refresh connection. Reconnect to continue.");
    if (!updated?.length) {
      const { data: latest } = await db
        .from("integration_connections")
        .select("encrypted_tokens")
        .eq("user_id", uid)
        .eq("provider", provider)
        .maybeSingle();
      if (!latest) throw new Error("Connection was removed.");
      return unseal<Tokens>(latest.encrypted_tokens, `connection:${key}`)
        .access_token;
    }
    return next.access_token;
  })();
  refreshing.set(key, pending);
  try {
    return await pending;
  } finally {
    refreshing.delete(key);
  }
}
export async function providerGet<T>(
  url: string,
  token: string,
  headers: Record<string, string> = {},
): Promise<T> {
  // Only fixed provider API hosts are allowed; never follow URLs found in mail.
  const target = new URL(url);
  if (
    ![
      "gmail.googleapis.com",
      "www.googleapis.com",
      "graph.microsoft.com",
      "www.strava.com",
    ].includes(target.hostname) ||
    target.protocol !== "https:"
  )
    throw new Error("Unsupported provider endpoint");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok)
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Access expired or was not granted. Reconnect this account."
        : "The provider could not load items. Try again shortly.",
    );
  return res.json();
}
