-- Whether a cardio-only completed workout counts toward the weekly
-- workout target (Dashboard progress, the Today-suggestion sentence, the
-- streak badge, and rank's gym consistency signal - see workout-goal.ts).
-- Defaults to true: cardio_logs has existed since migration 026, and none
-- of those consumers ever distinguished exercise_type, so every one of
-- them has always counted a cardio-only workout the same as a strength
-- one. Defaulting to true means no existing user sees a silent change the
-- moment this ships - opting out is an explicit choice.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS count_cardio_toward_workout_goal BOOLEAN NOT NULL DEFAULT true;

-- Same body as migration 071's recompute_user_rank, with one addition:
-- gym_consistency_weeks now respects the toggle above, same as the
-- client-side Dashboard/streak/suggestion queries (workout-goal.ts) - a
-- workout counts if cardio counts for this user, OR it has at least one
-- exercise that isn't confirmed cardio (an ad-hoc exercise with no
-- exercise_library_id has no exercise_type to check and is treated as
-- counting, same "never silently reinterpret old data" precedent used
-- client-side). A workout that's entirely cardio exercises is the only
-- case excluded - a mixed strength+cardio session still counts.
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
  count_cardio BOOLEAN;
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

  SELECT COALESCE(count_cardio_toward_workout_goal, true) INTO count_cardio
  FROM user_settings WHERE user_id = target_user_id;

  IF count_cardio IS NULL THEN
    count_cardio := true;
  END IF;

  SELECT COUNT(DISTINCT date_trunc('week', w.completed_at))
  INTO gym_consistency_weeks
  FROM workouts w
  WHERE w.user_id = target_user_id
    AND w.completed_at IS NOT NULL
    AND w.completed_at > NOW() - INTERVAL '90 days'
    AND (
      count_cardio
      OR EXISTS (
        SELECT 1 FROM exercises e
        LEFT JOIN exercise_library el ON el.id = e.exercise_library_id
        WHERE e.workout_id = w.id
          AND (e.exercise_library_id IS NULL OR el.exercise_type IS DISTINCT FROM 'cardio')
      )
    );

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
