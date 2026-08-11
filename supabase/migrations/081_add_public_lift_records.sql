-- A real, open strength leaderboard - a deliberate, bounded expansion of
-- what's shared between users, distinct from public_profiles (migration
-- 040, name+rank+picture only) and /profile/compare (deliberately no
-- real numbers at all). This is its own table rather than more columns
-- on public_profiles, so each one's "exactly N columns, no FK to private
-- data" trust story stays independently auditable - same reasoning
-- migration 075 used to justify a new rir column instead of repurposing
-- rpe under a different meaning.
--
-- Exactly 4 tracked lifts (see migration 080's primary_lift tagging) x 2
-- values each: an auto-computed Epley estimate from real logged sets,
-- and an optional self-entered "tested" value (a real 1-rep-max attempt,
-- reusing the EXISTING manual_prs entry flow - no new entry UI). No
-- other column exists here: no date, no note, no rep count, no set
-- count, no workout frequency - nothing beyond the 8 numbers themselves
-- is ever exposed cross-user. display_name/avatar_url are deliberately
-- NOT duplicated onto this table - the leaderboard UI joins against
-- public_profiles (already readable by every authenticated user) for
-- identity, rather than needing a second name/avatar sync trigger
-- alongside profiles_recompute_rank's existing one.
CREATE TABLE IF NOT EXISTS public_lift_records (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bench_estimated_1rm NUMERIC,
  bench_tested_1rm NUMERIC,
  squat_estimated_1rm NUMERIC,
  squat_tested_1rm NUMERIC,
  deadlift_estimated_1rm NUMERIC,
  deadlift_tested_1rm NUMERIC,
  ohp_estimated_1rm NUMERIC,
  ohp_tested_1rm NUMERIC
);

ALTER TABLE public_lift_records ENABLE ROW LEVEL SECURITY;

-- No opt-out for MVP, same precedent public_profiles.rank already sets
-- (every user's rank is always visible, no toggle) - reasonable for a
-- small, invite-code-gated group. No client write policy either - every
-- row is written by recompute_leaderboard_lifts (SECURITY DEFINER)
-- below, never inserted/updated directly.
CREATE POLICY "Any authenticated user can view public lift records"
  ON public_lift_records FOR SELECT TO authenticated USING (true);

-- Epley formula (weight * (1 + reps/30)), same one src/lib/estimate1rm.ts
-- already uses client-side - MAX across the user's own real completed
-- sets for exercises tagged with this lift. set_type IS NULL and
-- is_deload_week = false exclude drop/myo follow-on sets and
-- intentionally-light deload-week sets from counting as a real top-set
-- attempt - the same exclusions already established for the PR-
-- celebration and rank-progression-signal features.
CREATE OR REPLACE FUNCTION compute_lift_estimated_1rm(target_user_id UUID, lift_key TEXT)
RETURNS NUMERIC AS $$
DECLARE
  result NUMERIC;
BEGIN
  SELECT MAX(s.weight * (1 + s.reps / 30.0))
  INTO result
  FROM sets s
  JOIN exercises e ON e.id = s.exercise_id
  JOIN workouts w ON w.id = e.workout_id
  JOIN exercise_library el ON el.id = e.exercise_library_id
  WHERE w.user_id = target_user_id
    AND el.primary_lift = lift_key
    AND s.completed = true
    AND s.set_type IS NULL
    AND s.is_deload_week = false;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- MAX weight across the user's own manual_prs (migration 030) entries for
-- this lift, restricted to reps = 1 - a real logged max-attempt, not
-- another estimate under a different label. A manual entry at reps > 1
-- deliberately does NOT feed either estimated or tested here (it's not a
-- real top-set attempt from logged training, and estimating it would
-- blur "tested" into "yet another estimate, just typed in instead of
-- logged") - it still shows normally on the user's own private Personal
-- Records page, just doesn't reach the leaderboard. Matches by
-- exercise_library_id's own primary_lift tag when linked, or by name/
-- alias against the catalog's tagged rows for a free-text entry - the
-- same fallback shape getExerciseHistory.ts already uses for untagged
-- exercises.
CREATE OR REPLACE FUNCTION compute_lift_tested_1rm(target_user_id UUID, lift_key TEXT)
RETURNS NUMERIC AS $$
DECLARE
  result NUMERIC;
BEGIN
  SELECT MAX(mp.weight)
  INTO result
  FROM manual_prs mp
  LEFT JOIN exercise_library el ON el.id = mp.exercise_library_id
  WHERE mp.user_id = target_user_id
    AND mp.reps = 1
    AND mp.exercise_type = 'strength'
    AND (
      el.primary_lift = lift_key
      OR (
        mp.exercise_library_id IS NULL
        AND EXISTS (
          SELECT 1 FROM exercise_catalog ec
          WHERE ec.primary_lift = lift_key
            AND (ec.name = mp.exercise_name OR mp.exercise_name = ANY(ec.aliases))
        )
      )
    );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- One pass over all 4 tracked lifts, upserting the full row - same shape
-- as recompute_user_rank. SECURITY DEFINER so it can write to
-- public_lift_records (no client write policy) and read the private
-- sets/manual_prs/exercise_library tables it needs internally - same
-- trust boundary recompute_user_rank already uses for goals: real
-- private data goes IN, only the resulting numbers ever come OUT to a
-- cross-user-readable table.
CREATE OR REPLACE FUNCTION recompute_leaderboard_lifts(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public_lift_records (
    user_id,
    bench_estimated_1rm, bench_tested_1rm,
    squat_estimated_1rm, squat_tested_1rm,
    deadlift_estimated_1rm, deadlift_tested_1rm,
    ohp_estimated_1rm, ohp_tested_1rm
  )
  VALUES (
    target_user_id,
    compute_lift_estimated_1rm(target_user_id, 'bench_press'), compute_lift_tested_1rm(target_user_id, 'bench_press'),
    compute_lift_estimated_1rm(target_user_id, 'back_squat'), compute_lift_tested_1rm(target_user_id, 'back_squat'),
    compute_lift_estimated_1rm(target_user_id, 'deadlift'), compute_lift_tested_1rm(target_user_id, 'deadlift'),
    compute_lift_estimated_1rm(target_user_id, 'overhead_press'), compute_lift_tested_1rm(target_user_id, 'overhead_press')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET bench_estimated_1rm = EXCLUDED.bench_estimated_1rm,
      bench_tested_1rm = EXCLUDED.bench_tested_1rm,
      squat_estimated_1rm = EXCLUDED.squat_estimated_1rm,
      squat_tested_1rm = EXCLUDED.squat_tested_1rm,
      deadlift_estimated_1rm = EXCLUDED.deadlift_estimated_1rm,
      deadlift_tested_1rm = EXCLUDED.deadlift_tested_1rm,
      ohp_estimated_1rm = EXCLUDED.ohp_estimated_1rm,
      ohp_tested_1rm = EXCLUDED.ohp_tested_1rm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ─── Trigger sources ───────────────────────────────────────────────────

-- manual_prs has user_id directly and is written rarely (a human typing
-- in a number occasionally, nothing like sets' per-workout write volume)
-- - no WHEN-clause optimization needed, same unconditional-per-write
-- shape goals_recompute_rank already uses.
CREATE OR REPLACE FUNCTION trigger_recompute_leaderboard_from_manual_prs()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_leaderboard_lifts(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_leaderboard_lifts(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER manual_prs_recompute_leaderboard
  AFTER INSERT OR UPDATE OR DELETE ON manual_prs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_leaderboard_from_manual_prs();

-- Retroactively tagging or untagging an exercise as a tracked lift needs
-- to recompute too, so already-logged history starts (or stops) counting
-- immediately rather than waiting for the next set logged on it.
CREATE OR REPLACE FUNCTION trigger_recompute_leaderboard_from_library()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recompute_leaderboard_lifts(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER exercise_library_recompute_leaderboard
  AFTER UPDATE ON exercise_library
  FOR EACH ROW
  WHEN (OLD.primary_lift IS DISTINCT FROM NEW.primary_lift)
  EXECUTE FUNCTION trigger_recompute_leaderboard_from_library();

-- sets is the one genuinely high-frequency write source here (logged
-- dozens of times per workout, for every exercise, most of which are not
-- one of the 4 tracked lifts) - and the one table with no user_id column
-- of its own, so ownership has to resolve through exercise_id ->
-- exercises.workout_id -> workouts.user_id first. A WHEN clause can't
-- express "is this even a tracked lift" (that needs a join, not a plain
-- OLD/NEW column comparison), so the same "only recompute on real
-- change" discipline migration 076's WHEN clause established is done
-- here as an early-return inside the function body instead - the goal
-- is identical, just implemented one layer down because the relevant
-- fact isn't on the row itself.
CREATE OR REPLACE FUNCTION trigger_recompute_leaderboard_from_sets()
RETURNS TRIGGER AS $$
DECLARE
  v_exercise_id UUID;
  v_user_id UUID;
  v_lift_key TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_exercise_id := OLD.exercise_id;
  ELSE
    v_exercise_id := NEW.exercise_id;
  END IF;

  SELECT w.user_id, el.primary_lift
  INTO v_user_id, v_lift_key
  FROM exercises e
  JOIN workouts w ON w.id = e.workout_id
  LEFT JOIN exercise_library el ON el.id = e.exercise_library_id
  WHERE e.id = v_exercise_id;

  IF v_lift_key IS NOT NULL THEN
    PERFORM recompute_leaderboard_lifts(v_user_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER sets_recompute_leaderboard
  AFTER INSERT OR UPDATE OR DELETE ON sets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_leaderboard_from_sets();

-- Backfill: reflect existing real training data immediately (including
-- the exercise_library backfill migration 080 just did) rather than
-- waiting for each user's next set/manual PR to populate their row -
-- same DO-block shape migration 040's own backfill already uses.
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM recompute_leaderboard_lifts(u.id);
  END LOOP;
END;
$$;
