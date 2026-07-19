-- Optional equipment variant tracking for exercises.
-- Machines from different brands (different leverage/ROM at the same weight
-- number) and cables with different pulley ratios (1:1, 2:1) aren't directly
-- comparable even when they're logged under the same library exercise. This
-- lets a user optionally define a small list of variants per exercise and
-- record which one was used for a given workout instance of that exercise.
--
-- Fully additive: both new columns are nullable and every existing exercise
-- and set has none, so nothing changes for anyone who doesn't use this.

-- Variants a user has defined for one library exercise (e.g. "Hammer
-- Strength", "Life Fitness", "1:1", "2:1")
CREATE TABLE IF NOT EXISTS exercise_variants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  exercise_library_id UUID NOT NULL REFERENCES exercise_library(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_exercise_variants_exercise_library_id ON exercise_variants(exercise_library_id);

ALTER TABLE exercise_variants ENABLE ROW LEVEL SECURITY;

-- Access inherited through the owning library exercise, same pattern as
-- workout_template_exercises -> workout_templates.
CREATE POLICY "Users can view variants of their own exercises"
  ON exercise_variants FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM exercise_library WHERE id = exercise_library_id));

CREATE POLICY "Users can insert variants for their own exercises"
  ON exercise_variants FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM exercise_library WHERE id = exercise_library_id));

CREATE POLICY "Users can update variants of their own exercises"
  ON exercise_variants FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM exercise_library WHERE id = exercise_library_id));

CREATE POLICY "Users can delete variants of their own exercises"
  ON exercise_variants FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM exercise_library WHERE id = exercise_library_id));

-- Which variant (if any) was used for this exercise within this workout.
-- Lives on `exercises` (one row per exercise-instance-per-workout), not
-- `sets` - the variant is picked once per session, not per individual set.
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES exercise_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exercises_variant_id ON exercises(variant_id);
