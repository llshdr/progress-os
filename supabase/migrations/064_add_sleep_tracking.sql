-- Sleep tracking - reuses weight-tracking's exact proven shape (simple log
-- entry -> trend graph -> cached AI insight), see weight_entries/
-- weight_insight_cache (migrations 001, 015). One entry per night, unlike
-- weight (multiple weigh-ins/day is normal) - hence the UNIQUE(user_id,
-- date) that weight_entries deliberately does not have.
--
-- room_temp_c is nullable - hours slept is the one genuinely required
-- field, temperature is a real but optional add-on, same optionality
-- weight_entries gives body_fat_percentage. No subjective quality field:
-- the whole point of this feature is two objective, research-backed
-- comparisons (temp vs. cited optimal range, duration vs. cited
-- guidance) - a 1-5 self-report has no such comparison to check itself
-- against and would just be friction. A trivial additive column later
-- if it turns out to matter, same precedent as set_type/is_unilateral.
CREATE TABLE IF NOT EXISTS sleep_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours_slept NUMERIC NOT NULL,
  room_temp_c NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_sleep_entries_user_id ON sleep_entries(user_id);

ALTER TABLE sleep_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sleep entries"
  ON sleep_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sleep entries"
  ON sleep_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sleep entries"
  ON sleep_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sleep entries"
  ON sleep_entries FOR DELETE USING (auth.uid() = user_id);

-- Cache for the sleep AI insight - same shape/rationale as
-- weight_insight_cache (migration 015): keyed by the latest contributing
-- entry + total count, so it only regenerates when the picture actually
-- changes, not on every page view.
CREATE TABLE IF NOT EXISTS sleep_insight_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latest_entry_id UUID REFERENCES sleep_entries(id) ON DELETE SET NULL,
  entry_count INTEGER NOT NULL,
  insight_text TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id)
);

ALTER TABLE sleep_insight_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sleep insight cache"
  ON sleep_insight_cache FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sleep insight cache"
  ON sleep_insight_cache FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sleep insight cache"
  ON sleep_insight_cache FOR UPDATE USING (auth.uid() = user_id);

-- Display preference for room_temp_c, same "stored in one canonical unit,
-- converted only for display" pattern as weight_unit/weight_entries.weight
-- (see lib/weight.ts). Added alongside sleep tracking since it's the only
-- thing that makes the cited optimal-range comparison legible in the
-- user's own unit.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS temperature_unit TEXT NOT NULL DEFAULT 'c' CHECK (temperature_unit IN ('c', 'f'));
