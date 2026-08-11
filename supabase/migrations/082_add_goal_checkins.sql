-- Goals redesign toward a lighter, iterative philosophy (not another
-- Races-style batch plan - the existing milestone generator stays, just
-- de-emphasized to an optional "fuller plan" path): an append-only log
-- of "what I'm currently trying" for a goal, replacing a single mutable
-- field with real history for free - the current focus is just the most
-- recent row, no separate "current" column needed.
--
-- ai_suggestion is nullable and filled in AFTER insert, by a follow-up
-- call to the new /api/ai-coach/goal-next-step route - generated on
-- request, attached to whichever checkin was "current" at the time, and
-- reused (not regenerated) on repeat requests unless the caller
-- explicitly forces a fresh one. A single short suggestion, not a
-- milestone batch - deliberately never touches the goal-plan route's
-- generation machinery.
CREATE TABLE IF NOT EXISTS goal_checkins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  focus TEXT NOT NULL,
  ai_suggestion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Fetching a goal's checkins newest-first is the only real query pattern
-- this table needs.
CREATE INDEX IF NOT EXISTS idx_goal_checkins_goal_id ON goal_checkins(goal_id, created_at DESC);

ALTER TABLE goal_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goal checkins"
  ON goal_checkins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own goal checkins"
  ON goal_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
-- UPDATE is needed for the ai_suggestion follow-up write above - the
-- focus text itself is never edited by the UI once logged (a checkin is
-- a real historical entry, not a draft), but there's no need for a
-- narrower column-level policy here since RLS in this app has never
-- gone that granular.
CREATE POLICY "Users can update their own goal checkins"
  ON goal_checkins FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own goal checkins"
  ON goal_checkins FOR DELETE USING (auth.uid() = user_id);
