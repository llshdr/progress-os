-- Unilateral (one-side-at-a-time) exercise flag - a UI/AI-reasoning
-- signal only (see recommend/route.ts's unilateralContext), not tied
-- into per-side logging or volume counting, which are deliberately out
-- of scope for now. Defaults to false so every existing row (and every
-- exercise created without touching the new toggle) is unaffected.
ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS is_unilateral BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE exercise_catalog ADD COLUMN IF NOT EXISTS is_unilateral BOOLEAN NOT NULL DEFAULT false;

-- One-time backfill for the catalog's own real unilateral entries,
-- matched by the same name patterns src/lib/unilateral.ts uses for the
-- live creation-form suggestion - same "seed known-real data via manual
-- SQL, not app code" precedent as race-course backfills.
UPDATE exercise_catalog
SET is_unilateral = true
WHERE name ~* 'single[-\s]?arm|single[-\s]?leg|one[-\s]?arm|one[-\s]?leg|unilateral|bulgarian|step-?up|pistol|lunge';
