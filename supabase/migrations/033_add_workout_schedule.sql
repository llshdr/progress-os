-- Optional gym schedule: an ordered rotation of workout slots that repeats
-- indefinitely (not locked to calendar days), plus the cache for its
-- optional AI-worded volume summary. Fully additive - no existing table
-- (workout_templates, workout_template_exercises, sets, exercise_library,
-- user_settings) is touched. If a user never creates a slot, this feature
-- is entirely invisible and nothing about existing behavior changes.

-- The rotation itself. Reordering is just an update to slot_order - the
-- app derives "which slot is next" from real workout history rather than
-- storing a separate, driftable pointer.
CREATE TABLE IF NOT EXISTS workout_schedule_slots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
  label TEXT, -- used when template_id is null (e.g. a "Rest Day" slot)
  slot_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  CHECK (template_id IS NOT NULL OR label IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_workout_schedule_slots_user_id ON workout_schedule_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_schedule_slots_template_id ON workout_schedule_slots(template_id);
CREATE INDEX IF NOT EXISTS idx_workout_schedule_slots_slot_order ON workout_schedule_slots(user_id, slot_order);

ALTER TABLE workout_schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own schedule slots"
  ON workout_schedule_slots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own schedule slots"
  ON workout_schedule_slots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedule slots"
  ON workout_schedule_slots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedule slots"
  ON workout_schedule_slots FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_workout_schedule_slots_updated_at
  BEFORE UPDATE ON workout_schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Cache for the optional AI-worded volume summary - same shape/invalidation
-- discipline as nutrition_insight_cache/weight_insight_cache: a singleton
-- row per user, keyed by a fingerprint of the contributing data (latest
-- set, rolling-window boundary, schedule composition), regenerated only
-- when that fingerprint changes.
CREATE TABLE IF NOT EXISTS schedule_volume_insight_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint TEXT,
  insight_text TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE schedule_volume_insight_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own volume insight cache"
  ON schedule_volume_insight_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own volume insight cache"
  ON schedule_volume_insight_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own volume insight cache"
  ON schedule_volume_insight_cache FOR UPDATE
  USING (auth.uid() = user_id);
