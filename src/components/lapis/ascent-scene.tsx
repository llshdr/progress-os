"use client";
import { Check } from "lucide-react";
import { worldStyle, type JourneyGoal } from "@/lib/journey";
import { goalProgress, worldScenery } from "@/lib/world-progress";
import { Avatar } from "./app-provider";
import { useWorld } from "./world-provider";
import SummitFlag from "./summit-flag";
const points = [
  [46, 89],
  [68, 75],
  [77, 61],
  [62, 48],
  [74, 34],
  [71, 18],
];
function position(progress: number) {
  const n = Math.min(
    points.length - 1,
    Math.max(0, progress) * (points.length - 1),
  );
  const i = Math.floor(n);
  const a = points[i],
    b = points[Math.min(i + 1, points.length - 1)];
  return {
    left: `${a[0] + (b[0] - a[0]) * (n - i)}%`,
    top: `${a[1] + (b[1] - a[1]) * (n - i)}%`,
  };
}
export default function AscentScene({
  goal,
  onMilestone,
}: {
  goal: JourneyGoal;
  onMilestone: (id: string) => void;
}) {
  const progress = goalProgress(goal);
  const { data } = useWorld();
  const milestones = (goal.milestones ?? []).filter(
    (m) => m.status !== "archived",
  );
  return (
    <div
      className="ascent-scene"
      data-ascent={progress.ascent}
      aria-label={`${goal.title}: ${progress.reached} of ${progress.total} milestones reached`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Pre-compressed portrait scene; coordinate system matches the artwork. */}
      <img
        className="ascent-art"
        src={worldScenery(worldStyle(goal))}
        alt="A stone path winding up through an alpine landscape"
        width="1024"
        height="1536"
        style={{
          filter:
            goal.status === "done"
              ? "brightness(1.06) saturate(1.05)"
              : `brightness(${0.7 + progress.ascent * 0.22}) saturate(.9)`,
        }}
      />
      {milestones.slice(0, 8).map((m, i) => (
        <button
          key={m.id}
          onClick={() => onMilestone(m.id)}
          className={`ascent-pin ${m.status === "done" ? "is-done" : ""} ${progress.next?.id === m.id ? "is-next" : ""}`}
          style={position(
            ((i + 1) / (Math.min(milestones.length, 8) + 1)) * 0.88,
          )}
          aria-label={`Milestone: ${m.title}`}
          aria-current={progress.next?.id === m.id ? "step" : undefined}
        >
          <span>{m.status === "done" ? <Check size={12} /> : i + 1}</span>
          <small className="ascent-pin-label">{m.title}</small>
        </button>
      ))}
      {goal.status === "done" ? (
        <div className="ascent-summit">
          <SummitFlag large country={goal.summit_country || data?.country} />
        </div>
      ) : (
        <div className="ascent-climber" style={position(progress.ascent)}>
          <span className="avatar-marker">
            <Avatar />
          </span>
          <small>You are here</small>
        </div>
      )}
      <div className="ascent-location">
        <p className="lapis-eyebrow">
          {goal.status === "done" ? "Your summit" : "Your ascent"}
        </p>
        <p className="mt-1 text-sm font-medium">
          {goal.status === "done"
            ? "You made it here."
            : progress.total
              ? `${progress.reached} of ${progress.total} milestones reached`
              : "Add your first milestone to begin."}
        </p>
      </div>
    </div>
  );
}
