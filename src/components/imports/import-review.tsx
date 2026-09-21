"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateImport, type ImportItem } from "@/lib/imports/types";
import { changed } from "@/components/lapis/app-provider";
type Option = { id: string; title: string };
type Result = {
  sourceKey: string;
  kind: string;
  id?: string;
  duplicate?: boolean;
  error?: string;
};
export const importHref = (kind: string, id: string) =>
  kind === "calendar"
    ? "/plan"
    : kind === "task"
      ? `/goals/milestones/${id}/edit`
      : kind === "workout"
        ? `/gym/workouts/${id}`
        : "/gym/progress/races";
export default function ImportReview({
  initial,
  goals,
  races,
  onClose,
}: {
  initial: ImportItem[];
  goals: Option[];
  races: Option[];
  onClose: () => void;
}) {
  const [items, setItems] = useState(initial);
  const [selected, setSelected] = useState(
    new Set(initial.slice(0, 50).map((i) => i.sourceKey)),
  );
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completed = new Set(
    results.filter((r) => r.id).map((r) => r.sourceKey),
  );
  const ready = items.filter(
    (i) => selected.has(i.sourceKey) && !completed.has(i.sourceKey),
  );
  const firstIssue = ready.map((i) => validateImport(i)).find(Boolean);
  function update(key: string, values: Partial<ImportItem>) {
    setItems((old) =>
      old.map((i) => (i.sourceKey === key ? { ...i, ...values } : i)),
    );
  }
  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/imports/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: ready }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not import");
      setResults((old) => [
        ...old.filter((r) => !ready.some((i) => i.sourceKey === r.sourceKey)),
        ...data.results,
      ]);
      changed();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not import. Your review is kept here; retry when connected.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8" aria-label="Review import">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="lapis-eyebrow">Review before saving</p>
          <h2 className="mt-2 text-xl font-semibold">
            {items.length} {items.length === 1 ? "item" : "items"} to review
          </h2>
          <p className="mt-2 text-sm text-lapis-text-secondary">
            Check dates, times, amounts, and destinations. Nothing is saved
            until you import.
          </p>
        </div>
        <button disabled={busy} onClick={onClose} className="lapis-secondary">
          Close
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => {
          const issue = validateImport(item),
            result = results.find((r) => r.sourceKey === item.sourceKey);
          return (
            <details
              key={item.sourceKey}
              open={index === 0 && !completed.has(item.sourceKey)}
              className="lapis-panel !p-0 overflow-hidden"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.title || "item " + (index + 1)}`}
                  checked={selected.has(item.sourceKey)}
                  disabled={busy || completed.has(item.sourceKey)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    setSelected((old) => {
                      const next = new Set(old);
                      if (e.target.checked) next.add(item.sourceKey);
                      else next.delete(item.sourceKey);
                      return next;
                    })
                  }
                  className="size-5 shrink-0 accent-lapis-accent-400"
                />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">
                    {item.title || "Untitled item"}
                  </strong>
                  <span className="text-xs capitalize text-lapis-text-secondary">
                    {item.kind} · {item.date || "Date needed"}
                    {issue ? " · Needs review" : ""}
                  </span>
                </span>
                {result?.id ? (
                  <Link
                    href={
                      item.kind === "calendar"
                        ? `/plan?date=${item.date}&view=day`
                        : item.kind === "expense" && item.raceId
                          ? `/gym/progress/races/${item.raceId}/budget`
                          : importHref(item.kind, result.id)
                    }
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs text-lapis-jade"
                  >
                    <Check size={16} />
                    {result.duplicate ? "Already imported" : "Imported"} · Open
                    →
                  </Link>
                ) : (
                  <ChevronDown size={18} />
                )}
              </summary>
              <div className="border-t border-lapis-border p-4">
                <fieldset
                  disabled={busy || completed.has(item.sourceKey)}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <label className="text-xs text-lapis-text-secondary sm:col-span-2">
                    Title
                    <input
                      maxLength={200}
                      className="lapis-field mt-1"
                      value={item.title}
                      onChange={(e) =>
                        update(item.sourceKey, { title: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-xs text-lapis-text-secondary">
                    Save as
                    <select
                      className="lapis-field mt-1"
                      value={item.kind}
                      onChange={(e) =>
                        update(item.sourceKey, {
                          kind: e.target.value as ImportItem["kind"],
                        })
                      }
                    >
                      <option value="calendar">Calendar event</option>
                      <option value="task">Goal milestone / task</option>
                      <option value="expense">Race expense</option>
                      <option value="workout">Completed workout</option>
                    </select>
                  </label>
                  <label className="text-xs text-lapis-text-secondary">
                    Date
                    <input
                      type="date"
                      className="lapis-field mt-1"
                      value={item.date}
                      onChange={(e) =>
                        update(item.sourceKey, { date: e.target.value })
                      }
                    />
                  </label>
                  {item.kind === "calendar" && (
                    <>
                      <label className="text-xs text-lapis-text-secondary">
                        End date
                        <input
                          type="date"
                          className="lapis-field mt-1"
                          value={item.endDate || item.date}
                          onChange={(e) =>
                            update(item.sourceKey, { endDate: e.target.value })
                          }
                        />
                      </label>
                      <span />
                      <label className="text-xs text-lapis-text-secondary">
                        Start time · optional
                        <input
                          type="time"
                          className="lapis-field mt-1"
                          value={item.time || ""}
                          onChange={(e) =>
                            update(item.sourceKey, { time: e.target.value })
                          }
                        />
                      </label>
                      <label className="text-xs text-lapis-text-secondary">
                        End time · optional
                        <input
                          type="time"
                          className="lapis-field mt-1"
                          value={item.endTime || ""}
                          onChange={(e) =>
                            update(item.sourceKey, { endTime: e.target.value })
                          }
                        />
                      </label>
                    </>
                  )}
                  {(item.kind === "task" || item.kind === "workout") && (
                    <label className="text-xs text-lapis-text-secondary">
                      Goal · optional
                      <select
                        className="lapis-field mt-1"
                        value={item.goalId || ""}
                        onChange={(e) =>
                          update(item.sourceKey, { goalId: e.target.value })
                        }
                      >
                        <option value="">No goal</option>
                        {goals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {(item.kind === "expense" || item.kind === "workout") && (
                    <label className="text-xs text-lapis-text-secondary">
                      Race{item.kind === "workout" ? " · optional" : ""}
                      <select
                        className="lapis-field mt-1"
                        value={item.raceId || ""}
                        onChange={(e) =>
                          update(item.sourceKey, { raceId: e.target.value })
                        }
                      >
                        <option value="">Choose race</option>
                        {races.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {item.kind === "expense" && (
                    <>
                      <label className="text-xs text-lapis-text-secondary">
                        Amount in your budget’s currency
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className="lapis-field mt-1"
                          value={item.amount ?? ""}
                          onChange={(e) =>
                            update(item.sourceKey, {
                              amount: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                              currencyConfirmed: false,
                            })
                          }
                        />
                      </label>
                      <label className="flex items-start gap-3 text-sm sm:col-span-2">
                        <input
                          type="checkbox"
                          className="mt-1 size-5 shrink-0"
                          checked={item.currencyConfirmed ?? false}
                          onChange={(e) =>
                            update(item.sourceKey, {
                              currencyConfirmed: e.target.checked,
                            })
                          }
                        />
                        <span>
                          {item.currency && (
                            <>Source currency: {item.currency}. </>
                          )}
                          This amount uses the same currency as my race budget.
                          No conversion is automatic.
                        </span>
                      </label>
                    </>
                  )}
                  {item.kind === "workout" && (
                    <>
                      <label className="text-xs text-lapis-text-secondary">
                        Discipline
                        <select
                          className="lapis-field mt-1"
                          value={item.discipline || ""}
                          onChange={(e) =>
                            update(item.sourceKey, {
                              discipline: e.target
                                .value as ImportItem["discipline"],
                            })
                          }
                        >
                          <option value="">Choose type</option>
                          <option value="swimming">Swim</option>
                          <option value="cycling">Bike</option>
                          <option value="running">Run</option>
                          <option value="other">Other cardio</option>
                        </select>
                      </label>
                      <label className="text-xs text-lapis-text-secondary">
                        Distance · km
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className="lapis-field mt-1"
                          value={item.distanceKm ?? ""}
                          onChange={(e) =>
                            update(item.sourceKey, {
                              distanceKm: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                        />
                      </label>
                      <label className="text-xs text-lapis-text-secondary">
                        Duration · minutes
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          inputMode="decimal"
                          className="lapis-field mt-1"
                          value={
                            item.durationSeconds != null
                              ? Math.round(item.durationSeconds / 6) / 10
                              : ""
                          }
                          onChange={(e) =>
                            update(item.sourceKey, {
                              durationSeconds: e.target.value
                                ? Math.round(Number(e.target.value) * 60)
                                : undefined,
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                  <label className="text-xs text-lapis-text-secondary sm:col-span-2">
                    Note
                    <textarea
                      rows={2}
                      maxLength={4000}
                      className="lapis-field mt-1"
                      value={item.note || ""}
                      onChange={(e) =>
                        update(item.sourceKey, { note: e.target.value })
                      }
                    />
                  </label>
                </fieldset>
                {item.warning && (
                  <p className="mt-3 text-sm text-lapis-gold-400">
                    {item.warning}
                  </p>
                )}
                {issue && !result?.id && (
                  <p className="mt-3 text-xs text-lapis-text-secondary">
                    {issue}
                  </p>
                )}
                {result?.error && (
                  <p role="alert" className="mt-3 text-sm text-lapis-garnet">
                    {result.error}
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
      <div className="sticky bottom-24 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-lapis-border bg-lapis-surface-1/95 p-4 backdrop-blur-xl md:bottom-4">
        <div className="text-sm">
          <p>
            {completed.size ? `${completed.size} saved · ` : ""}
            {ready.length} selected
          </p>
          {firstIssue && (
            <p className="mt-1 text-xs text-lapis-text-secondary">
              Review the marked fields before importing.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-1 text-xs text-lapis-garnet">
              {error}
            </p>
          )}
        </div>
        <Button
          disabled={
            busy || !ready.length || ready.length > 50 || Boolean(firstIssue)
          }
          onClick={apply}
        >
          {busy
            ? "Importing…"
            : `Import ${ready.length} ${ready.length === 1 ? "item" : "items"}`}
        </Button>
      </div>
    </section>
  );
}
