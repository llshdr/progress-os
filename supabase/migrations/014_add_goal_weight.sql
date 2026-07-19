-- Add a per-user goal weight setting.
-- Stored in kg internally regardless of the user's weight_unit display
-- preference — weight_unit only controls conversion for display/input, never
-- what's persisted, so switching units later never corrupts this value.
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS goal_weight DECIMAL(5, 2);
