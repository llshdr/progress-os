-- Cardio-type taxonomy (replaces the muscle-group picker for cardio
-- exercises in the UI, but deliberately does NOT repurpose
-- primary_muscle_group itself - computeSlotMuscles (gym-schedule.ts)
-- reads that column from workout_template_exercises with no
-- exercise_type filter, so a cardio exercise added to a template still
-- needs a sane value there. cardio_type is purely additive alongside it.
ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS cardio_type TEXT
  CHECK (cardio_type IN ('running', 'cycling', 'swimming', 'rowing', 'elliptical', 'stair_climber', 'jump_rope', 'hiking', 'walking', 'other'));

-- Same taxonomy on the shared read-only catalog, so CatalogSearch can
-- prefill it exactly like it already does for muscle_group/equipment_type.
ALTER TABLE exercise_catalog ADD COLUMN IF NOT EXISTS cardio_type TEXT
  CHECK (cardio_type IN ('running', 'cycling', 'swimming', 'rowing', 'elliptical', 'stair_climber', 'jump_rope', 'hiking', 'walking', 'other'));

-- Backfill the catalog's existing cardio rows (migration 029). Assault
-- Bike/Battle Ropes are conditioning tools, not discipline-specific
-- training - tagged 'other' rather than stretched to fit 'cycling',
-- since that would wrongly count generic HIIT work as real bike-discipline
-- volume anywhere this taxonomy feeds Races' discipline classification.
UPDATE exercise_catalog SET cardio_type = 'running' WHERE name IN ('Running', 'Treadmill Running');
UPDATE exercise_catalog SET cardio_type = 'cycling' WHERE name IN ('Cycling', 'Stationary Bike');
UPDATE exercise_catalog SET cardio_type = 'rowing' WHERE name = 'Rowing Machine';
UPDATE exercise_catalog SET cardio_type = 'stair_climber' WHERE name = 'Stair Climber';
UPDATE exercise_catalog SET cardio_type = 'elliptical' WHERE name = 'Elliptical';
UPDATE exercise_catalog SET cardio_type = 'jump_rope' WHERE name = 'Jump Rope';
UPDATE exercise_catalog SET cardio_type = 'swimming' WHERE name = 'Swimming';
UPDATE exercise_catalog SET cardio_type = 'other' WHERE name IN ('Assault Bike', 'Battle Ropes');

-- Optional, enrichment-only cardio_logs fields - additive, nothing existing
-- reads these (fetchCardioActivity/CardioActivity, discipline
-- classification, pace targets, current-form derivation, volume analysis
-- all keep working unchanged; these three sit alongside distance/duration
-- for the athlete's own reference and future use, not required by anything).
ALTER TABLE cardio_logs ADD COLUMN IF NOT EXISTS avg_heart_rate INTEGER;
ALTER TABLE cardio_logs ADD COLUMN IF NOT EXISTS perceived_effort INTEGER CHECK (perceived_effort IS NULL OR (perceived_effort >= 0 AND perceived_effort <= 10));
ALTER TABLE cardio_logs ADD COLUMN IF NOT EXISTS elevation_gain_m INTEGER;
