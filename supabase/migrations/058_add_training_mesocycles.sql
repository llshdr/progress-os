-- Planned strength-training blocks (mesocycles): a length + optional
-- deload week, so the AI Coach recommend route can factor "week N of an
-- M-week block" into its per-set reasoning - the same way raceContext
-- (recommend/route.ts) already does for race-plan phase. Deliberately
-- NOT a generated week-by-week schedule the way Races' periodization is:
-- recommend/route.ts already computes weight/reps per set from real
-- logged history on its own, this table only supplies the missing
-- context (which week, is it a deload) for that existing reasoning to
-- use - see src/lib/mesocycle.ts.
--
-- "Current mesocycle" and "current week within it" are always DERIVED
-- from start_date vs. today, never a separately-stored counter - same
-- self-healing precedent as workout_schedule_slots (migration 033),
-- whose own comment states this principle explicitly: "the app derives
-- which slot is next from real workout history rather than storing a
-- separate, driftable pointer." No overlap constraint either - starting
-- a new block naturally supersedes an still-in-range older one via a
-- "latest start_date wins" tiebreak at read time (see
-- selectActiveMesocycle), so there's no need for an explicit "end this
-- block early" action or a stored "active" flag.
CREATE TABLE IF NOT EXISTS training_mesocycles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  length_weeks INTEGER NOT NULL CHECK (length_weeks BETWEEN 1 AND 16),
  -- 1-based week number within the block that's the deload (e.g. 6 for a
  -- 6-week block that deloads in its final week). NULL = no deload
  -- planned for this block.
  deload_week_number INTEGER CHECK (deload_week_number IS NULL OR deload_week_number BETWEEN 1 AND length_weeks),
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_training_mesocycles_user_id ON training_mesocycles(user_id);
-- Speeds "find the block(s) that could be active today" - the only real
-- query pattern this table needs beyond simple CRUD.
CREATE INDEX IF NOT EXISTS idx_training_mesocycles_user_start_date ON training_mesocycles(user_id, start_date);

ALTER TABLE training_mesocycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mesocycles"
  ON training_mesocycles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own mesocycles"
  ON training_mesocycles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own mesocycles"
  ON training_mesocycles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own mesocycles"
  ON training_mesocycles FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_training_mesocycles_updated_at
  BEFORE UPDATE ON training_mesocycles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
