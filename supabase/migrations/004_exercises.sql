-- Exercises table
-- Stores exercises within a workout
CREATE TABLE exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  equipment TEXT, -- e.g., 'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight'
  gym_name TEXT, -- Optional: specific gym/machine identifier for AI analysis
  notes TEXT,
  exercise_order INTEGER NOT NULL, -- Order within the workout
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance
CREATE INDEX idx_exercises_workout_id ON exercises(workout_id);
CREATE INDEX idx_exercises_exercise_name ON exercises(exercise_name);
CREATE INDEX idx_exercises_equipment ON exercises(equipment);
CREATE INDEX idx_exercises_exercise_order ON exercises(exercise_order);

-- Enable Row Level Security
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- RLS policies for exercises
CREATE POLICY "Users can view exercises from their own workouts"
  ON exercises FOR SELECT
  USING (
    auth.uid() = (
      SELECT user_id FROM workouts WHERE workouts.id = exercises.workout_id
    )
  );

CREATE POLICY "Users can insert exercises into their own workouts"
  ON exercises FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM workouts WHERE workouts.id = exercises.workout_id
    )
  );

CREATE POLICY "Users can update exercises in their own workouts"
  ON exercises FOR UPDATE
  USING (
    auth.uid() = (
      SELECT user_id FROM workouts WHERE workouts.id = exercises.workout_id
    )
  );

CREATE POLICY "Users can delete exercises from their own workouts"
  ON exercises FOR DELETE
  USING (
    auth.uid() = (
      SELECT user_id FROM workouts WHERE workouts.id = exercises.workout_id
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_exercises_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
