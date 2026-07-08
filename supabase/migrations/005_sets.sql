-- Sets table
-- Stores individual sets within an exercise
-- Designed for AI analysis: progression, consistency, strength trends, machine differences
CREATE TABLE sets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  weight DECIMAL(6, 2) NOT NULL, -- Weight in kg (supports up to 9999.99kg)
  reps INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  set_order INTEGER NOT NULL, -- Order within the exercise
  rpe INTEGER, -- Rate of Perceived Exertion (1-10) for future AI analysis
  rest_time_seconds INTEGER, -- Rest time between sets for consistency tracking
  notes TEXT, -- Form notes,如何 it felt, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance
CREATE INDEX idx_sets_exercise_id ON sets(exercise_id);
CREATE INDEX idx_sets_set_order ON sets(set_order);
CREATE INDEX idx_sets_weight ON sets(weight);
CREATE INDEX idx_sets_reps ON sets(reps);
CREATE INDEX idx_sets_completed ON sets(completed);

-- Enable Row Level Security
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;

-- RLS policies for sets
CREATE POLICY "Users can view sets from their own exercises"
  ON sets FOR SELECT
  USING (
    auth.uid() = (
      SELECT w.user_id 
      FROM sets s
      JOIN exercises e ON s.exercise_id = e.id
      JOIN workouts w ON e.workout_id = w.id
      WHERE s.id = sets.id
    )
  );

CREATE POLICY "Users can insert sets into their own exercises"
  ON sets FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT w.user_id 
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE e.id = sets.exercise_id
    )
  );

CREATE POLICY "Users can update sets in their own exercises"
  ON sets FOR UPDATE
  USING (
    auth.uid() = (
      SELECT w.user_id 
      FROM sets s
      JOIN exercises e ON s.exercise_id = e.id
      JOIN workouts w ON e.workout_id = w.id
      WHERE s.id = sets.id
    )
  );

CREATE POLICY "Users can delete sets from their own exercises"
  ON sets FOR DELETE
  USING (
    auth.uid() = (
      SELECT w.user_id 
      FROM sets s
      JOIN exercises e ON s.exercise_id = e.id
      JOIN workouts w ON e.workout_id = w.id
      WHERE s.id = sets.id
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_sets_updated_at
  BEFORE UPDATE ON sets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
