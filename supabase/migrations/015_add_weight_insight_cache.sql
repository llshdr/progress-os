-- Cache for the weight-trend AI insight.
-- Weigh-ins are infrequent/irregular (unlike daily workout suggestions), so
-- this is keyed by the latest contributing weight_entries row rather than a
-- calendar day: the insight only needs regenerating when a new entry (or a
-- deletion) actually changes the picture.
CREATE TABLE IF NOT EXISTS weight_insight_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latest_entry_id UUID REFERENCES weight_entries(id) ON DELETE SET NULL,
  entry_count INTEGER NOT NULL,
  insight_text TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE weight_insight_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for weight_insight_cache
CREATE POLICY "Users can view their own weight insight cache"
  ON weight_insight_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weight insight cache"
  ON weight_insight_cache FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weight insight cache"
  ON weight_insight_cache FOR UPDATE
  USING (auth.uid() = user_id);
