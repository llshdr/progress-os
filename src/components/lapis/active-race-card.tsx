"use client";
import { useDailyPlan } from "@/lib/use-daily-plan";
import { getLocalDateString } from "@/lib/date";
import { Flag, ArrowUpRight } from "lucide-react";
import Link from "next/link";
export default function ActiveRaceCard() {
  const { data } = useDailyPlan(getLocalDateString());
  if (!data?.race) return null;
  const race = data.race;
  const days = Math.round(
    (Date.parse(race.race_date + "T12:00:00") -
      Date.parse(getLocalDateString() + "T12:00:00")) /
      86400000,
  );
  return (
    <Link href={`/gym/progress/races/${race.id}`} className="lapis-race-card">
      <div className="flex items-center justify-between">
        <span className="lapis-eyebrow inline-flex items-center gap-2">
          <Flag size={14} />
          Your next start line
        </span>
        <ArrowUpRight size={19} />
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold capitalize">
            {race.race_type.replace("_", " ")} {race.location}
          </h2>
          <p className="mt-2 text-sm text-lapis-text-secondary">
            {data.phase ? `${data.phase} phase` : "Open your race plan"} ·{" "}
            {new Date(race.race_date + "T12:00:00").toLocaleDateString("en", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <strong className="text-3xl font-semibold tabular-nums">
            {days}
          </strong>
          <span className="block whitespace-nowrap text-xs text-lapis-text-secondary">
            days to go
          </span>
        </div>
      </div>
    </Link>
  );
}
