export type ImportKind = "calendar" | "task" | "expense" | "workout";
export type ImportItem = {
  sourceKey: string;
  title: string;
  kind: ImportKind;
  date: string;
  endDate?: string;
  time?: string;
  endTime?: string;
  note?: string;
  goalId?: string;
  raceId?: string;
  amount?: number;
  currency?: string;
  currencyConfirmed?: boolean;
  distanceKm?: number;
  durationSeconds?: number;
  discipline?: "swimming" | "cycling" | "running" | "other";
  warning?: string;
};
export const validDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateImport(v: ImportItem): string | null {
  if (
    !v ||
    typeof v !== "object" ||
    typeof v.sourceKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.sourceKey)
  )
    return "Import source is missing. Preview it again.";
  if (typeof v.title !== "string" || !v.title.trim() || v.title.length > 200)
    return "Use a title of 1–200 characters.";
  if (!["calendar", "task", "expense", "workout"].includes(v.kind))
    return "Choose a destination.";
  if (typeof v.date !== "string" || !validDate(v.date))
    return "Choose a valid date.";
  if (v.note && (typeof v.note !== "string" || v.note.length > 4000))
    return "Keep notes under 4,000 characters.";
  if ((v.goalId && !uuid.test(v.goalId)) || (v.raceId && !uuid.test(v.raceId)))
    return "Choose an available goal or race.";
  if (v.kind === "calendar") {
    if (v.endDate && (!validDate(v.endDate) || v.endDate < v.date))
      return "The end date must be on or after the start.";
    if (Boolean(v.time) !== Boolean(v.endTime))
      return "Set both times, or clear both for an all-day event.";
    if (
      v.time &&
      (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.endTime!))
    )
      return "Choose valid start and end times.";
    if (v.time && (v.endDate ?? v.date) === v.date && v.endTime! <= v.time)
      return "End time must be after start time.";
  }
  if (v.kind === "expense") {
    if (!v.raceId) return "Choose a race for this expense.";
    if (!Number.isFinite(v.amount) || v.amount! < 0 || v.amount! > 1e9)
      return "Enter a valid amount.";
    if (v.currencyConfirmed !== true)
      return "Confirm the amount uses your race budget’s currency.";
  }
  if (v.kind === "workout") {
    if (
      !["swimming", "cycling", "running", "other"].includes(v.discipline ?? "")
    )
      return "Choose a workout type.";
    if (
      !Number.isFinite(v.distanceKm) ||
      v.distanceKm! <= 0 ||
      v.distanceKm! >= 10000
    )
      return "Enter a distance greater than zero and below 10,000 km.";
    if (
      !Number.isInteger(v.durationSeconds) ||
      v.durationSeconds! <= 0 ||
      v.durationSeconds! > 2678400
    )
      return "Enter a valid duration.";
  }
  return null;
}
