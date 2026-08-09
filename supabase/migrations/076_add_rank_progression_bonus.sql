-- Rank progression bonus: adds a QUALITY dimension alongside the existing
-- CONSISTENCY-only rank (did you log things regularly) - specifically
-- "are you executing your own plan well," never a comparison between
-- different people's real numbers. Additive only (never a floor): a user
-- with no progression data yet gets +0, identical to today's behavior.
--
-- races_progression_signal / gym_progression_signal are written by the
-- client (see rank-progression.ts), which reuses already-built, real
-- logic (assessBenchmarkCompliance for Races, computeStrengthFacts's
-- muscle-group trends - exported from analyze-fitness.ts and called
-- from /gym/records, see gym-progression.ts) rather than reimplementing
-- that in SQL.
-- Both are NUMERIC 0-1 ratios living on user_settings - already
-- owner-only RLS, same trust boundary as every other column there
-- (weekly_workout_goal, count_cardio_toward_workout_goal, etc.). Only
-- the resulting +0/+1 contribution to the single coarse public_profiles
-- rank integer is ever visible to other users - the raw ratios never
-- leave this private table, same guarantee migration 040's own comment
-- established for the rank system from the start.
--
-- Goals' completion_rate/done_count need no new column - already
-- computed inside this function, just also read for the bonus check
-- below.
--
-- Nutrition is deliberately excluded: no macro/target-adherence tracking
-- exists to build a self-referential quality signal from yet. Flagged
-- honestly rather than inventing a proxy.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS races_progression_signal NUMERIC
  CHECK (races_progression_signal IS NULL OR (races_progression_signal >= 0 AND races_progression_signal <= 1));
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS gym_progression_signal NUMERIC
  CHECK (gym_progression_signal IS NULL OR (gym_progression_signal >= 0 AND gym_progression_signal <= 1));

-- Same body as migration 074's recompute_user_rank, with one addition:
-- a second bonus tier (progression_bonus) alongside the existing
-- active_modules bonus, gated on real evidence in at least 2 of the 3
-- measurable modules (never counted before there's enough data - same
-- "insufficient evidence, don't guess" discipline as deriveCurrentFormLevel
-- in the Races feature). Thresholds (0.7/0.6) are a starting point, same
-- "not a locked spec" precedent migration 040 itself states for its own
-- thresholds.
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
  races_progression NUMERIC;
  gym_progression NUMERIC;
  progression_signals_strong INTEGER;
  progression_bonus INTEGER;
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

  SELECT COALESCE(count_cardio_toward_workout_goal, true), races_progression_signal, gym_progression_signal
  INTO count_cardio, races_progression, gym_progression
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

  -- Quality/progression dimension - self-referential per module (each
  -- signal already compares this user only to their own baseline, never
  -- to another user's numbers). Only counts a module "strong" once real
  -- evidence exists (the NULL checks) - a user with no race plan yet or
  -- no strength trend data yet simply doesn't contribute to this count,
  -- never treated as a failing signal.
  progression_signals_strong :=
    (CASE WHEN races_progression IS NOT NULL AND races_progression >= 0.7 THEN 1 ELSE 0 END) +
    (CASE WHEN gym_progression IS NOT NULL AND gym_progression >= 0.6 THEN 1 ELSE 0 END) +
    (CASE WHEN done_count >= 2 AND completion_rate >= 0.7 THEN 1 ELSE 0 END);

  progression_bonus := CASE WHEN progression_signals_strong >= 2 THEN 1 ELSE 0 END;

  final_tier := LEAST(5, base_tier + (CASE WHEN active_modules >= 2 THEN 1 ELSE 0 END) + progression_bonus);

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

-- New trigger source: writes to the two progression-signal columns need
-- to recompute rank too. Scoped with a WHEN clause to exactly those two
-- columns so the dozens of unrelated user_settings writes (weight unit,
-- training phase, etc.) don't trigger a needless recompute - reuses the
-- existing generic trigger_recompute_rank() unchanged (user_settings
-- already has a user_id column, same as workouts/nutrition_entries).
DROP TRIGGER IF EXISTS user_settings_recompute_rank ON user_settings;
CREATE TRIGGER user_settings_recompute_rank
  AFTER UPDATE ON user_settings
  FOR EACH ROW
  WHEN (
    OLD.races_progression_signal IS DISTINCT FROM NEW.races_progression_signal
    OR OLD.gym_progression_signal IS DISTINCT FROM NEW.gym_progression_signal
  )
  EXECUTE FUNCTION trigger_recompute_rank();
