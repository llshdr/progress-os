-- Food Library: reusable saved-meal templates for one-click daily logging,
-- alongside (not replacing) the existing manual free-text entry flow.
-- Mirrors exercise_library's shape/pattern directly - own top-level
-- per-user table, RLS scoped by user_id.
CREATE TABLE IF NOT EXISTS food_library (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein_g DECIMAL(6, 1) NOT NULL,
  fat_g DECIMAL(6, 1) NOT NULL,
  carbs_g DECIMAL(6, 1) NOT NULL,
  ingredients TEXT,
  default_meal_tag TEXT CHECK (default_meal_tag IN ('breakfast', 'lunch', 'dinner', 'pwo', 'snack')),
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_food_library_user_id ON food_library(user_id);
CREATE INDEX IF NOT EXISTS idx_food_library_archived ON food_library(archived) WHERE archived = false;

ALTER TABLE food_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own food library"
  ON food_library FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own food library items"
  ON food_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own food library items"
  ON food_library FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own food library items"
  ON food_library FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_food_library_updated_at
  BEFORE UPDATE ON food_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Extend nutrition_food_items so a logged item can optionally reference a
-- food_library template. Macros are snapshotted at log time (logged_*
-- columns) rather than joined live, so editing a template later never
-- rewrites past logged history. All nullable - fully additive, no change
-- to existing ad-hoc food items or to nutrition_entries.
ALTER TABLE nutrition_food_items
ADD COLUMN IF NOT EXISTS food_library_id UUID REFERENCES food_library(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS servings DECIMAL(5, 2) DEFAULT 1,
ADD COLUMN IF NOT EXISTS meal_tag TEXT CHECK (meal_tag IN ('breakfast', 'lunch', 'dinner', 'pwo', 'snack')),
ADD COLUMN IF NOT EXISTS logged_calories INTEGER,
ADD COLUMN IF NOT EXISTS logged_protein_g DECIMAL(6, 1),
ADD COLUMN IF NOT EXISTS logged_fat_g DECIMAL(6, 1),
ADD COLUMN IF NOT EXISTS logged_carbs_g DECIMAL(6, 1);

CREATE INDEX IF NOT EXISTS idx_nutrition_food_items_food_library_id ON nutrition_food_items(food_library_id);
