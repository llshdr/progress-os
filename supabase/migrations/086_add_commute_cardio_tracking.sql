-- Commute rides: real, recurring cardio volume (e.g. biking to work) that
-- is fundamentally different from a dedicated training session - it's
-- guaranteed transportation, not a chosen training stimulus, and counting
-- it as extra volume on top of an already-prescribed plan risks real
-- double-counted overtraining. Two separate pieces:
--
-- 1. cardio_logs.source tags each log so the app can tell commute rides
--    apart from real training sessions. Defaults to 'training' - every
--    existing row predates this concept and was a real logged training
--    session, so backfilling anything else would be a fabricated
--    reinterpretation of past data (same "no silent change" precedent as
--    count_cardio_toward_workout_goal's own default, migration 074).
-- 2. user_settings.commute_bike_km_per_week is a DECLARED, stable setting
--    (not derived from logged commute rides week to week) - periodization
--    math subtracts this from prescribed bike volume before generating a
--    plan. Deliberately declared rather than reactive: inferring it from
--    recent logs would make the plan wobble on a week the athlete
--    happened to skip commuting (bad weather, day off), spiking
--    prescribed volume right when it shouldn't. NULL means "no regular
--    commute" - no adjustment applied, existing plans are unaffected.
ALTER TABLE cardio_logs ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'training' CHECK (source IN ('training', 'commute'));

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS commute_bike_km_per_week DECIMAL(6, 2);
