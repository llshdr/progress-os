-- Daily AI Coach suggestions cache
-- One row per user per day. `suggestions` holds a JSON array of
-- { module, text, action: { label, href } | null } objects, generated
-- once per day and reused on subsequent dashboard visits.
CREATE TABLE IF NOT EXISTS daily_suggestions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, suggestion_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_suggestions_user_date ON daily_suggestions(user_id, suggestion_date);

-- Enable Row Level Security
ALTER TABLE daily_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_suggestions
CREATE POLICY "Users can view their own daily suggestions"
  ON daily_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily suggestions"
  ON daily_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily suggestions"
  ON daily_suggestions FOR UPDATE
  USING (auth.uid() = user_id);
