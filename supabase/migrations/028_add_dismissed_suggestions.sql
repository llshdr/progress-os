-- Dismiss-for-today state for the Today Planning page. Deliberately
-- separate from daily_suggestions: that table is fingerprint-cached
-- (regenerates only when contributing data/settings actually change), but
-- "I've seen this, hide it" is a same-day user preference, not a
-- data-freshness concern - it should reset on its own each new calendar
-- day, independent of whether the underlying suggestions regenerated.
CREATE TABLE IF NOT EXISTS dismissed_suggestions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_key TEXT NOT NULL,
  dismissed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, suggestion_key, dismissed_date)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_suggestions_user_date ON dismissed_suggestions(user_id, dismissed_date);

ALTER TABLE dismissed_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dismissed suggestions"
  ON dismissed_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dismissed suggestions"
  ON dismissed_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dismissed suggestions"
  ON dismissed_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dismissed suggestions"
  ON dismissed_suggestions FOR DELETE
  USING (auth.uid() = user_id);
