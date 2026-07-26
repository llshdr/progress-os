-- Alternative exercises per template slot (e.g. Squats as an alternative to
-- Leg Press), plus tracking which template slot a live workout's exercise
-- instance actually came from - needed so the live logging screen can look
-- up "does this exercise have alternatives" directly rather than matching
-- on (template_id, exercise_library_id), which breaks the same way the
-- schedule's "Next slot" bug did if one exercise appears in more than one
-- slot of the same template.
--
-- Both pieces are nullable/optional: a template with no alternatives
-- defined, or a workout exercise instance created before this migration
-- (or added ad-hoc, never from a template slot), simply has nothing here
-- and behaves exactly as it does today. No backfill - swapping only makes
-- sense for exercises not yet finished, and completed/in-flight workouts
-- at deploy time have nothing worth backfilling.

CREATE TABLE IF NOT EXISTS workout_template_exercise_alternatives (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_exercise_id UUID NOT NULL REFERENCES workout_template_exercises(id) ON DELETE CASCADE,
  alternative_exercise_library_id UUID NOT NULL REFERENCES exercise_library(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(template_exercise_id, alternative_exercise_library_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_template_exercise_alternatives_template_exercise_id
  ON workout_template_exercise_alternatives(template_exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_template_exercise_alternatives_alt_exercise_id
  ON workout_template_exercise_alternatives(alternative_exercise_library_id);

ALTER TABLE workout_template_exercise_alternatives ENABLE ROW LEVEL SECURITY;

-- Access inherited through the owning template, same nested pattern
-- workout_template_exercises' own policies already use.
CREATE POLICY "Users can view alternatives for their own template exercises"
  ON workout_template_exercise_alternatives FOR SELECT
  USING (
    auth.uid() = (
      SELECT wt.user_id
      FROM workout_template_exercises wte
      JOIN workout_templates wt ON wt.id = wte.template_id
      WHERE wte.id = template_exercise_id
    )
  );

CREATE POLICY "Users can insert alternatives for their own template exercises"
  ON workout_template_exercise_alternatives FOR INSERT
  WITH CHECK (
    auth.uid() = (
      SELECT wt.user_id
      FROM workout_template_exercises wte
      JOIN workout_templates wt ON wt.id = wte.template_id
      WHERE wte.id = template_exercise_id
    )
  );

CREATE POLICY "Users can delete alternatives for their own template exercises"
  ON workout_template_exercise_alternatives FOR DELETE
  USING (
    auth.uid() = (
      SELECT wt.user_id
      FROM workout_template_exercises wte
      JOIN workout_templates wt ON wt.id = wte.template_id
      WHERE wte.id = template_exercise_id
    )
  );

-- Which template slot a live workout's exercise instance was populated
-- from, if any - lets the logging screen look up alternatives directly
-- instead of inferring it after the fact.
ALTER TABLE exercises
ADD COLUMN IF NOT EXISTS template_exercise_id UUID REFERENCES workout_template_exercises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exercises_template_exercise_id ON exercises(template_exercise_id);
