-- Toggle for whether the dashboard's Today's Suggestions panel is shown.
-- Defaults to on, matching current behavior for everyone until they opt out.
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS show_today_suggestions BOOLEAN NOT NULL DEFAULT true;
