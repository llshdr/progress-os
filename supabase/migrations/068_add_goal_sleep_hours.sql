-- Optional target for the Sleep chart's goal-line overlay - same
-- optional-target shape as goal_weight (migration 014), grouped with
-- temperature_unit under Settings > Calendar since that's already where
-- this app's other Sleep-adjacent settings live (see migration 064's own
-- comment on temperature_unit). NUMERIC, matching sleep_entries.hours_slept's
-- own type exactly.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS goal_sleep_hours NUMERIC;
