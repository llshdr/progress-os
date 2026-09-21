type Library = { exercise_type?: string; cardio_type?: string };
type Log = { distance_km: number | string; source?: string };
export type TrainingWorkout = {
  exercises?: {
    exercise_library?: Library | Library[] | null;
    cardio_logs?: Log | Log[] | null;
  }[];
};
export function trainingActuals(workouts: TrainingWorkout[]) {
  const total = { swim: 0, bike: 0, run: 0, cardio: 0, strength: 0 };
  const types: Record<string, "swim" | "bike" | "run"> = {
    swimming: "swim",
    cycling: "bike",
    running: "run",
  };
  for (const workout of workouts) {
    let strength = false;
    for (const exercise of workout.exercises ?? []) {
      const library = Array.isArray(exercise.exercise_library)
        ? exercise.exercise_library[0]
        : exercise.exercise_library;
      if (library?.exercise_type === "strength") strength = true;
      if (library?.exercise_type !== "cardio") continue;
      // PostgREST returns an object for the unique cardio_logs.exercise_id relation.
      const logs = Array.isArray(exercise.cardio_logs)
        ? exercise.cardio_logs
        : exercise.cardio_logs
          ? [exercise.cardio_logs]
          : [];
      const km = logs
        .filter((log) => log.source !== "commute")
        .reduce((sum, log) => sum + (Number(log.distance_km) || 0), 0);
      total.cardio += km;
      const kind = types[library.cardio_type ?? ""];
      if (kind) total[kind] += km;
    }
    if (strength) total.strength++;
  }
  return total;
}
