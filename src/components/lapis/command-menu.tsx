"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useLapis } from "./app-provider";
const pages = [
  ["Today", "/dashboard"],
  ["Training", "/gym"],
  ["Plan & calendar", "/plan"],
  ["World", "/journey"],
  ["Goals", "/goals"],
  ["Nutrition", "/nutrition"],
  ["Races", "/gym/progress/races"],
  ["Exercise library", "/gym/exercises"],
  ["Templates", "/gym/templates"],
  ["Progress", "/gym/progress"],
  ["Coach", "/coach"],
  ["Profile", "/profile"],
  ["Settings", "/settings"],
  ["Imports & connections", "/settings/connections"],
];
export default function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(pages);
  const { identity } = useLapis();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!open || !identity) return;
    let live = true;
    const db = createClient();
    Promise.all([
      db
        .from("goals")
        .select("id,title")
        .eq("user_id", identity.id)
        .neq("status", "archived"),
      db
        .from("races")
        .select("id,race_type,location")
        .eq("user_id", identity.id),
    ]).then(([goals, races]) => {
      if (live)
        setItems([
          ...pages,
          ...(goals.data ?? []).map((g) => [g.title, `/goals/${g.id}`]),
          ...(races.data ?? []).map((r) => [
            `${r.race_type} ${r.location ?? ""}`,
            `/gym/progress/races/${r.id}`,
          ]),
        ]);
    });
    return () => {
      live = false;
    };
  }, [open, identity]);
  return (
    <>
      <button
        className="lapis-icon-button"
        aria-label="Search app"
        onClick={() => setOpen(true)}
      >
        <Search size={19} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Go anywhere</DialogTitle>
            <DialogDescription>
              Search pages, goals and races. Ctrl / ⌘ K
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Where would you like to go?"
            aria-label="Search destinations"
            className="lapis-field"
          />
          <nav
            aria-label="Search results"
            className="max-h-[50dvh] overflow-y-auto"
          >
            {items
              .filter(([label]) =>
                label.toLowerCase().includes(query.toLowerCase()),
              )
              .map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex min-h-12 items-center justify-between rounded-xl px-3 text-sm hover:bg-lapis-surface-2"
                >
                  {label}
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            {!items.some(([label]) =>
              label.toLowerCase().includes(query.toLowerCase()),
            ) && (
              <p className="p-4 text-sm text-lapis-text-secondary">
                No matches. Try a page or goal name.
              </p>
            )}
          </nav>
        </DialogContent>
      </Dialog>
    </>
  );
}
