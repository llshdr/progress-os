"use client";
import Link from "next/link";
import WorldMap from "./world-map";
import WorldMeter from "./world-meter";
import { useRouter } from "next/navigation";
import { Mountain, Building2, Footprints, ChevronRight } from "lucide-react";
import { worldStyle, type JourneyGoal } from "@/lib/journey";
export const worldIcons = {
  summit: Mountain,
  basecamp: Building2,
  trail: Footprints,
};
export default function JourneyPreview({ goals }: { goals: JourneyGoal[] }) {
  const router = useRouter();
  const active = goals.filter(
    (g) => g.status === "active" && (g.attention ?? "focus") === "focus",
  );
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="lapis-section mb-0">Your journey</h2>
        <Link
          href="/journey"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-lapis-accent-400"
        >
          Open world <ChevronRight size={16} />
        </Link>
      </div>
      <WorldMap
        small
        goals={active}
        onSelect={(id) => router.push(`/goals/${id}`)}
      />
      <div className="mt-3">
        <WorldMeter compact />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {active.slice(0, 2).map((g) => {
          const Icon = worldIcons[worldStyle(g)];
          return (
            <Link
              key={g.id}
              href={`/goals/${g.id}`}
              className="flex min-h-14 items-center gap-3 py-2"
            >
              <Icon size={23} className="shrink-0 text-lapis-text-secondary" />
              <span className="min-w-0">
                <strong className="block truncate text-sm font-medium">
                  {g.title}
                </strong>
                <span className="block truncate text-xs text-lapis-text-secondary">
                  {g.next_action || "Choose your next step"}
                </span>
              </span>
            </Link>
          );
        })}
        {active.length === 0 && (
          <Link
            href="/goals/new"
            className="py-2 text-sm text-lapis-accent-400"
          >
            Add your first destination →
          </Link>
        )}
      </div>
    </section>
  );
}
