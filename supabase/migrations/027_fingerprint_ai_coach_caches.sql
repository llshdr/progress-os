-- Replaces date-based invalidation for daily_suggestions with a
-- data-fingerprint approach (matching nutrition/weight insight caches), and
-- adds a settings fingerprint to nutrition_insight_cache so a settings
-- change (maintenance calories, training phase/intensity) correctly
-- triggers regeneration instead of serving text calculated against the old
-- value. New columns are nullable - existing cached rows simply won't
-- match on next read and regenerate once, which is expected and harmless.

ALTER TABLE nutrition_insight_cache
ADD COLUMN IF NOT EXISTS settings_fingerprint TEXT;

ALTER TABLE daily_suggestions
ADD COLUMN IF NOT EXISTS fingerprint TEXT,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW());

-- daily_suggestions has historically held one row per user per day. Moving
-- to a singleton-per-user cache (like nutrition/weight) requires collapsing
-- down to one row per user first, or the new UNIQUE(user_id) constraint
-- below would fail immediately. These are pure regenerable AI-suggestion
-- snapshots, not user-authored data, so pruning old ones is harmless.
DELETE FROM daily_suggestions a
USING daily_suggestions b
WHERE a.user_id = b.user_id
  AND a.created_at < b.created_at;

ALTER TABLE daily_suggestions
ADD CONSTRAINT daily_suggestions_user_id_key UNIQUE (user_id);
