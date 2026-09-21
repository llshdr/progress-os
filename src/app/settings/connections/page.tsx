"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Browser timezone and OAuth return state are intentionally read after hydration. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, CalendarDays, Activity, Upload, Link2 } from "lucide-react";
import AppLayout from "@/components/app-layout";
import { PageHeader } from "@/components/lapis/page";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useLapis } from "@/components/lapis/app-provider";
import ImportReview, { importHref } from "@/components/imports/import-review";
import type { ImportItem } from "@/lib/imports/types";
const providers = [
  {
    id: "gmail",
    name: "Gmail",
    detail: "Choose messages to turn into plans.",
    icon: Mail,
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    detail: "Review your next 30 days.",
    icon: CalendarDays,
  },
  {
    id: "outlook",
    name: "Outlook Mail",
    detail: "Import details from a selected message.",
    icon: Mail,
  },
  {
    id: "outlook_calendar",
    name: "Outlook Calendar",
    detail: "Bring upcoming commitments into Plan.",
    icon: CalendarDays,
  },
  {
    id: "strava",
    name: "Strava",
    detail: "Review recent completed activities.",
    icon: Activity,
  },
];
type Status = { provider: string; configured: boolean; connected: boolean };
type Option = { id: string; title: string };
export default function ConnectionsPage() {
  const { identity } = useLapis();
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [goals, setGoals] = useState<Option[]>([]),
    [races, setRaces] = useState<Option[]>([]);
  const [receipts, setReceipts] = useState<
    { id: string; kind: string; title: string; destination_id: string }[]
  >([]);
  const [format, setFormat] = useState<"text" | "ics" | "csv">("text");
  const [text, setText] = useState(""),
    [source, setSource] = useState("");
  const [items, setItems] = useState<ImportItem[] | null>(null),
    [reviewKey, setReviewKey] = useState(0);
  const [messages, setMessages] = useState<
      { id: string; title: string; detail: string }[]
    >([]),
    [mailProvider, setMailProvider] = useState("");
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const state = new URLSearchParams(location.search).get("connection");
    if (state)
      setNotice(
        state === "connected"
          ? "Account connected. Choose what you want to review."
          : "Connection was not completed. Try again and grant the requested read access.",
      );
    void loadStatus();
  }, []);
  async function loadStatus() {
    try {
      const r = await fetch("/api/connections");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setStatuses(d.providers);
      setSchemaReady(d.schemaReady);
    } catch {
      setError("Could not load connections. Refresh to retry.");
    }
  }
  useEffect(() => {
    if (!identity) return;
    let live = true;
    const db = createClient();
    void Promise.all([
      db
        .from("goals")
        .select("id,title")
        .eq("user_id", identity.id)
        .eq("status", "active"),
      db
        .from("races")
        .select("id,race_type,location,race_date")
        .eq("user_id", identity.id)
        .order("race_date", { ascending: false }),
      db
        .from("import_receipts")
        .select("id,kind,title,destination_id")
        .eq("user_id", identity.id)
        .order("created_at", { ascending: false })
        .limit(8),
    ]).then(([g, r, h]) => {
      if (!live) return;
      setGoals(g.data ?? []);
      setRaces(
        (r.data ?? []).map((x) => ({
          id: x.id,
          title: `${x.race_type} ${x.location ?? ""} · ${x.race_date}`,
        })),
      );
      setReceipts(h.data ?? []);
    });
    return () => {
      live = false;
    };
  }, [identity, reviewKey]);
  function review(next: ImportItem[]) {
    const unique = [...new Map(next.map((i) => [i.sourceKey, i])).values()];
    setItems(unique);
    setReviewKey((k) => k + 1);
    setTimeout(
      () =>
        document
          .getElementById("import-review")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }
  async function action(
    id: string,
    kind: "start" | "disconnect" | "items",
    message?: string,
  ) {
    setBusy(id);
    setError(null);
    try {
      const url = `/api/connections/${id}/${kind}${kind === "items" ? `?timezone=${encodeURIComponent(timezone)}${message ? `&message=${encodeURIComponent(message)}` : ""}` : ""}`;
      const response = await fetch(url, {
        method: kind === "items" ? "GET" : "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.url) location.assign(data.url);
      else if (kind === "disconnect") {
        await loadStatus();
        setMessages([]);
        setNotice("Disconnected from LAPIS. Imported items are kept.");
      } else if (data.messages) {
        setMailProvider(id);
        setMessages(data.messages);
        setNotice(
          data.messages.length
            ? "Choose one message. Its text opens for review."
            : "No recent messages found.",
        );
      } else if (data.text !== undefined) {
        setFormat("text");
        setText(data.text);
        setSource(data.source);
        setMessages([]);
        document
          .getElementById("import-source")
          ?.scrollIntoView({ behavior: "smooth" });
      } else if (data.items) review(data.items);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not complete that action",
      );
    } finally {
      setBusy(null);
    }
  }
  async function preview() {
    setBusy("preview");
    setError(null);
    try {
      const r = await fetch("/api/imports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, text, source, timezone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      review(d.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not preview import");
    } finally {
      setBusy(null);
    }
  }
  async function manually() {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(crypto.randomUUID()),
    );
    review([
      {
        sourceKey: Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
        title: "",
        kind: "task",
        date: "",
        note: "",
      },
    ]);
  }
  return (
    <AppLayout>
      <div className="lapis-page">
        <PageHeader
          title="Connections & imports"
          subtitle="Bring the useful details into your plan."
          back={{ href: "/settings", label: "Settings" }}
        />
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-lapis-text-secondary">
          Read only, when you choose. Review selected messages, events, or
          activities before adding them. LAPIS won’t send email or change your
          external calendar.
        </p>
        {!schemaReady && (
          <p role="alert" className="mb-4 text-sm text-lapis-gold-400">
            The database update for connections and imports is needed before
            saving.
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-lapis-accent-500/10 p-4 text-sm"
          >
            {notice}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => {
            const status = statuses.find((s) => s.provider === p.id);
            return (
              <article key={p.id} className="lapis-panel !p-5">
                <div className="flex items-center gap-3">
                  <p.icon size={21} className="text-lapis-accent-400" />
                  <h2 className="font-semibold">{p.name}</h2>
                </div>
                <p className="mt-3 text-sm text-lapis-text-secondary">
                  {p.detail}
                </p>
                <p
                  className={`mt-3 text-xs ${status?.connected ? "text-lapis-jade" : "text-lapis-text-tertiary"}`}
                >
                  {!status
                    ? "Loading…"
                    : status.connected
                      ? "Connected"
                      : status.configured
                        ? "Ready to connect"
                        : "Provider setup needed"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {status?.connected ? (
                    <>
                      <Button
                        disabled={busy !== null}
                        onClick={() => action(p.id, "items")}
                      >
                        {busy === p.id ? "Loading…" : "Review items"}
                      </Button>
                      <button
                        className="lapis-secondary"
                        disabled={busy !== null}
                        onClick={() => action(p.id, "disconnect")}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      disabled={
                        busy !== null || !status?.configured || !schemaReady
                      }
                      onClick={() => action(p.id, "start")}
                    >
                      <Link2 size={15} />
                      {busy === p.id ? "Opening…" : "Connect"}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {messages.length > 0 && (
          <section className="mt-6">
            <h2 className="lapis-section">Choose a message</h2>
            <div className="lapis-group">
              {messages.map((m) => (
                <button
                  key={m.id}
                  disabled={busy !== null}
                  onClick={() => action(mailProvider, "items", m.id)}
                  className="lapis-row w-full text-left"
                >
                  <Mail size={17} className="shrink-0" />
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">
                      {m.title}
                    </strong>
                    <span className="block truncate text-xs text-lapis-text-secondary">
                      {m.detail}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
        <section id="import-source" className="lapis-panel mt-8 scroll-mt-4">
          <h2 className="text-xl font-semibold">Import something useful</h2>
          <p className="mt-2 text-sm text-lapis-text-secondary">
            Files and pasted text work without linking an account. Times are
            shown in {timezone}.
          </p>
          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[220px_1fr]">
            <div>
              <label className="text-xs text-lapis-text-secondary">
                Source
                <select
                  aria-label="Source"
                  value={format}
                  onChange={(e) => {
                    setFormat(e.target.value as typeof format);
                    setText("");
                    setSource("");
                    setError(null);
                  }}
                  className="lapis-field mt-2"
                >
                  <option value="text">Email or pasted text</option>
                  <option value="ics">Calendar file (.ics)</option>
                  <option value="csv">Workout file (.csv)</option>
                </select>
              </label>
              {format !== "text" && (
                <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-lapis-border p-3 text-sm">
                  <Upload size={17} />
                  <span>Choose file</span>
                  <input
                    type="file"
                    accept={
                      format === "ics" ? ".ics,text/calendar" : ".csv,text/csv"
                    }
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1000000) {
                        setError("Choose a file smaller than 1 MB.");
                        return;
                      }
                      setText(await file.text());
                      setSource("");
                    }}
                  />
                </label>
              )}
              {format === "csv" && (
                <a
                  href="/templates/workout-import.csv"
                  download
                  className="mt-3 inline-flex min-h-11 items-center text-sm text-lapis-accent-400"
                >
                  Download CSV template
                </a>
              )}
            </div>
            <div>
              <label htmlFor="import-text" className="sr-only">
                Text to review
              </label>
              <textarea
                id="import-text"
                value={text}
                maxLength={format === "text" ? 30000 : 1000000}
                onChange={(e) => {
                  setText(e.target.value);
                  setSource("");
                }}
                rows={6}
                className="lapis-field w-full resize-y text-sm"
                placeholder={
                  format === "text"
                    ? "Paste a race confirmation, booking, receipt, or a task…"
                    : "Choose a file or paste its contents…"
                }
              />
              {format === "text" && (
                <p className="mt-2 text-xs leading-relaxed text-lapis-text-secondary">
                  Extract details sends this text to the app’s AI provider.
                  Review the suggestions before saving, or create an item
                  manually.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  disabled={busy !== null || !text.trim()}
                  onClick={preview}
                >
                  {busy === "preview"
                    ? "Reading…"
                    : format === "text"
                      ? "Extract details"
                      : "Preview import"}
                </Button>
                <button
                  className="lapis-secondary"
                  disabled={busy !== null}
                  onClick={manually}
                >
                  Create manually
                </button>
              </div>
            </div>
          </div>
        </section>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-lapis-garnet/30 p-4 text-sm text-lapis-garnet"
          >
            {error}
          </p>
        )}
        <div id="import-review" className="scroll-mt-4">
          {items && items.length > 0 ? (
            <ImportReview
              key={reviewKey}
              initial={items}
              goals={goals}
              races={races}
              onClose={() => {
                setItems(null);
                setReviewKey((k) => k + 1);
              }}
            />
          ) : (
            items && (
              <p className="mt-5 text-sm text-lapis-text-secondary">
                No clear items found. You can create one manually above.
              </p>
            )
          )}
        </div>
        {receipts.length > 0 && (
          <section className="mt-8">
            <h2 className="lapis-section">Recently imported</h2>
            <div className="lapis-group">
              {receipts.map((r) => (
                <Link
                  key={r.id}
                  href={importHref(r.kind, r.destination_id)}
                  className="lapis-row"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {r.title}
                  </span>
                  <span className="text-xs capitalize text-lapis-text-secondary">
                    {r.kind} →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <p className="mt-6 text-xs leading-relaxed text-lapis-text-tertiary">
          Disconnecting removes the connection from LAPIS. You can also revoke
          permissions in your provider’s account settings. Imports are
          snapshots; edits in another app won’t change saved LAPIS items.
        </p>
      </div>
    </AppLayout>
  );
}
