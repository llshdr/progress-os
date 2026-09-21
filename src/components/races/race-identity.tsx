import { Bike, Waves, Footprints, Flag, CalendarDays } from "lucide-react";
import {
  raceTypeLabel,
  RACE_TYPE_DISTANCE,
  type RaceType,
} from "@/lib/race-constants";
import { getLocalDateString } from "@/lib/date";
export function RaceDisciplines({ type }: { type: RaceType }) {
  if (type !== "ironman" && type !== "xtri")
    return RACE_TYPE_DISTANCE[type] ? (
      <p className="mt-5 flex items-center gap-2 text-sm text-lapis-text-secondary">
        <Footprints size={19} />
        {RACE_TYPE_DISTANCE[type]}
      </p>
    ) : null;
  return (
    <div className="race-disciplines" aria-label="Race distances">
      {(
        [
          [Waves, "Swim", "3.8", "swim"],
          [Bike, "Bike", "180.2", "bike"],
          [Footprints, "Run", "42.2", "run"],
        ] as const
      ).map(([Icon, label, distance, kind]) => (
        <div key={label} data-kind={kind}>
          <Icon size={20} strokeWidth={1.6} />
          <span className="race-discipline-label">{label}</span>
          <span className="race-distance">
            {distance}
            <small>km</small>
          </span>
        </div>
      ))}
    </div>
  );
}
export default function RaceIdentity({
  type,
  location,
  date,
  result,
  target,
  compact = false,
}: {
  type: RaceType;
  location: string | null;
  date: string;
  result?: string | null;
  target?: string | null;
  compact?: boolean;
}) {
  const days = Math.round(
    (Date.parse(date + "T12:00:00Z") -
      Date.parse(getLocalDateString() + "T12:00:00Z")) /
      86400000,
  );
  const Title = compact ? "h3" : "h1";
  return (
    <div className={`race-identity ${compact ? "is-compact" : ""}`}>
      <div className="race-identity-main">
        <div className="min-w-0">
          <p className="lapis-eyebrow flex items-center gap-2">
            <Flag size={13} />
            {result
              ? "Finish recorded"
              : days < 0
                ? "Past race"
                : "Your next start line"}
          </p>
          <Title className="race-title">{raceTypeLabel(type)}</Title>
          {location && <p className="race-location">{location}</p>}
          <p className="mt-4 flex items-center gap-2 text-sm text-lapis-text-secondary">
            <CalendarDays size={14} />
            {new Date(date + "T12:00:00").toLocaleDateString("en", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="race-countdown">
          <strong>{result || (days === 0 ? "Today" : Math.abs(days))}</strong>
          <span>
            {result
              ? "Finish time"
              : days === 0
                ? "Race day"
                : days > 0
                  ? "days to go"
                  : "days ago"}
          </span>
          {!result && target && <small>Target · {target}</small>}
        </div>
      </div>
      <RaceDisciplines type={type} />
    </div>
  );
}
