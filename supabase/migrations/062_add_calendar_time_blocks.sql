-- Time-block calendar: every calendar item gets a real, editable time and
-- renders as a positioned/sized block, not an untimed banner. Bundled as
-- one migration since all three changes ship together as one feature.

-- calendar_entries: end_time pairs with the existing nullable start_time
-- so a timed entry can be sized as a block. recurrence_weekdays/
-- recurrence_end_date are the smallest possible recurrence model - a
-- SINGLE row, expanded at read time (see entryAppliesToDate in
-- calendar.ts), never materialized into multiple rows and never
-- editable per-occurrence. NULL recurrence_weekdays = a normal one-off
-- entry, exactly as before this migration.
ALTER TABLE calendar_entries
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS recurrence_weekdays INTEGER[],
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;

-- workout_schedule_slots: a slot's usual time, set once at the source
-- (the Schedule page) and read by the calendar - never fabricated, NULL
-- until the user explicitly sets one.
ALTER TABLE workout_schedule_slots ADD COLUMN IF NOT EXISTS usual_time TIME;

-- user_settings: bounds the calendar day view's default scroll position,
-- never a hard filter - an item scheduled outside this range still shows,
-- it's just not where the view opens by default. Safe defaults so the
-- feature works before anyone visits Settings.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS wake_time TIME NOT NULL DEFAULT '06:00:00',
  ADD COLUMN IF NOT EXISTS sleep_time TIME NOT NULL DEFAULT '23:00:00';
