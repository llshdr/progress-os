import Link from "next/link";
import { Dumbbell, Play, CalendarDays } from "lucide-react";
import type { TrainingOverview } from "@/lib/use-training-overview";
export default function TrainingCard({ data }: { data: TrainingOverview }) {
  return (
    <section className="lapis-panel relative overflow-hidden">
      <Dumbbell
        className="pointer-events-none absolute -right-3 top-5 size-32 -rotate-12 text-lapis-accent-400/10"
        strokeWidth={1}
      />
      <div className="relative">
        <p className="lapis-eyebrow">
          {data.active ? "In progress" : "Your training"}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          {data.title}
        </h2>
        <p className="mt-2 text-sm text-lapis-text-secondary">
          {data.subtitle}
        </p>
        {data.deload && (
          <p className="mt-3 text-xs text-lapis-accent-400">Deload active</p>
        )}
        <Link href={data.href} className="lapis-primary mt-6 w-full">
          {data.action === "View schedule" ? (
            <CalendarDays size={18} />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
          {data.action}
        </Link>
      </div>
    </section>
  );
}
