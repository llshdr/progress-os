-- Per-user toggle between the existing rotation-based schedule (advances
-- based on real workout history, self-healing, no calendar rigidity - see
-- migration 033) and a new calendar-locked mode where slot_order is
-- reinterpreted as a fixed weekday index (0=Monday...6=Sunday) instead of a
-- floating rotation position. Deliberately a toggle, not a replacement:
-- existing schedules are completely unaffected until a user explicitly
-- opts in, and nothing about workout_schedule_slots itself changes - both
-- modes read the exact same rows, just interpreting slot_order differently.
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'rotation'
  CHECK (schedule_mode IN ('rotation', 'calendar'));
