-- First layer of a future Calendar/Schedule module - deliberately just
-- "a place to write in events/commitments" for now. No recurrence, no
-- non-negotiable/type distinction, no link to training_disruptions yet -
-- all left for later as ordinary additive columns/tables, not reserved
-- here (this codebase's own migration history - set_type, is_unilateral,
-- training_mesocycles - already shows additive columns are cheap to add
-- exactly when a layer actually gets built).
--
-- start_date/end_date (both NOT NULL, same CHECK) deliberately mirror
-- training_disruptions' own shape (migration 057) rather than a single
-- date + duration - keeps a future "this trip is also a training
-- disruption" link a straightforward shape match, not a data
-- transformation.
CREATE TABLE IF NOT EXISTS calendar_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL, -- = start_date for a single-day entry
  start_time TIME, -- nullable = all-day/untimed
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_entries_user_id ON calendar_entries(user_id);
-- Speeds "upcoming entries, soonest first" - the only real query pattern
-- this table needs beyond simple CRUD.
CREATE INDEX IF NOT EXISTS idx_calendar_entries_user_start_date ON calendar_entries(user_id, start_date);

ALTER TABLE calendar_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar entries"
  ON calendar_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own calendar entries"
  ON calendar_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own calendar entries"
  ON calendar_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own calendar entries"
  ON calendar_entries FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_calendar_entries_updated_at
  BEFORE UPDATE ON calendar_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
