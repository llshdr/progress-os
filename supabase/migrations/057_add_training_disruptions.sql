-- Declared training disruptions (travel/illness/other) - a personal
-- fact about the athlete's life, not any specific race's plan, so this
-- is user-level like open_water_season on user_settings, not tied to
-- race_id. Used to exclude disrupted weeks from the benchmark
-- compliance flag (see src/lib/race-plan/benchmark-verification.ts) -
-- deliberately never read by deriveCurrentFormLevel/current-form.ts,
-- which must keep reflecting real logged activity regardless of why a
-- gap exists.
CREATE TABLE IF NOT EXISTS training_disruptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('travel', 'illness', 'other')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_training_disruptions_user_id ON training_disruptions(user_id);

ALTER TABLE training_disruptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own training disruptions"
  ON training_disruptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own training disruptions"
  ON training_disruptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own training disruptions"
  ON training_disruptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own training disruptions"
  ON training_disruptions FOR DELETE USING (auth.uid() = user_id);
