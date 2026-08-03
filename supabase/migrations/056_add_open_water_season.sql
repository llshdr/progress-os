-- Athlete's own stated open-water swim season (month numbers, 1-12),
-- reused across every multisport race rather than per-race - a personal
-- fact about where/when they train, same table/pattern as
-- training_phase/training_intensity. Deliberately no app-maintained
-- regional lookup table - this app has no real data on any specific
-- user's local conditions, so the athlete states their own season or
-- leaves it unset (in which case no seasonality guidance is shown at
-- all - see summarizeSeasonMismatch in src/lib/race-plan/race-day-prep.ts).
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS open_water_season_start_month INTEGER CHECK (open_water_season_start_month BETWEEN 1 AND 12),
ADD COLUMN IF NOT EXISTS open_water_season_end_month INTEGER CHECK (open_water_season_end_month BETWEEN 1 AND 12);
