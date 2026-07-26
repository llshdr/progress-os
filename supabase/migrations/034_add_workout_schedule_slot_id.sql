-- Root fix for the schedule's "Next" slot bug: track which schedule slot a
-- workout was actually started from, rather than inferring it after the
-- fact by matching template_id (ambiguous whenever a template appears more
-- than once in the rotation - it always resolved to the first occurrence).
-- Nullable and ON DELETE SET NULL: a workout not started from a schedule
-- slot (ad-hoc, or started before this fix existed) simply has null here,
-- same as every workout does today.
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS schedule_slot_id UUID REFERENCES workout_schedule_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workouts_schedule_slot_id ON workouts(schedule_slot_id);
