-- Add template_id to workouts table
-- This maintains backward compatibility with existing workouts
-- New workouts will use template_id, old workouts keep workout_type

-- Step 1: Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view their own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can insert their own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can update their own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can delete their own workouts" ON workouts;

-- Step 2: Perform schema changes
ALTER TABLE workouts 
ADD COLUMN template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL;

-- Make workout_type nullable (will be deprecated over time)
ALTER TABLE workouts 
ALTER COLUMN workout_type DROP NOT NULL;

-- Add index for performance
CREATE INDEX idx_workouts_template_id ON workouts(template_id);

-- Step 3: Create new RLS policies
CREATE POLICY "Users can view their own workouts"
  ON workouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workouts"
  ON workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts"
  ON workouts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts"
  ON workouts FOR DELETE
  USING (auth.uid() = user_id);
