import "server-only";
import type { Provider } from "./config";
import { providerGet } from "./tokens";
import { localParts, sourceHash } from "@/lib/imports/parsers";
import type { ImportItem } from "@/lib/imports/types";
export type SourceMessage = { id: string; title: string; detail: string };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
};
type GmailMessage = { id: string; snippet?: string; payload?: GmailPart };
const plainHtml = (s: string) =>
  s
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .slice(0, 30000);
function gmailBody(p: GmailPart): string {
  if (p.mimeType === "text/plain" && p.body?.data)
    return Buffer.from(p.body.data, "base64url").toString("utf8");
  const direct = p.parts
    ?.filter((x) => x.mimeType === "text/plain")
    .map(gmailBody)
    .join("\n");
  if (direct) return direct;
  const nested = p.parts?.map(gmailBody).filter(Boolean).join("\n");
  if (nested) return nested;
  return p.mimeType === "text/html" && p.body?.data
    ? plainHtml(Buffer.from(p.body.data, "base64url").toString("utf8"))
    : "";
}
export async function listSourceItems(
  provider: Provider,
  token: string,
  timezone: string,
  messageId?: string,
): Promise<{
  messages?: SourceMessage[];
  text?: string;
  source?: string;
  items?: ImportItem[];
}> {
  if (messageId && !/^[A-Za-z0-9_+/=-]{1,500}$/.test(messageId))
    throw new Error("Invalid message");
  if (provider === "gmail") {
    const base = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
    if (messageId) {
      const message = await providerGet<GmailMessage>(
        `${base}/${encodeURIComponent(messageId)}?format=full`,
        token,
      );
      const subject =
        message.payload?.headers?.find(
          (h) => h.name.toLowerCase() === "subject",
        )?.value ?? "";
      return {
        text: `${subject}\n\n${gmailBody(message.payload ?? {}) || message.snippet || ""}`.slice(
          0,
          30000,
        ),
        source: `gmail:${message.id}`,
      };
    }
    const list = await providerGet<{ messages?: { id: string }[] }>(
      `${base}?maxResults=12&labelIds=INBOX`,
      token,
    );
    const messages = await Promise.all(
      (list.messages ?? []).map(async (item) => {
        const m = await providerGet<GmailMessage>(
          `${base}/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          token,
        );
        return {
          id: m.id,
          title:
            m.payload?.headers?.find((h) => h.name.toLowerCase() === "subject")
              ?.value ?? "Untitled message",
          detail:
            m.payload?.headers?.find((h) => h.name.toLowerCase() === "from")
              ?.value ?? "",
        };
      }),
    );
    return { messages };
  }
  if (provider === "outlook") {
    type Message = {
      id: string;
      subject?: string;
      from?: { emailAddress?: { address: string } };
      body?: { content: string };
      bodyPreview?: string;
    };
    const base = "https://graph.microsoft.com/v1.0/me/messages";
    if (messageId) {
      const m = await providerGet<Message>(
        `${base}/${encodeURIComponent(messageId)}?$select=id,subject,body,bodyPreview`,
        token,
        { Prefer: 'outlook.body-content-type="text"' },
      );
      return {
        text: `${m.subject ?? ""}\n\n${m.body?.content ?? m.bodyPreview ?? ""}`.slice(
          0,
          30000,
        ),
        source: `outlook:${m.id}`,
      };
    }
    const data = await providerGet<{ value: Message[] }>(
      `${base}?$top=12&$orderby=receivedDateTime%20desc&$select=id,subject,from`,
      token,
    );
    return {
      messages: data.value.map((m) => ({
        id: m.id,
        title: m.subject || "Untitled message",
        detail: m.from?.emailAddress?.address ?? "",
      })),
    };
  }
  if (provider === "strava") {
    type Activity = {
      id: number;
      name: string;
      start_date: string;
      distance: number;
      moving_time: number;
      sport_type?: string;
      type: string;
    };
    const activities = await providerGet<Activity[]>(
      "https://www.strava.com/api/v3/athlete/activities?per_page=30&page=1",
      token,
    );
    return {
      items: activities
        .filter((a) => a.distance > 0 && a.moving_time > 0)
        .map((a) => ({
          sourceKey: sourceHash(`strava:${a.id}`),
          kind: "workout",
          title: a.name.slice(0, 200),
          date: localParts(new Date(a.start_date), timezone).date,
          distanceKm: Math.round(a.distance / 10) / 100,
          durationSeconds: a.moving_time,
          discipline: /swim/i.test(a.sport_type ?? a.type)
            ? "swimming"
            : /ride|cycle/i.test(a.sport_type ?? a.type)
              ? "cycling"
              : /run/i.test(a.sport_type ?? a.type)
                ? "running"
                : "other",
          note: `Imported from Strava activity ${a.id}. Duration is moving time.`,
        })),
    };
  }
  const now = new Date(),
    until = new Date(now.getTime() + 30 * 86400000);
  if (provider === "google_calendar") {
    type Event = {
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start: { date?: string; dateTime?: string };
      end: { date?: string; dateTime?: string };
      status: string;
    };
    const query = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: until.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });
    const data = await providerGet<{ items?: Event[] }>(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`,
      token,
    );
    return {
      items: (data.items ?? [])
        .filter(
          (e) => e.status !== "cancelled" && (e.start.date || e.start.dateTime),
        )
        .map((e) => {
          const from = e.start.date
            ? { date: e.start.date, time: undefined }
            : localParts(new Date(e.start.dateTime!), timezone);
          const end = e.end.date
            ? {
                date: new Date(Date.parse(e.end.date) - 86400000)
                  .toISOString()
                  .slice(0, 10),
                time: undefined,
              }
            : localParts(new Date(e.end.dateTime!), timezone);
          return {
            sourceKey: sourceHash(`gcal:${e.id}`),
            title: (e.summary || "Calendar event").slice(0, 200),
            kind: "calendar",
            date: from.date,
            endDate: end.date,
            time: from.time,
            endTime: end.time,
            note: [e.location, plainHtml(e.description ?? "")]
              .filter(Boolean)
              .join("\n")
              .slice(0, 4000),
          };
        }),
    };
  }
  type OutlookEvent = {
    id: string;
    subject?: string;
    isAllDay: boolean;
    isCancelled: boolean;
    start: { dateTime: string };
    end: { dateTime: string };
    location?: { displayName: string };
  };
  const query = new URLSearchParams({
    startDateTime: now.toISOString(),
    endDateTime: until.toISOString(),
    $top: "50",
    $orderby: "start/dateTime",
    $select: "id,subject,start,end,isAllDay,isCancelled,location",
  });
  const data = await providerGet<{ value: OutlookEvent[] }>(
    `https://graph.microsoft.com/v1.0/me/calendarView?${query}`,
    token,
    { Prefer: 'outlook.timezone="UTC"' },
  );
  return {
    items: data.value
      .filter((e) => !e.isCancelled)
      .map((e) => {
        const utc = (s: string) =>
          new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + "Z");
        const start = localParts(utc(e.start.dateTime), timezone),
          end = localParts(utc(e.end.dateTime), timezone);
        if (e.isAllDay) {
          const d = new Date(end.date + "T12:00:00Z");
          d.setUTCDate(d.getUTCDate() - 1);
          end.date = d.toISOString().slice(0, 10);
        }
        return {
          sourceKey: sourceHash(`outlookcal:${e.id}`),
          title: (e.subject || "Calendar event").slice(0, 200),
          kind: "calendar",
          date: start.date,
          endDate: end.date,
          time: e.isAllDay ? undefined : start.time,
          endTime: e.isAllDay ? undefined : end.time,
          note: e.location?.displayName,
        };
      }),
  };
}
