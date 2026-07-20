-- Cache for the nutrition-trend AI insight. Same shape and invalidation
-- logic as weight_insight_cache: keyed by the latest contributing
-- nutrition_entries row rather than a calendar day, so it only regenerates
-- when a new entry (or a deletion) actually changes the picture.
CREATE TABLE IF NOT EXISTS nutrition_insight_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latest_entry_id UUID REFERENCES nutrition_entries(id) ON DELETE SET NULL,
  entry_count INTEGER NOT NULL,
  insight_text TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id)
);

ALTER TABLE nutrition_insight_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own nutrition insight cache"
  ON nutrition_insight_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own nutrition insight cache"
  ON nutrition_insight_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own nutrition insight cache"
  ON nutrition_insight_cache FOR UPDATE
  USING (auth.uid() = user_id);
