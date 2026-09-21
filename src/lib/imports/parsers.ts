import { createHash } from "node:crypto";
import { validDate, type ImportItem } from "./types";
export const sourceHash = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export function localParts(instant: Date, timezone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
export function assertTimezone(timezone: unknown): string {
  if (typeof timezone !== "string" || timezone.length > 80)
    throw new Error("Choose your timezone.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new Error("Unknown timezone.");
  }
  return timezone;
}
const text = (v: string) =>
  v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
function icalTime(line: string, timezone: string) {
  const colon = line.indexOf(":");
  const spec = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(
    value,
  );
  if (!m)
    throw new Error(
      "The calendar contains an unsupported date. Use an .ics export with standard dates.",
    );
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!validDate(date))
    throw new Error("The calendar contains an invalid date.");
  if (!m[4]) return { date, time: undefined };
  const time = `${m[4]}:${m[5]}`;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("The calendar contains an invalid time.");
  if (m[7])
    return localParts(new Date(`${date}T${time}:${m[6] ?? "00"}Z`), timezone);
  const sourceZone = /TZID="?([^;":]+)"?/.exec(spec)?.[1];
  if (!sourceZone || sourceZone === timezone) return { date, time };
  assertTimezone(sourceZone);
  const wall = Date.parse(`${date}T${time}:00Z`);
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(instant), sourceZone);
    instant += wall - Date.parse(`${p.date}T${p.time}:00Z`);
  }
  const check = localParts(new Date(instant), sourceZone);
  if (check.date !== date || check.time !== time)
    throw new Error(
      "A calendar time falls in a daylight-saving gap. Correct it in your calendar and export again.",
    );
  return localParts(new Date(instant), timezone);
}
export function parseCalendar(raw: string, timezone: string): ImportItem[] {
  const unfolded = raw.replace(/\r?\n[ \t]/g, "");
  const events = [
    ...unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/g),
  ];
  if (!events.length)
    throw new Error("No events found. Choose an .ics calendar export.");
  if (events.length > 100)
    throw new Error("Export up to 100 events at a time.");
  return events.flatMap(([block, content]) => {
    const lines = content.split(/\r?\n/);
    const field = (name: string) =>
      lines.find((l) => l.startsWith(name + ":") || l.startsWith(name + ";"));
    const value = (name: string) => {
      const l = field(name);
      return l ? text(l.slice(l.indexOf(":") + 1)) : "";
    };
    if (value("STATUS") === "CANCELLED") return [];
    const start = field("DTSTART");
    if (!start) return [];
    const from = icalTime(start, timezone),
      end = field("DTEND"),
      to = end ? icalTime(end, timezone) : { ...from };
    if (!from.time && to.date > from.date) {
      const d = new Date(to.date + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      to.date = d.toISOString().slice(0, 10);
    }
    // Missing end time remains explicit for the reviewer to fill in.
    return [
      {
        sourceKey: sourceHash(
          `ics:${value("UID") || block}:${value("RECURRENCE-ID")}`,
        ),
        kind: "calendar" as const,
        title: (value("SUMMARY") || "Calendar event").slice(0, 200),
        date: from.date,
        endDate: to.date,
        time: from.time,
        endTime: end ? to.time : undefined,
        note: [value("DESCRIPTION"), value("LOCATION")]
          .filter(Boolean)
          .join("\n")
          .slice(0, 4000),
        warning: field("RRULE")
          ? "Recurring series: this imports only the displayed occurrence. Use a connected calendar for upcoming occurrences."
          : undefined,
      },
    ];
  });
}
function csvRows(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (quoted && raw[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && raw[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("The CSV contains an unfinished quoted value.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export function parseWorkoutCsv(raw: string): ImportItem[] {
  const [header, ...rows] = csvRows(raw.replace(/^\uFEFF/, ""));
  if (!header || !rows.length)
    throw new Error("No workouts found. Use the CSV template below.");
  if (rows.length > 100)
    throw new Error("Import up to 100 workouts at a time.");
  const columns = header.map((h) => h.trim().toLowerCase());
  for (const name of ["date", "type", "distance_km", "duration_minutes"])
    if (!columns.includes(name)) throw new Error(`CSV needs a ${name} column.`);
  return rows.map((row) => {
    const get = (key: string) => (row[columns.indexOf(key)] ?? "").trim();
    const aliases: Record<string, ImportItem["discipline"]> = {
      swim: "swimming",
      swimming: "swimming",
      bike: "cycling",
      cycling: "cycling",
      ride: "cycling",
      run: "running",
      running: "running",
      other: "other",
    };
    const discipline = aliases[get("type").toLowerCase()];
    return {
      sourceKey: sourceHash(`csv:${get("id") || row.join("|")}`),
      kind: "workout",
      title: get("title") || get("type") || "Workout",
      date: get("date"),
      discipline,
      distanceKm: get("distance_km") ? Number(get("distance_km")) : undefined,
      durationSeconds: get("duration_minutes")
        ? Math.round(Number(get("duration_minutes")) * 60)
        : undefined,
      note: get("note").slice(0, 4000),
    };
  });
}
