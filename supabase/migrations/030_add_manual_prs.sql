-- Manually-entered PRs (e.g. lifts from before this app existed) shown
-- alongside computed strength/cardio records on /gym/records. These never
-- came from a real logged session, so they get their own table rather than
-- being faked into sets/cardio_logs.
CREATE TABLE IF NOT EXISTS manual_prs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Set when the PR is for an exercise already in the user's library;
  -- exercise_name is used instead for a free-text exercise that isn't (and
  -- won't be created just to hold this one entry).
  exercise_library_id UUID REFERENCES exercise_library(id) ON DELETE SET NULL,
  exercise_name TEXT,
  exercise_type TEXT NOT NULL DEFAULT 'strength' CHECK (exercise_type IN ('strength', 'cardio')),
  weight DECIMAL(6, 2),
  reps INTEGER,
  distance_km DECIMAL(6, 2),
  duration_seconds INTEGER,
  recorded_date DATE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_manual_prs_user_id ON manual_prs(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_prs_exercise_library_id ON manual_prs(exercise_library_id);

ALTER TABLE manual_prs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own manual PRs"
  ON manual_prs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own manual PRs"
  ON manual_prs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own manual PRs"
  ON manual_prs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own manual PRs"
  ON manual_prs FOR DELETE
  USING (auth.uid() = user_id);
