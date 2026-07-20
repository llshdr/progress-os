-- Cardio tracking, as a different kind of exercise entry rather than
-- forcing it into the weight/reps shape. exercise_type is a new flag on
-- exercise_library (defaulting 'strength' so every existing exercise is
-- unaffected); cardio_logs is a new parallel leaf table alongside `sets`,
-- keyed 1:1 off an exercise instance (one run per exercise-instance for
-- this first version - no intervals/splits yet). `sets` itself is
-- untouched: its weight/reps NOT NULL shape and every strength stat/chart
-- built on it keep working exactly as before.
ALTER TABLE exercise_library
ADD COLUMN IF NOT EXISTS exercise_type TEXT NOT NULL DEFAULT 'strength' CHECK (exercise_type IN ('strength', 'cardio'));

CREATE TABLE IF NOT EXISTS cardio_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  exercise_id UUID NOT NULL UNIQUE REFERENCES exercises(id) ON DELETE CASCADE,
  distance_km DECIMAL(6, 2) NOT NULL,
  duration_seconds INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_cardio_logs_exercise_id ON cardio_logs(exercise_id);

ALTER TABLE cardio_logs ENABLE ROW LEVEL SECURITY;

-- Same access-through-the-owning-workout pattern already used for `sets`.
CREATE POLICY "Users can view cardio logs from their own exercises"
  ON cardio_logs FOR SELECT
  USING (
    auth.uid() = (
      SELECT w.user_id
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE e.id = cardio_logs.exercise_id
    )
  );

CREATE POLICY "Users can insert cardio logs for their own exercises"
  ON cardio_logs FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT w.user_id
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE e.id = cardio_logs.exercise_id
    )
  );

CREATE POLICY "Users can update cardio logs from their own exercises"
  ON cardio_logs FOR UPDATE
  USING (
    auth.uid() = (
      SELECT w.user_id
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE e.id = cardio_logs.exercise_id
    )
  );

CREATE POLICY "Users can delete cardio logs from their own exercises"
  ON cardio_logs FOR DELETE
  USING (
    auth.uid() = (
      SELECT w.user_id
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE e.id = cardio_logs.exercise_id
    )
  );

CREATE TRIGGER update_cardio_logs_updated_at
  BEFORE UPDATE ON cardio_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
