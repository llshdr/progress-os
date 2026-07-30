-- One training plan per race (regenerating overwrites, not versioned).
-- weeks is JSONB (a first for this app - everywhere else is normalized)
-- because a plan is always read/replaced as one whole unit and never
-- needs per-week status tracking: progress against a week's target is
-- derived at render time from real cardio/strength data, the same
-- "derive, don't store" pattern already used for races' upcoming/
-- completed split.
CREATE TABLE IF NOT EXISTS race_training_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  race_id UUID NOT NULL UNIQUE REFERENCES races(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approach TEXT NOT NULL CHECK (approach IN ('full_send', 'balanced')),
  overview TEXT NOT NULL,
  weeks JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE race_training_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own race training plans"
  ON race_training_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own race training plans"
  ON race_training_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own race training plans"
  ON race_training_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own race training plans"
  ON race_training_plans FOR DELETE USING (auth.uid() = user_id);
