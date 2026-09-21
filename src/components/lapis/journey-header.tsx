import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { WorldBadge } from "./world-meter";
export default function JourneyHeader({ view }: { view: "world" | "goals" }) {
  return (
    <>
      <header className="journey-heading">
        <div>
          <h1 className="lapis-title">{view === "world" ? "Your World" : "Goals"}</h1>
          <p className="lapis-subtitle">{view === "world" ? "Built by what you do." : "Choose a direction. Take the next step."}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <WorldBadge />
          <Link
            href="/settings/world"
            className="lapis-icon-button"
            aria-label="World settings"
          >
            <Settings2 size={18} />
          </Link>
          <Link
            href="/goals/new"
            className="lapis-icon-button"
            aria-label="Add destination"
          >
            <Plus size={21} />
          </Link>
        </div>
      </header>
      <nav className="journey-tabs" aria-label="Journey views">
        <Link
          href="/journey"
          aria-current={view === "world" ? "page" : undefined}
        >
          World
        </Link>
        <Link
          href="/goals"
          aria-current={view === "goals" ? "page" : undefined}
        >
          Goals
        </Link>
      </nav>
    </>
  );
}
