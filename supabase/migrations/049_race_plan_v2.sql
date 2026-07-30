-- Self-report answers (skippable, per-race-type question set) and an
-- optional user-stated goal time - both persist independently of plan
-- generation/regeneration, unlike race_training_plans.weeks which is
-- fully replaced each time.
ALTER TABLE races ADD COLUMN IF NOT EXISTS self_assessment JSONB;
ALTER TABLE races ADD COLUMN IF NOT EXISTS target_finish_seconds INTEGER;

-- Generalize approach from a binary choice to a 5-stop spectrum.
UPDATE race_training_plans SET approach = 'race_focused' WHERE approach = 'full_send';
-- 'balanced' already matches one of the new values - no update needed.

ALTER TABLE race_training_plans DROP CONSTRAINT race_training_plans_approach_check;
ALTER TABLE race_training_plans ADD CONSTRAINT race_training_plans_approach_check CHECK (approach IN
  ('race_focused', 'race_leaning', 'balanced', 'muscle_leaning', 'muscle_focused'));
