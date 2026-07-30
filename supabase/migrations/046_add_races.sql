-- Known race courses per series, for a structured picker with a free-text
-- fallback. Shared reference data (not user-owned) - read-only for every
-- authenticated user, same "no client write policy" shape as invite_codes;
-- new courses are added via manual SQL, not the app.
CREATE TABLE IF NOT EXISTS race_courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  race_type TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE race_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view race courses"
  ON race_courses FOR SELECT
  USING (auth.role() = 'authenticated');

INSERT INTO race_courses (race_type, name, display_order) VALUES
  ('ironman', 'Barcelona', 0),
  ('ironman', 'Kalmar', 1),
  ('ironman', 'Copenhagen', 2),
  ('norseman', 'Norseman (Norway)', 0),
  ('swedeman', 'Swedeman (Sweden)', 0);

-- Races a user has done or has coming up. race_type drives which
-- race_courses rows to offer as a picker (see src/lib/race-constants.ts);
-- location is a free-text fallback for anything not in that list.
-- Upcoming vs. completed is derived from race_date vs. today at render
-- time - no stored status column.
CREATE TABLE IF NOT EXISTS races (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_type TEXT NOT NULL CHECK (race_type IN
    ('ironman', 'norseman', 'swedeman', 'marathon', 'half_marathon', '10k', '5k', 'ultra_run', 'other')),
  course_id UUID REFERENCES race_courses(id) ON DELETE SET NULL,
  location TEXT,
  race_date DATE NOT NULL,
  result_duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_races_user_id ON races(user_id);

ALTER TABLE races ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own races"
  ON races FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own races"
  ON races FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own races"
  ON races FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own races"
  ON races FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_races_updated_at
  BEFORE UPDATE ON races
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
