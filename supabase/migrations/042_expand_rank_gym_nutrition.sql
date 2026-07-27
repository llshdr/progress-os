-- Expand rank to also draw from gym and nutrition consistency, so a user
-- who exclusively trains (or exclusively logs nutrition) can still reach
-- every tier without ever touching goals. Combination is "best achievable
-- path, not required path": each module's tier is computed independently
-- and the final rank takes the best of the three, plus a small, capped
-- nudge for genuinely using more than one. This keeps single-module users
-- exactly as capable as multi-module users of reaching Tier 5.
--
-- Gym and nutrition signals are pure activity-presence metadata - which
-- weeks had a completed workout / a logged nutrition day - never
-- workout_type, notes, schedule labels, exercise/set contents, or
-- nutrition calories/macros/food names. Same "structural metadata only"
-- discipline already used for goals (see migration 040).
--
-- Unlike goals, gym/nutrition get no scope-style cap: there's no
-- structural equivalent of "goal size" for a logged workout or nutrition
-- day, and sustained consistency (weeks of real logging) is already a
-- hard-to-fake bar on its own. The existing goal-scope cap continues to
-- apply only to the goal contribution, never to the combined result -
-- otherwise a user with only trivial goals would have their gym/nutrition
-- ceiling wrongly dragged down too.
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

  -- Gym: consistency only, no cap.
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

  -- Nutrition: consistency only, no cap. Presence of a logged day only -
  -- never calories/macros/food items.
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

  -- Best achievable path across modules - never required to combine.
  base_tier := GREATEST(goal_tier, gym_tier, nutrition_tier);

  -- Small, capped nudge for genuinely engaging more than one module - never
  -- more than +1, so it reads as a bonus, not a second axis to grind.
  active_modules :=
    (CASE WHEN goal_consistency_weeks >= 2 THEN 1 ELSE 0 END) +
    (CASE WHEN gym_consistency_weeks >= 2 THEN 1 ELSE 0 END) +
    (CASE WHEN nutrition_consistency_weeks >= 2 THEN 1 ELSE 0 END);

  final_tier := LEAST(5, base_tier + (CASE WHEN active_modules >= 2 THEN 1 ELSE 0 END));

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- New trigger sources - reusing trigger_recompute_rank() unchanged from
-- migration 040 (it already just calls recompute_user_rank(NEW/OLD.user_id),
-- and both workouts and nutrition_entries already have a direct user_id
-- column). Same guarantee as every existing trigger: fires only for the
-- writing row's own user_id, so viewing another user's profile can never
-- trigger a read of that person's private data.
CREATE TRIGGER workouts_recompute_rank
  AFTER INSERT OR UPDATE OR DELETE ON workouts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_rank();

CREATE TRIGGER nutrition_entries_recompute_rank
  AFTER INSERT OR UPDATE OR DELETE ON nutrition_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_rank();

-- Backfill: ranks may shift now that gym/nutrition contribute.
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM recompute_user_rank(u.id);
  END LOOP;
END;
$$;
