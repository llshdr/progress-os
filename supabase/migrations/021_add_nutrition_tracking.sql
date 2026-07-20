-- First version of nutrition tracking: manual daily entry (copied over from
-- an external app like Lifesum), not a food database or third-party
-- integration. See src/lib/nutrition.ts for the maintenance/phase/activity
-- target formula this backs.

-- Manually-entered baseline maintenance calories (no auto-calculation yet).
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS maintenance_calories INTEGER;

-- One row per user per day. protein/fat/carbs in grams. activity_adjustment_kcal
-- is an optional manual bump for days with extra activity (e.g. "did extra
-- cardio"), added on top of maintenance_calories for that day's effective target.
CREATE TABLE IF NOT EXISTS nutrition_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  calories INTEGER NOT NULL,
  protein_g DECIMAL(6, 1) NOT NULL,
  fat_g DECIMAL(6, 1) NOT NULL,
  carbs_g DECIMAL(6, 1) NOT NULL,
  activity_adjustment_kcal INTEGER,
  activity_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_entries_user_date ON nutrition_entries(user_id, date);

ALTER TABLE nutrition_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own nutrition entries"
  ON nutrition_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own nutrition entries"
  ON nutrition_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nutrition entries"
  ON nutrition_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own nutrition entries"
  ON nutrition_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_nutrition_entries_updated_at
  BEFORE UPDATE ON nutrition_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional named food items for a day's entry - all fields beyond name are
-- optional, since most users just want the daily totals, not a full diary.
CREATE TABLE IF NOT EXISTS nutrition_food_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES nutrition_entries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logged_at TIMESTAMP WITH TIME ZONE,
  ingredients TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_nutrition_food_items_entry_id ON nutrition_food_items(entry_id);

ALTER TABLE nutrition_food_items ENABLE ROW LEVEL SECURITY;

-- Access inherited through the owning entry, same pattern as
-- workout_template_exercises -> workout_templates.
CREATE POLICY "Users can view food items in their own entries"
  ON nutrition_food_items FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM nutrition_entries WHERE id = entry_id));

CREATE POLICY "Users can insert food items into their own entries"
  ON nutrition_food_items FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM nutrition_entries WHERE id = entry_id));

CREATE POLICY "Users can update food items in their own entries"
  ON nutrition_food_items FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM nutrition_entries WHERE id = entry_id));

CREATE POLICY "Users can delete food items from their own entries"
  ON nutrition_food_items FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM nutrition_entries WHERE id = entry_id));
