"use client";
import { useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Mountain,
  Building2,
  Footprints,
} from "lucide-react";
import { worldStyle, type JourneyGoal } from "@/lib/journey";
import { goalProgress, worldLevel } from "@/lib/world-progress";
import { useWorld } from "./world-provider";
import SummitFlag from "./summit-flag";
const icons = { summit: Mountain, basecamp: Building2, trail: Footprints };
export default function WorldMap({
  goals,
  selected,
  onSelect,
  small = false,
  visibleIds,
}: {
  goals: JourneyGoal[];
  selected?: string | null;
  onSelect: (id: string) => void;
  small?: boolean;
  visibleIds?: string[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const { data } = useWorld();
  const level = worldLevel(data?.xp ?? 0).level;
  const ordered = [...goals].sort(
    (a, b) =>
      (a.world_slot ?? 0) - (b.world_slot ?? 0) || a.id.localeCompare(b.id),
  );
  const selectedIndex = Math.max(
    0,
    ordered.findIndex((g) => g.id === selected),
  );
  const step = small ? 270 : 340;
  const width = Math.max(small ? 760 : 1080, ordered.length * step + 240);
  const center = (index: number, behavior: ScrollBehavior = "smooth") => {
    const node = scroller.current;
    if (node)
      node.scrollTo({
        left: Math.max(0, index * step + 230 - node.clientWidth / 2),
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : behavior,
      });
  };
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      node.scrollTo({
        left: Math.max(0, selectedIndex * step + 230 - node.clientWidth / 2),
        behavior: "auto",
      }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [selectedIndex, step]);
  return (
    <div
      className={`living-world ${small ? "is-small" : ""}`}
      data-world-level={Math.min(level, 10)}
    >
      {!small && (
        <div className="world-caption">
          <p className="lapis-eyebrow">Your mountain chain</p>
          <p className="mt-2 text-sm text-slate-200">
            Choose a destination to see your next step.
          </p>
        </div>
      )}
      <div
        ref={scroller}
        className="world-pan"
        tabIndex={0}
        aria-label="Your mountain chain. Use arrow controls or scroll horizontally to explore."
      >
        <div className="world-range" style={{ width }}>
          <div
            className="world-sky"
            style={{ opacity: Math.min(0.9, 0.3 + level * 0.045) }}
          />
          {ordered.map((g, index) => {
            const style = worldStyle(g);
            const progress = goalProgress(g);
            const Icon = icons[style];
            const muted = visibleIds && !visibleIds.includes(g.id);
            const high = index % 3;
            return (
              <div
                key={g.id}
                className={`world-massif ${muted ? "is-muted" : ""} ${g.attention === "paused" ? "is-paused" : ""}`}
                style={{
                  left: index * step,
                  width: 460,
                  height: `${85 - high * 6}%`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Optimised local WebP terrain layer; alpha preserved. */}
                <img
                  src="/images/world/peak.webp"
                  alt=""
                  draggable={false}
                  className={`world-peak terrain-${style}`}
                  style={{ transform: index % 2 ? "scaleX(-1)" : "none" }}
                />
                {style === "basecamp" && (
                  <span className="world-settlement">
                    <Building2 size={42} />
                    <span className="world-window" />
                  </span>
                )}
                {!small && (
                  <svg
                    className="world-trail"
                    viewBox="0 0 460 520"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M205 500 C120 420 310 395 210 315 S290 200 230 110"
                      fill="none"
                      stroke="#cfe1ed50"
                      strokeWidth="2"
                      strokeDasharray="3 9"
                    />
                    <path
                      d="M205 500 C120 420 310 395 210 315 S290 200 230 110"
                      fill="none"
                      stroke="#91c7ff"
                      strokeWidth="3"
                      pathLength="100"
                      strokeDasharray={`${progress.ascent * 100} 100`}
                    />
                  </svg>
                )}
                {!muted && (
                  <button
                    onClick={() => onSelect(g.id)}
                    className={`world-destination lapis-destination ${selected === g.id ? "is-selected" : ""}`}
                    aria-pressed={selected === g.id}
                    aria-label={`Enter ${g.title}`}
                  >
                    {g.status === "done" ? (
                      <SummitFlag country={g.summit_country || data?.country} />
                    ) : (
                      <span className="world-destination-icon">
                        <Icon size={18} />
                      </span>
                    )}
                    <span className="world-destination-label">
                      <strong>{g.title}</strong>
                      {!small && (
                        <span>
                          {g.status === "done"
                            ? "Summit reached"
                            : g.attention === "paused"
                              ? "Taking a pause"
                              : g.attention === "later"
                                ? "On the horizon"
                                : progress.total
                                  ? `${progress.reached} / ${progress.total} milestones`
                                  : "Your first foothold"}
                        </span>
                      )}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
          {level >= 2 && (
            <div className="world-growth" aria-hidden="true">
              {Array.from({ length: Math.min(18, level * 2) }, (_, i) => (
                <span
                  key={i}
                  style={{ left: 90 + i * 79, bottom: (i % 3) * 8 }}
                >
                  <svg
                    width="50"
                    height="80"
                    viewBox="0 0 50 80"
                    fill="currentColor"
                  >
                    <path d="M25 0 12 23h6L7 43h8L0 65h21v15h8V65h21L35 43h8L32 23h6Z" />
                  </svg>
                </span>
              ))}
            </div>
          )}
          <div className="world-mist" />
        </div>
      </div>
      <div className="world-controls">
        <button
          onClick={() =>
            scroller.current?.scrollBy({
              left: -step,
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
            })
          }
          className="lapis-map-control"
          aria-label="Explore west"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => center(selectedIndex)}
          className="lapis-map-control"
          aria-label="Find selected destination"
        >
          <Crosshair size={18} />
        </button>
        <button
          onClick={() =>
            scroller.current?.scrollBy({
              left: step,
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
            })
          }
          className="lapis-map-control"
          aria-label="Explore east"
        >
          <ChevronRight size={18} />
        </button>
      </div>
      {!goals.length && (
        <div className="world-empty">
          <Mountain size={35} />
          <h2>Your world starts here.</h2>
          <p>Add a goal to raise your first mountain.</p>
        </div>
      )}
    </div>
  );
}
