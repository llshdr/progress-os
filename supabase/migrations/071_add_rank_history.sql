-- rank_history: a real trend line for the Profile page, which today only
-- ever shows the live tier (public_profiles.rank is overwritten on every
-- recompute, no history anywhere). A row is inserted ONLY when the tier
-- actually changes - recompute_user_rank fires on every workout/goal/
-- nutrition write, so logging unconditionally would produce a mostly-
-- redundant row per write rather than a meaningful history of when rank
-- actually moved.
CREATE TABLE IF NOT EXISTS rank_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_rank_history_user_id ON rank_history(user_id, recorded_at);

ALTER TABLE rank_history ENABLE ROW LEVEL SECURITY;

-- Read-only from the client's perspective - every row is written by
-- recompute_user_rank (SECURITY DEFINER) below, never inserted directly.
CREATE POLICY "Users can view their own rank history"
  ON rank_history FOR SELECT USING (auth.uid() = user_id);

-- Same body as migration 042's recompute_user_rank, with one addition:
-- capture the previously-stored rank before upserting, and insert a
-- rank_history row only when the newly computed final_tier differs from it.
CREATE OR REPLACE FUNCTION recompute_user_rank(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
  done_count INTEGER;
  archived_count INTEGER;
  completion_rate NUMERIC;
  goal_consistency_weeks INTEGER;
  goal_base_tier INTEGER;
  goal_cap_tier INTEGER;
  goal_tier INTEGER;
  gym_consistency_weeks INTEGER;
  gym_tier INTEGER;
  nutrition_consistency_weeks INTEGER;
  nutrition_tier INTEGER;
  active_modules INTEGER;
  base_tier INTEGER;
  final_tier INTEGER;
  previous_rank INTEGER;
  name TEXT;
  pic TEXT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status = 'done'),
    COUNT(*) FILTER (WHERE status = 'archived')
  INTO done_count, archived_count
  FROM goals WHERE user_id = target_user_id;

  completion_rate := CASE
    WHEN done_count + archived_count = 0 THEN 0
    ELSE done_count::NUMERIC / (done_count + archived_count)
  END;

  SELECT COUNT(DISTINCT date_trunc('week', touched))
  INTO goal_consistency_weeks
  FROM (
    SELECT created_at AS touched FROM goals WHERE user_id = target_user_id
    UNION ALL
    SELECT updated_at FROM goals WHERE user_id = target_user_id
  ) touches
  WHERE touched > NOW() - INTERVAL '90 days';

  goal_base_tier := CASE
    WHEN done_count >= 3 AND completion_rate >= 0.7 AND goal_consistency_weeks >= 6 THEN 5
    WHEN done_count >= 2 AND completion_rate >= 0.6 AND goal_consistency_weeks >= 4 THEN 4
    WHEN done_count >= 1 AND completion_rate >= 0.5 AND goal_consistency_weeks >= 2 THEN 3
    WHEN done_count >= 1 OR goal_consistency_weeks >= 1 THEN 2
    ELSE 1
  END;

  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM goals WHERE user_id = target_user_id AND scope = 'long_term' AND status IN ('done', 'active')) THEN 5
    WHEN EXISTS (SELECT 1 FROM goals WHERE user_id = target_user_id AND scope = 'milestone' AND status IN ('done', 'active')) THEN 4
    ELSE 2
  END INTO goal_cap_tier;

  goal_tier := LEAST(goal_base_tier, goal_cap_tier);

  SELECT COUNT(DISTINCT date_trunc('week', completed_at))
  INTO gym_consistency_weeks
  FROM workouts
  WHERE user_id = target_user_id
    AND completed_at IS NOT NULL
    AND completed_at > NOW() - INTERVAL '90 days';

  gym_tier := CASE
    WHEN gym_consistency_weeks >= 8 THEN 5
    WHEN gym_consistency_weeks >= 6 THEN 4
    WHEN gym_consistency_weeks >= 3 THEN 3
    WHEN gym_consistency_weeks >= 1 THEN 2
    ELSE 1
  END;

  SELECT COUNT(DISTINCT date_trunc('week', date))
  INTO nutrition_consistency_weeks
  FROM nutrition_entries
  WHERE user_id = target_user_id
    AND date > (CURRENT_DATE - INTERVAL '90 days');

  nutrition_tier := CASE
    WHEN nutrition_consistency_weeks >= 8 THEN 5
    WHEN nutrition_consistency_weeks >= 6 THEN 4
    WHEN nutrition_consistency_weeks >= 3 THEN 3
    WHEN nutrition_consistency_weeks >= 1 THEN 2
    ELSE 1
  END;

  base_tier := GREATEST(goal_tier, gym_tier, nutrition_tier);

  active_modules :=
    (CASE WHEN goal_consistency_weeks >= 2 THEN 1 ELSE 0 END) +
    (CASE WHEN gym_consistency_weeks >= 2 THEN 1 ELSE 0 END) +
    (CASE WHEN nutrition_consistency_weeks >= 2 THEN 1 ELSE 0 END);

  final_tier := LEAST(5, base_tier + (CASE WHEN active_modules >= 2 THEN 1 ELSE 0 END));

  SELECT rank INTO previous_rank FROM public_profiles WHERE user_id = target_user_id;

  SELECT COALESCE(p.full_name, split_part(u.email, '@', 1)), p.avatar_url
  INTO name, pic
  FROM profiles p JOIN auth.users u ON u.id = p.id
  WHERE p.id = target_user_id;

  INSERT INTO public_profiles (user_id, display_name, avatar_url, rank)
  VALUES (target_user_id, COALESCE(name, 'User'), pic, final_tier)
  ON CONFLICT (user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      rank = EXCLUDED.rank;

  IF previous_rank IS DISTINCT FROM final_tier THEN
    INSERT INTO rank_history (user_id, rank) VALUES (target_user_id, final_tier);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Backfill: seed one rank_history row per user at their current rank, so
-- the sparkline has at least one real point immediately rather than
-- showing nothing until the next tier change.
INSERT INTO rank_history (user_id, rank, recorded_at)
SELECT user_id, rank, NOW() FROM public_profiles;
