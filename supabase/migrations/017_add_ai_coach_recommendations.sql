-- Persisted cache for AI Coach exercise recommendations.
-- Previously this was only cached in-memory client-side (reset on every page
-- reload), so reopening the same exercise later re-called Gemini and could
-- show a different number for no real reason. This persists the last
-- recommendation per user+exercise(+variant) and is only regenerated when a
-- new completed set has actually been logged since - see latest_set_id.
CREATE TABLE IF NOT EXISTS ai_coach_recommendations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Matches the client's existing key format: `${exerciseLibraryId||exerciseName}::${variantLabel??''}`
  cache_key TEXT NOT NULL,
  exercise_library_id UUID REFERENCES exercise_library(id) ON DELETE CASCADE,
  exercise_name TEXT,
  variant_label TEXT,
  weight DECIMAL(6, 2) NOT NULL,
  reps INTEGER NOT NULL,
  reasoning TEXT NOT NULL,
  fallback_weight DECIMAL(6, 2),
  fallback_reps INTEGER,
  -- The most recent completed set that contributed to this recommendation.
  -- Regenerate only when the current most-recent relevant set no longer
  -- matches this id (a new set was logged, or the referenced one was deleted).
  latest_set_id UUID REFERENCES sets(id) ON DELETE SET NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_coach_recommendations_user_cache_key ON ai_coach_recommendations(user_id, cache_key);

ALTER TABLE ai_coach_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ai coach recommendations"
  ON ai_coach_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai coach recommendations"
  ON ai_coach_recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai coach recommendations"
  ON ai_coach_recommendations FOR UPDATE
  USING (auth.uid() = user_id);
