-- Exercise Library table
-- Permanent exercise objects that can be reused across workouts
-- Designed for AI analysis: machine profiles, confidence, recommendations, strength trends
CREATE TABLE exercise_library (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_muscle_group TEXT NOT NULL, -- e.g., 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'
  secondary_muscle_groups TEXT[], -- Array of secondary muscle groups for AI analysis
  equipment_type TEXT NOT NULL, -- e.g., 'Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell'
  category TEXT NOT NULL, -- e.g., 'Compound', 'Isolation', 'Cardio', 'Mobility'
  notes TEXT,
  favorite BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  -- Future AI fields (reserved for future implementation)
  machine_profile_id TEXT, -- Specific machine identifier for gym-specific tracking
  confidence_score INTEGER, -- AI confidence in exercise recognition (1-100)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance
CREATE INDEX idx_exercise_library_user_id ON exercise_library(user_id);
CREATE INDEX idx_exercise_library_name ON exercise_library(name);
CREATE INDEX idx_exercise_library_primary_muscle_group ON exercise_library(primary_muscle_group);
CREATE INDEX idx_exercise_library_equipment_type ON exercise_library(equipment_type);
CREATE INDEX idx_exercise_library_favorite ON exercise_library(favorite) WHERE favorite = true;
CREATE INDEX idx_exercise_library_archived ON exercise_library(archived) WHERE archived = false;

-- Enable Row Level Security
ALTER TABLE exercise_library ENABLE ROW LEVEL SECURITY;

-- RLS policies for exercise_library
CREATE POLICY "Users can view their own exercise library"
  ON exercise_library FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exercises"
  ON exercise_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercises"
  ON exercise_library FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exercises"
  ON exercise_library FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_exercise_library_updated_at
  BEFORE UPDATE ON exercise_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
