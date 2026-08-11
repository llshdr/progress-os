-- Tags which of a small, fixed set of "big lifts" an exercise represents -
-- same pattern as cardio_type (migration 073): a nullable, CHECK-
-- constrained column on both the shared read-only exercise_catalog and
-- each user's own exercise_library, NULL = not one of the tracked lifts
-- (the default for every existing row and everything logged going
-- forward without being explicitly tagged). Feeds the new public strength
-- leaderboard (migration 081) - this migration only adds the tagging
-- infrastructure, no exposed data yet.
ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS primary_lift TEXT
  CHECK (primary_lift IN ('bench_press', 'back_squat', 'deadlift', 'overhead_press'));
ALTER TABLE exercise_catalog ADD COLUMN IF NOT EXISTS primary_lift TEXT
  CHECK (primary_lift IN ('bench_press', 'back_squat', 'deadlift', 'overhead_press'));

-- Catalog backfill - these four rows already exist verbatim (migration
-- 029), no new catalog entries needed. Copying one of these into your own
-- library already carries every other enrichment field (muscle_group,
-- equipment_type, cardio_type) the same way, so primary_lift rides along
-- for free the same way.
UPDATE exercise_catalog SET primary_lift = 'bench_press' WHERE name = 'Barbell Bench Press';
UPDATE exercise_catalog SET primary_lift = 'back_squat' WHERE name = 'Barbell Back Squat';
UPDATE exercise_catalog SET primary_lift = 'deadlift' WHERE name = 'Deadlift';
UPDATE exercise_catalog SET primary_lift = 'overhead_press' WHERE name = 'Barbell Overhead Press';

-- Existing exercise_library backfill - conservative, exact-name-match
-- only (no fuzzy/alias matching here - this writes real per-user data,
-- unlike the catalog seed above). Anyone whose bench/squat/deadlift/OHP
-- is named anything else keeps primary_lift NULL until they tag it
-- themselves via the exercise edit form - same "don't guess" discipline
-- this app holds elsewhere, rather than silently assuming a name match.
UPDATE exercise_library SET primary_lift = 'bench_press' WHERE primary_lift IS NULL AND name = 'Barbell Bench Press';
UPDATE exercise_library SET primary_lift = 'back_squat' WHERE primary_lift IS NULL AND name = 'Barbell Back Squat';
UPDATE exercise_library SET primary_lift = 'deadlift' WHERE primary_lift IS NULL AND name = 'Deadlift';
UPDATE exercise_library SET primary_lift = 'overhead_press' WHERE primary_lift IS NULL AND name = 'Barbell Overhead Press';
