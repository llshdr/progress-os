"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getLocalWeekStartString } from "@/lib/date";
import type { TrainingWeekSkeleton } from "@/lib/race-plan/periodization";

type ReviewPlan = { overview: string; weeks: TrainingWeekSkeleton[] };
export default function PlanReview({
  candidate,
  previous,
  onApply,
  onCancel,
}: {
  candidate: ReviewPlan;
  previous: ReviewPlan | null;
  onApply: () => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monday = getLocalWeekStartString();
  const upcoming = candidate.weeks.filter(
    (w) => !previous || w.weekStartDate > monday,
  );
  const delta = (before: number | undefined, after: number, unit = " km") =>
    before === undefined
      ? `${after}${unit}`
      : before === after
        ? `${after}${unit} · same`
        : `${before} → ${after}${unit}`;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {previous ? "Review plan changes" : "Review your plan"}
          </DialogTitle>
          <DialogDescription>
            {previous
              ? "Past weeks and this week stay as saved. Changes begin next week. Logged training is kept."
              : "Your plan will be saved when you choose Apply plan."}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm leading-relaxed text-lapis-text-secondary">
          {candidate.overview}
        </p>
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {upcoming.map((w) => {
            const old = previous?.weeks.find(
              (p) => p.weekStartDate === w.weekStartDate,
            );
            return (
              <article
                key={w.weekStartDate}
                className="rounded-2xl border border-lapis-border p-4"
              >
                <div className="mb-2 flex justify-between gap-3 text-sm">
                  <strong>
                    {new Date(w.weekStartDate + "T12:00:00").toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short", year: "numeric" },
                    )}
                  </strong>
                  <span className="capitalize text-lapis-text-secondary">
                    {w.isAcclimation ? "Acclimation" : w.phase}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  {w.disciplines ? (
                    (["swim", "bike", "run"] as const).map((d) => (
                      <div key={d}>
                        <dt className="capitalize text-lapis-text-secondary">
                          {d}
                        </dt>
                        <dd>
                          {delta(
                            old?.disciplines?.[d].km,
                            w.disciplines![d].km,
                          )}
                        </dd>
                      </div>
                    ))
                  ) : (
                    <div>
                      <dt>Cardio</dt>
                      <dd>{delta(old?.targetCardioKm, w.targetCardioKm)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-lapis-text-secondary">Strength</dt>
                    <dd>
                      {delta(
                        old?.targetStrengthSessions,
                        w.targetStrengthSessions,
                        " sessions",
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
          {!upcoming.length && (
            <p className="text-sm text-lapis-text-secondary">
              There are no future weeks to change.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-lapis-garnet">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            Keep current plan
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onApply();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not apply plan",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Applying…" : "Apply plan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
