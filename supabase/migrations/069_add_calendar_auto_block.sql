-- Opt-in per goal/milestone - the existing Calendar all-day chip on the
-- exact target/due date is unchanged and always shown; this adds a
-- SEPARATE real timed block a few days before, purely computed at render
-- time in buildTimedItemsForDate (same "no new row, no drift" pattern
-- gym/races blocks already use there) rather than a stored calendar_entries
-- row - so it's not individually draggable/editable, just a visual nudge.
-- Off by default: most goals don't need a calendar reservation, so this
-- must be a deliberate choice per item, not automatic for every deadline.
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS auto_block_before_deadline BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS auto_block_before_deadline BOOLEAN NOT NULL DEFAULT false;
