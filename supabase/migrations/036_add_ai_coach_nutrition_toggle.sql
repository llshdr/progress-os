-- Default (and remembered) state for the AI Coach recommendation's optional
-- "factor in today's nutrition" toggle. Defaults true - more signal by
-- default, opting out is the exception. Flipping the toggle in the UI
-- writes back here, so it's both the per-calculation choice and the
-- remembered default for next time, same precedent as training_phase/
-- training_intensity already persisting immediately on change.
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS ai_coach_include_nutrition BOOLEAN NOT NULL DEFAULT true;
