-- Fix recursive RLS policies on sets table
-- The previous policies referenced the sets table itself, causing recursive RLS evaluation
-- This migration replaces them with non-recursive policies

-- Step 1: Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view sets from their own exercises" ON sets;
DROP POLICY IF EXISTS "Users can insert sets into their own exercises" ON sets;
DROP POLICY IF EXISTS "Users can update sets in their own exercises" ON sets;
DROP POLICY IF EXISTS "Users can delete sets from their own exercises" ON sets;

-- Step 2: Create new non-recursive RLS policies
-- These policies determine ownership through exercise_id -> exercises -> workouts.user_id
-- without selecting from the sets table itself

CREATE POLICY "Users can view sets from their own exercises"
  ON sets FOR SELECT
  USING (
    auth.uid() = (
      SELECT w.user_id 
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE e.id = sets.exercise_id
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
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE e.id = sets.exercise_id
    )
  );

CREATE POLICY "Users can delete sets from their own exercises"
  ON sets FOR DELETE
  USING (
    auth.uid() = (
      SELECT w.user_id 
      FROM exercises e
      JOIN workouts w ON e.workout_id = w.id
      WHERE e.id = sets.exercise_id
    )
  );
