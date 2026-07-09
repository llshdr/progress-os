-- Workout Template Exercises table
-- Links exercises to workout templates with target parameters
CREATE TABLE workout_template_exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_library_id UUID NOT NULL REFERENCES exercise_library(id) ON DELETE CASCADE,
  exercise_order INTEGER NOT NULL,
  target_sets INTEGER, -- Target number of sets for this exercise
  target_rep_range_min INTEGER, -- Minimum target reps
  target_rep_range_max INTEGER, -- Maximum target reps
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance
CREATE INDEX idx_workout_template_exercises_template_id ON workout_template_exercises(template_id);
CREATE INDEX idx_workout_template_exercises_exercise_library_id ON workout_template_exercises(exercise_library_id);
CREATE INDEX idx_workout_template_exercises_exercise_order ON workout_template_exercises(exercise_order);

-- Enable Row Level Security
ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;

-- RLS policies for workout_template_exercises
-- Access is inherited through the owning template
CREATE POLICY "Users can view exercises from their own templates"
  ON workout_template_exercises FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM workout_templates WHERE id = template_id));

CREATE POLICY "Users can insert exercises into their own templates"
  ON workout_template_exercises FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM workout_templates WHERE id = template_id));

CREATE POLICY "Users can update exercises in their own templates"
  ON workout_template_exercises FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM workout_templates WHERE id = template_id));

CREATE POLICY "Users can delete exercises from their own templates"
  ON workout_template_exercises FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM workout_templates WHERE id = template_id));

-- Trigger for updated_at
CREATE TRIGGER update_workout_template_exercises_updated_at
  BEFORE UPDATE ON workout_template_exercises
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
