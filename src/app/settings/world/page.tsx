"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, Mountain } from "lucide-react";
import AppLayout from "@/components/app-layout";
import { PageHeader } from "@/components/lapis/page";
import SummitFlag from "@/components/lapis/summit-flag";
import { useWorld } from "@/components/lapis/world-provider";
import { changed } from "@/components/lapis/app-provider";
import { createClient } from "@/lib/supabase/client";
import { useJourney } from "@/lib/use-journey";
import { WORLD_COUNTRIES, countryName } from "@/lib/world-countries";
import { worldStyle } from "@/lib/journey";
export default function WorldSettings() {
  const { data, error: worldError, refresh } = useWorld();
  const { goals, error: journeyError, loading: journeyLoading } = useJourney();
  const [draftCountry, setCountry] = useState<string | null>(null);
  const country = draftCountry ?? data?.country ?? "";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const ordered = [...goals]
    .filter((g) => g.status !== "archived")
    .sort(
      (a, b) =>
        (a.world_slot ?? 0) - (b.world_slot ?? 0) || a.id.localeCompare(b.id),
    );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const db = createClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error();
      const { error } = await db
        .from("user_settings")
        .upsert(
          { user_id: user.id, world_country: country || null },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      changed();
      setSaved(true);
    } catch {
      setError("Could not save your flag. Please retry.");
    } finally {
      setPending(false);
    }
  }
  async function move(index: number, delta: number) {
    setPending(true);
    setError(null);
    const ids = ordered.map((g) => g.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    try {
      const { error } = await createClient().rpc("arrange_world", {
        p_ids: ids,
      });
      if (error) throw error;
      changed();
    } catch {
      setError("Could not arrange your world. Refresh and try again.");
    } finally {
      setPending(false);
    }
  }
  async function scenery(id: string, value: string) {
    setPending(true);
    setError(null);
    try {
      const { error } = await createClient()
        .from("goals")
        .update({ world_style: value })
        .eq("id", id);
      if (error) throw error;
      changed();
    } catch {
      setError("Could not save the landscape. Please retry.");
    } finally {
      setPending(false);
    }
  }
  return (
    <AppLayout>
      <div className="lapis-page">
        <PageHeader
          title="Your World"
          subtitle="A landscape that feels like yours."
          back={{ href: "/journey", label: "Journey" }}
        />
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <form onSubmit={save} className="lapis-panel">
            <div className="mb-5 flex items-center gap-5">
              <SummitFlag large country={country} />
              <div>
                <h2 className="text-xl font-semibold">Your summit flag</h2>
                <p className="mt-2 text-sm leading-6 text-lapis-text-secondary">
                  The flag you’ll plant when you reach a destination.
                </p>
              </div>
            </div>
            <label className="plan-field-label">
              Country or territory
              <select
                aria-label="Country or territory"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setSaved(false);
                }}
                className="lapis-field"
              >
                <option value="">LAPIS flag</option>
                {WORLD_COUNTRIES.map((code) => (
                  <option key={code} value={code}>
                    {countryName(code)}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-xs leading-6 text-lapis-text-secondary">
              New summits keep the flag you choose at completion. Previously
              saved flags stay part of their story.
            </p>
            <button disabled={pending || !data} className="lapis-primary mt-4">
              {pending ? "Saving…" : "Save flag"}
            </button>
            {saved && (
              <p role="status" className="mt-3 text-sm text-lapis-jade">
                Your flag is ready for the next summit.
              </p>
            )}
          </form>
          <section className="lapis-panel">
            <h2 className="text-xl font-semibold">Shape your mountain chain</h2>
            <p className="mt-2 text-sm leading-6 text-lapis-text-secondary">
              Choose each destination’s scenery. Move it left or right in your
              World.
            </p>
            <div className="mt-4 space-y-4">
              {ordered.map((g, i) => (
                <div key={g.id} className="border-t border-white/10 pt-4">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/goals/${g.id}`}
                      className="min-w-0 flex-1 text-sm font-semibold"
                    >
                      {g.title}
                    </Link>
                    <button
                      type="button"
                      disabled={pending || i === 0}
                      onClick={() => move(i, -1)}
                      className="lapis-icon-button disabled:opacity-30"
                      aria-label={`Move ${g.title} left`}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={pending || i === ordered.length - 1}
                      onClick={() => move(i, 1)}
                      className="lapis-icon-button disabled:opacity-30"
                      aria-label={`Move ${g.title} right`}
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <label className="plan-field-label mt-2">
                    <span className="sr-only">Landscape for {g.title}</span>
                    <select
                      aria-label={`Landscape for ${g.title}`}
                      className="lapis-field"
                      value={worldStyle(g)}
                      onChange={(e) => scenery(g.id, e.target.value)}
                      disabled={pending}
                    >
                      <option value="summit">Alpine summit</option>
                      <option value="trail">Highland trail</option>
                      <option value="basecamp">Mountain settlement</option>
                    </select>
                  </label>
                </div>
              ))}
              {journeyLoading && (
                <p className="text-sm text-lapis-text-secondary">
                  Loading your destinations…
                </p>
              )}
              {journeyError && (
                <p role="alert" className="text-sm text-lapis-garnet">
                  Your destinations couldn’t load. Refresh to try again.
                </p>
              )}
              {!ordered.length && !journeyLoading && !journeyError && (
                <Link href="/goals/new" className="lapis-secondary">
                  <Mountain size={16} />
                  Create your first destination
                </Link>
              )}
            </div>
          </section>
        </div>
        {worldError && (
          <p role="alert" className="mt-5 text-sm text-lapis-text-secondary">
            Your World settings couldn’t load.{" "}
            <button className="min-h-11 underline" onClick={refresh}>
              Retry
            </button>
          </p>
        )}
        {error && (
          <p role="alert" className="mt-5 text-sm text-lapis-garnet">
            {error}
          </p>
        )}
      </div>
    </AppLayout>
  );
}
