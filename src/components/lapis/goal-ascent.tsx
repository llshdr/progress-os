"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import BackLink from "./back-link";
import {
  ArrowUpRight,
  Check,
  Flag,
  Plus,
  Settings2,
  CalendarPlus,
  Mountain,
} from "lucide-react";
import AppLayout from "@/components/app-layout";
import { createClient } from "@/lib/supabase/client";
import { useJourney } from "@/lib/use-journey";
import { usePageState } from "@/lib/use-page-state";
import { goalProgress } from "@/lib/world-progress";
import { changed } from "./app-provider";
import { useWorld } from "./world-provider";
import AscentScene from "./ascent-scene";
import PlanEntryDialog from "./plan-entry-dialog";
import GoalSessions from "./goal-sessions";
import SummitFlag from "./summit-flag";
import { WorldBadge } from "./world-meter";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
type Checkin = { id: string; focus: string; created_at: string };
export default function GoalAscent() {
  const { id } = useParams<{ id: string }>();
  return <GoalContent key={id} id={id} />;
}
function GoalContent({ id }: { id: string }) {
  const journey = useJourney();
  const { data: world } = useWorld();
  const goal = journey.goals.find((g) => g.id === id);
  const [tab, setTab] = usePageState<string>("view", "route", (v) =>
    ["route", "journal"].includes(v),
  );
  const [planning, setPlanning] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [journal, setJournal] = useState<Checkin[]>([]);
  const [note, setNote] = useState("");
  const noteId = useRef<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    void createClient()
      .from("goal_checkins")
      .select("id,focus,created_at")
      .eq("goal_id", id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (live) {
          if (error) setError("Could not load your journal. Please refresh.");
          else setJournal(data ?? []);
        }
      });
    return () => {
      live = false;
    };
  }, [id, revision]);
  async function update(
    table: "goals" | "milestones",
    itemId: string,
    status: string,
  ) {
    setPending(true);
    setError(null);
    try {
      const { error } = await createClient()
        .from(table)
        .update({ status })
        .eq("id", itemId)
        .select("id")
        .single();
      if (error) throw error;
      changed();
      return true;
    } catch {
      setError("Could not save your progress. Please retry.");
      return false;
    } finally {
      setPending(false);
    }
  }
  async function log(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setPending(true);
    setError(null);
    try {
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error();
      noteId.current ??= crypto.randomUUID();
      const { error } = await db.from("goal_checkins").upsert(
        {
          id: noteId.current,
          user_id: user.id,
          goal_id: id,
          focus: note.trim(),
        },
        { onConflict: "id" },
      );
      if (error) throw error;
      setNote("");
      noteId.current = null;
      setRevision((v) => v + 1);
      changed();
    } catch {
      setError("Your note could not save. It is still here; try again.");
    } finally {
      setPending(false);
    }
  }
  if (journey.loading)
    return (
      <AppLayout>
        <div className="lapis-page">
          <div className="h-[65vh] animate-pulse rounded-3xl bg-lapis-surface-1" />
        </div>
      </AppLayout>
    );
  if (!goal || journey.error)
    return (
      <AppLayout>
        <div className="lapis-page">
          <BackLink fallback="/goals" />
          <p role="alert" className="mt-6">
            {journey.error
              ? "This destination could not load. Please refresh."
              : "This destination is not available."}
          </p>
        </div>
      </AppLayout>
    );
  const progress = goalProgress(goal);
  const next =
    goal.next_action || progress.next?.next_action || progress.next?.title;
  const supporting = world?.goals[id];
  const linkedRaces = journey.races.filter((r) => r.goal_id === id);
  const prerequisite = journey.goals.find(
    (g) => g.id === goal.depends_on_goal_id && g.status !== "done",
  );
  return (
    <AppLayout>
      <div className="lapis-page">
        <div className="mb-6 flex items-center justify-between gap-3">
          <BackLink fallback="/goals" />
          <div className="flex items-center gap-2">
            <WorldBadge />
            <Link
              href={`/goals/${id}/edit`}
              className="lapis-icon-button"
              aria-label="Edit destination"
            >
              <Settings2 size={18} />
            </Link>
          </div>
        </div>
        <header className="mb-6">
          <p className="lapis-eyebrow">
            {goal.status === "done"
              ? "Summit reached"
              : goal.status === "archived"
                ? "Archived destination"
                : goal.attention === "later"
                  ? "On the horizon"
                  : goal.attention === "paused"
                    ? "Taking a pause"
                    : "Your next chapter"}
          </p>
          <h1 className="lapis-title mt-3">{goal.title}</h1>
          {goal.description && (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-lapis-text-secondary">
              {goal.description}
            </p>
          )}
        </header>
        <div className="ascent-layout">
          <AscentScene
            goal={goal}
            onMilestone={(milestoneId) => {
              setTab("route");
              requestAnimationFrame(() =>
                document
                  .getElementById(`milestone-${milestoneId}`)
                  ?.scrollIntoView({
                    block: "center",
                    behavior: matchMedia("(prefers-reduced-motion: reduce)")
                      .matches
                      ? "auto"
                      : "smooth",
                  }),
              );
            }}
          />
          <div className="min-w-0 space-y-5">
            {prerequisite && (
              <Link
                href={`/goals/${prerequisite.id}`}
                className="lapis-panel block text-sm text-lapis-text-secondary"
              >
                First, reach {prerequisite.title}{" "}
                <ArrowUpRight className="inline" size={15} />
              </Link>
            )}
            {goal.status === "done" ? (
              <section className="ascent-next">
                <div className="flex items-center gap-4">
                  <SummitFlag country={goal.summit_country || world?.country} />
                  <div>
                    <p className="lapis-eyebrow">A summit of your own</p>
                    <h2 className="mt-2 text-xl font-semibold">
                      You made it happen.
                    </h2>
                    {goal.reached_at && (
                      <p className="mt-1 text-xs text-lapis-text-secondary">
                        {new Date(goal.reached_at).toLocaleDateString("en", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-lapis-text-secondary">
                  Your flag is planted in your World. The work along this route
                  is here to look back on.
                </p>
                <button
                  disabled={pending}
                  onClick={() => update("goals", id, "active")}
                  className="mt-2 min-h-11 text-xs text-lapis-text-secondary"
                >
                  Reopen goal
                </button>
              </section>
            ) : (
              <section className="ascent-next">
                <p className="lapis-eyebrow">Your next step</p>
                <h2 className="mt-3 text-xl font-semibold leading-snug">
                  {next || "Give this climb its first step."}
                </h2>
                {goal.status !== "archived" && (
                  <button
                    onClick={() => setPlanning(true)}
                    className="lapis-primary mt-5 w-full"
                  >
                    <CalendarPlus size={18} />
                    Make time for it
                  </button>
                )}
                <Link
                  href={`/goals/${id}/edit`}
                  className="mt-2 inline-flex min-h-11 items-center text-xs text-lapis-text-secondary"
                >
                  {next ? "Change your next step" : "Set your next step"}{" "}
                  <ArrowUpRight size={13} className="ml-2" />
                </Link>
              </section>
            )}
            {linkedRaces.map((r) => (
              <Link
                key={r.id}
                href={`/gym/progress/races/${r.id}`}
                className="lapis-secondary w-full justify-between"
              >
                <span className="flex items-center gap-2 capitalize">
                  <Flag size={16} />
                  {r.race_type} {r.location}
                </span>
                <ArrowUpRight size={17} />
              </Link>
            ))}
            {supporting && (
              <p className="text-xs text-lapis-text-secondary">
                {supporting.sessions} linked session
                {supporting.sessions === 1 ? "" : "s"} · {supporting.checkins}{" "}
                check-in{supporting.checkins === 1 ? "" : "s"} along this route
              </p>
            )}
            <nav className="journey-tabs !mb-0" aria-label="Destination views">
              <button
                className="flex-1 rounded-xl py-3 text-sm"
                aria-pressed={tab === "route"}
                onClick={() => setTab("route")}
              >
                The route
              </button>
              <button
                className="flex-1 rounded-xl py-3 text-sm"
                aria-pressed={tab === "journal"}
                onClick={() => setTab("journal")}
              >
                Your journal
              </button>
            </nav>
            {error && (
              <p role="alert" className="text-sm text-lapis-garnet">
                {error}
              </p>
            )}
            {tab === "route" ? (
              <section>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">
                    One milestone at a time
                  </h2>
                  <span className="text-xs text-lapis-text-secondary">
                    {progress.reached} / {progress.total}
                  </span>
                </div>
                <progress
                  className="lapis-progress mt-4 h-1.5 w-full"
                  max={Math.max(1, progress.total)}
                  value={progress.reached}
                  aria-label="Reached milestones"
                />
                {(goal.milestones ?? []).map((m) => (
                  <div
                    key={m.id}
                    id={`milestone-${m.id}`}
                    className="route-milestone"
                  >
                    <button
                      className="route-check"
                      aria-label={`${m.status === "done" ? "Reopen" : "Complete"} milestone: ${m.title}`}
                      aria-pressed={m.status === "done"}
                      disabled={pending || goal.status === "archived"}
                      onClick={() =>
                        update(
                          "milestones",
                          m.id,
                          m.status === "done" ? "active" : "done",
                        )
                      }
                    >
                      {m.status === "done" ? (
                        <Check size={18} />
                      ) : (
                        <span className="size-3 rounded-full border border-current" />
                      )}
                    </button>
                    <Link
                      className="min-w-0 flex-1"
                      href={`/goals/milestones/${m.id}/edit`}
                    >
                      <strong className="block text-sm font-medium">
                        {m.title}
                      </strong>
                      <span className="mt-1 block text-xs text-lapis-text-secondary">
                        {m.status === "done"
                          ? "Reached"
                          : m.next_action || "Define this step"}
                      </span>
                    </Link>
                  </div>
                ))}
                {!progress.total && (
                  <p className="py-5 text-sm leading-6 text-lapis-text-secondary">
                    Add meaningful milestones to map the climb. Training and
                    check-ins will appear in your journal as you go.
                  </p>
                )}
                <Link
                  href={`/goals/milestones/new?goalId=${id}`}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-lapis-accent-400"
                >
                  <Plus size={16} />
                  Add milestone
                </Link>
                {goal.status === "active" && (
                  <button
                    onClick={() => setComplete(true)}
                    className="lapis-secondary mt-5 w-full"
                    disabled={pending}
                  >
                    <Flag size={17} />
                    I’ve reached this goal
                  </button>
                )}
              </section>
            ) : (
              <section className="space-y-5">
                <form onSubmit={log}>
                  <label className="plan-field-label">
                    What moved you forward?
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      maxLength={3000}
                      required
                      className="lapis-field resize-y"
                      placeholder="A small win, a useful lesson, a step you took…"
                    />
                  </label>
                  <button
                    disabled={pending || !note.trim()}
                    className="lapis-primary mt-3 w-full"
                  >
                    {pending ? "Saving…" : "Save check-in"}
                  </button>
                </form>
                <div className="space-y-4">
                  {journal.map((c) => (
                    <div
                      key={c.id}
                      className="border-l border-lapis-border pl-4"
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">
                        {c.focus}
                      </p>
                      <p className="mt-1 text-xs text-lapis-text-secondary">
                        {new Date(c.created_at).toLocaleDateString("en", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  ))}
                  {!journal.length && (
                    <p className="text-sm text-lapis-text-secondary">
                      Your story starts with the first check-in.
                    </p>
                  )}
                </div>
                <GoalSessions goalId={id} />
              </section>
            )}
          </div>
        </div>
        {planning && (
          <PlanEntryDialog
            onClose={() => setPlanning(false)}
            goal={{ ...goal, next_action: next }}
          />
        )}
        <ConfirmationModal
          open={complete}
          onOpenChange={setComplete}
          title="Ready to plant your flag?"
          description="Mark this destination reached when you’ve achieved the goal. Your chosen flag and this moment will be saved with it."
          confirmText="Plant my flag"
          onConfirm={async () => {
            if (await update("goals", id, "done")) setCelebrate(true);
          }}
        />
        <Dialog open={celebrate} onOpenChange={setCelebrate}>
          <DialogContent className="text-center sm:max-w-md">
            <div className="mx-auto mt-4">
              <SummitFlag
                large
                country={goal.summit_country || world?.country}
              />
            </div>
            <DialogHeader>
              <DialogTitle>A summit of your own.</DialogTitle>
              <DialogDescription>{goal.title}</DialogDescription>
            </DialogHeader>
            <p className="text-sm leading-6 text-lapis-text-secondary">
              Every step brought you here. Your flag now belongs in your World.
            </p>
            <Link
              href={`/journey?focus=done&destination=${id}`}
              className="lapis-primary"
            >
              <Mountain size={18} />
              See your summit
            </Link>
            <button
              onClick={() => setCelebrate(false)}
              className="min-h-11 text-sm text-lapis-text-secondary"
            >
              Stay here for a moment
            </button>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
