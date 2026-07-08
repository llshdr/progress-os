-- Add exercise_library_id to exercises table
-- This maintains backward compatibility with existing workouts
-- New workouts will use exercise_library_id, old workouts keep exercise_name

ALTER TABLE exercises 
ADD COLUMN exercise_library_id UUID REFERENCES exercise_library(id) ON DELETE SET NULL;

-- Make exercise_name nullable (will be deprecated over time)
ALTER TABLE exercises 
ALTER COLUMN exercise_name DROP NOT NULL;

-- Add index for performance
CREATE INDEX idx_exercises_exercise_library_id ON exercises(exercise_library_id);

-- Update RLS policies to handle both systems
-- Existing policies still work since exercise_name is still available
-- New policies will check exercise_library ownership when exercise_library_id is present

CREATE POLICY "Users can view exercises from their own workouts (library compat)"
  ON exercises FOR SELECT
  USING (
    auth.uid() = (
      SELECT w.user_id 
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE e.id = exercises.id
    )
    OR
    (
      exercise_library_id IS NOT NULL AND
      auth.uid() = (SELECT user_id FROM exercise_library WHERE id = exercise_library_id)
    )
  );

CREATE POLICY "Users can insert exercises into their own workouts (library compat)"
  ON exercises FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT w.user_id 
      FROM workouts w
      WHERE w.id = exercises.workout_id
    )
    OR
    (
      exercise_library_id IS NOT NULL AND
      auth.uid() = (SELECT user_id FROM exercise_library WHERE id = exercise_library_id)
    )
  );

CREATE POLICY "Users can update exercises in their own workouts (library compat)"
  ON exercises FOR UPDATE
  USING (
    auth.uid() = (
      SELECT w.user_id 
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE e.id = exercises.id
    )
    OR
    (
      exercise_library_id IS NOT NULL AND
      auth.uid() = (SELECT user_id FROM exercise_library WHERE id = exercise_library_id)
    )
  );

CREATE POLICY "Users can delete exercises from their own workouts (library compat)"
  ON exercises FOR DELETE
  USING (
    auth.uid() = (
      SELECT w.user_id 
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE e.id = exercises.id
    )
    OR
    (
      exercise_library_id IS NOT NULL AND
      auth.uid() = (SELECT user_id FROM exercise_library WHERE id = exercise_library_id)
    )
  );

-- Drop old policies that conflict with new ones
DROP POLICY IF EXISTS "Users can view exercises from their own workouts" ON exercises;
DROP POLICY IF EXISTS "Users can insert exercises into their own workouts" ON exercises;
DROP POLICY IF EXISTS "Users can update exercises in their own workouts" ON exercises;
DROP POLICY IF EXISTS "Users can delete exercises from their own workouts" ON exercises;
