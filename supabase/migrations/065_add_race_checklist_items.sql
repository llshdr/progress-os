-- Race Prep Checklist: a real, trackable version of the gear/prep guidance
-- that already exists as static, read-only text (PACKING_LISTS,
-- race-day-prep.ts). One flat table, category-tagged rather than two
-- tables - "buy this" and "test this" are structurally identical (a title
-- + a done state), only the grouping differs.
--
-- Per-race, not reusable across races: different races need different
-- gear, and "test beforehand" items are tied to that race's own pace
-- targets. done_at is a nullable timestamp rather than a boolean - same
-- one-line toggle cost, but records when an item was checked off for
-- free, matching how this app already prefers real timestamps over flags
-- where cheap (e.g. workouts.completed_at). No separate log table like
-- habit_logs (migration 063) - that pattern exists because a habit is
-- checked per calendar day, repeatedly; a checklist item is checked once,
-- ever, per race, so a second table would be pure overhead.
CREATE TABLE IF NOT EXISTS race_checklist_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('gear', 'test')),
  title TEXT NOT NULL,
  done_at TIMESTAMP WITH TIME ZONE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_race_checklist_items_race_id ON race_checklist_items(race_id);

ALTER TABLE race_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own race checklist items"
  ON race_checklist_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own race checklist items"
  ON race_checklist_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own race checklist items"
  ON race_checklist_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own race checklist items"
  ON race_checklist_items FOR DELETE USING (auth.uid() = user_id);
