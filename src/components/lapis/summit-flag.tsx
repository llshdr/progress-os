import { Mountain } from "lucide-react";
import { WORLD_COUNTRIES, countryName } from "@/lib/world-countries";
export default function SummitFlag({
  country,
  large = false,
}: {
  country?: string | null;
  large?: boolean;
}) {
  const valid =
    country && (WORLD_COUNTRIES as readonly string[]).includes(country);
  return (
    <span
      className={`summit-flag ${large ? "is-large" : ""}`}
      role="img"
      aria-label={
        valid ? `${countryName(country)} summit flag` : "LAPIS summit flag"
      }
    >
      <span className="summit-flag-cloth">
        {valid ? (
          // eslint-disable-next-line @next/next/no-img-element -- Small local flag SVG.
          <img
            src={`/images/flags/${country}.svg`}
            alt=""
            width="48"
            height="32"
          />
        ) : (
          <Mountain size={20} />
        )}
      </span>
    </span>
  );
}
