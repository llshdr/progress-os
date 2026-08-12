-- Lightweight kudos on the strength leaderboard - scoped strictly to
-- data the leaderboard already made public (public_lift_records,
-- migration 081), never a general activity feed and never a new
-- exposure surface. Same structural no-leak guarantee as
-- public_lift_records itself: this table only references auth.users(id)
-- twice, plus a lift enum and a timestamp - no path to any private
-- table at all.
--
-- Scoped to (target_user_id, lift), not a specific PR value/event -
-- public_lift_records itself has no history (a deliberate earlier
-- choice, see its own migration), so there's no discrete "PR event" row
-- to attach a reaction to. Reacting to "the row you can currently see"
-- is the honest granularity given what actually exists; if someone PRs
-- again, existing reactions just stay attached to that lift rather than
-- resetting - a still-real, if superseded, number isn't a dishonest
-- thing to have celebrated.
CREATE TABLE IF NOT EXISTS leaderboard_reactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lift TEXT NOT NULL CHECK (lift IN ('bench_press', 'back_squat', 'deadlift', 'overhead_press')),
  reactor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  -- Kudos are for congratulating someone else, not yourself.
  CHECK (target_user_id != reactor_user_id),
  -- One tap per person per lift per target - a toggle, not a counter.
  UNIQUE (target_user_id, lift, reactor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_reactions_target ON leaderboard_reactions(target_user_id, lift);

ALTER TABLE leaderboard_reactions ENABLE ROW LEVEL SECURITY;

-- Same "any authenticated user can view" shape as public_lift_records -
-- who reacted is exactly as public as the PR they reacted to.
CREATE POLICY "Any authenticated user can view leaderboard reactions"
  ON leaderboard_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can add their own reactions"
  ON leaderboard_reactions FOR INSERT WITH CHECK (auth.uid() = reactor_user_id);

CREATE POLICY "Users can remove their own reactions"
  ON leaderboard_reactions FOR DELETE USING (auth.uid() = reactor_user_id);
