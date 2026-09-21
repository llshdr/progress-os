import "server-only";
export const PROVIDERS = [
  "gmail",
  "google_calendar",
  "outlook",
  "outlook_calendar",
  "strava",
] as const;
export type Provider = (typeof PROVIDERS)[number];
export const isProvider = (p: string): p is Provider =>
  (PROVIDERS as readonly string[]).includes(p);
export function appOrigin() {
  const url = new URL(process.env.APP_URL || "http://localhost:3000");
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("Set APP_URL to your HTTPS app address");
  return url.origin;
}
export function providerConfig(p: Provider) {
  const google = p === "gmail" || p === "google_calendar";
  const microsoft = p === "outlook" || p === "outlook_calendar";
  return {
    id: google
      ? process.env.GOOGLE_CLIENT_ID
      : microsoft
        ? process.env.MICROSOFT_CLIENT_ID
        : process.env.STRAVA_CLIENT_ID,
    secret: google
      ? process.env.GOOGLE_CLIENT_SECRET
      : microsoft
        ? process.env.MICROSOFT_CLIENT_SECRET
        : process.env.STRAVA_CLIENT_SECRET,
    authorize: google
      ? "https://accounts.google.com/o/oauth2/v2/auth"
      : microsoft
        ? "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
        : "https://www.strava.com/oauth/authorize",
    token: google
      ? "https://oauth2.googleapis.com/token"
      : microsoft
        ? "https://login.microsoftonline.com/common/oauth2/v2.0/token"
        : "https://www.strava.com/oauth/token",
    scope:
      p === "gmail"
        ? "https://www.googleapis.com/auth/gmail.readonly"
        : p === "google_calendar"
          ? "https://www.googleapis.com/auth/calendar.events.readonly"
          : p === "outlook"
            ? "offline_access Mail.Read"
            : p === "outlook_calendar"
              ? "offline_access Calendars.Read"
              : "activity:read_all",
    redirect: `${appOrigin()}/api/connections/${p}/callback`,
    pkce: p !== "strava",
  };
}
export function isConfigured(p: Provider) {
  try {
    const c = providerConfig(p);
    return Boolean(
      c.id &&
      c.secret &&
      process.env.APP_URL &&
      /^[a-f\d]{64}$/i.test(process.env.LAPIS_CONNECTIONS_KEY ?? ""),
    );
  } catch {
    return false;
  }
}
