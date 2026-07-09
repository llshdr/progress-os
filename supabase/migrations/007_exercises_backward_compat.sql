-- Add exercise_library_id to exercises table
-- This maintains backward compatibility with existing workouts
-- New workouts will use exercise_library_id, old workouts keep exercise_name

-- Step 1: Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view exercises from their own workouts" ON exercises;
DROP POLICY IF EXISTS "Users can insert exercises into their own workouts" ON exercises;
DROP POLICY IF EXISTS "Users can update exercises in their own workouts" ON exercises;
DROP POLICY IF EXISTS "Users can delete exercises from their own workouts" ON exercises;

-- Step 2: Perform schema changes
ALTER TABLE exercises 
ADD COLUMN exercise_library_id UUID REFERENCES exercise_library(id) ON DELETE SET NULL;

-- Make exercise_name nullable (will be deprecated over time)
ALTER TABLE exercises 
ALTER COLUMN exercise_name DROP NOT NULL;

-- Add index for performance
CREATE INDEX idx_exercises_exercise_library_id ON exercises(exercise_library_id);

-- Step 3: Create new simplified RLS policies
-- Exercises inherit access through their owning workout
-- exercise_library_id is just a reference, not an ownership check
CREATE POLICY "Users can view exercises from their own workouts"
  ON exercises FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM workouts WHERE id = exercises.workout_id));

CREATE POLICY "Users can insert exercises into their own workouts"
  ON exercises FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM workouts WHERE id = exercises.workout_id));

CREATE POLICY "Users can update exercises in their own workouts"
  ON exercises FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM workouts WHERE id = exercises.workout_id));

CREATE POLICY "Users can delete exercises from their own workouts"
  ON exercises FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM workouts WHERE id = exercises.workout_id));
