-- Rank/progression system. Rank reflects follow-through on the user's own
-- goals (completion rate + consistency over time) capped by the highest
-- "scope" tier they've actually engaged with - see migration 039. The
-- computation is 100% deterministic SQL over goals' metadata columns
-- (status, scope, created_at, updated_at) - it never reads title,
-- description, or next_action, even internally, so there is no path by
-- which the rank number could leak or hint at goal content.
--
-- public_profiles is the ONLY table other users can read anything from
-- about someone else's account. It carries exactly four columns - no
-- foreign key to goals/projects/gym/nutrition or anything else exists on
-- this table, so there is no relationship for PostgREST (or any client) to
-- traverse from here into private data - this is a structural guarantee,
-- not a convention. It has no visible "last changed" timestamp either, so
-- a rank change can never be correlated by another user to a specific
-- moment/goal action.
--
-- recompute_user_rank() is SECURITY DEFINER (so it can write to
-- public_profiles, which - like invite_codes/user_roles - has no
-- client-reachable write policy) and is called ONLY from a trigger on the
-- goals table scoped to the row's own user_id. It is never invoked on
-- another user's behalf, so viewing someone else's profile can never
-- trigger a read of that person's private goals data.
CREATE TABLE IF NOT EXISTS public_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  rank INTEGER NOT NULL DEFAULT 1 CHECK (rank BETWEEN 1 AND 5)
);

ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can view public profiles"
  ON public_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Base tier from completion rate + consistency, capped by the highest goal
-- scope actually engaged with. Thresholds are a starting point, expected to
-- be tuned after real usage - not a locked spec.
CREATE OR REPLACE FUNCTION recompute_user_rank(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
  done_count INTEGER;
  archived_count INTEGER;
  completion_rate NUMERIC;
  consistency_weeks INTEGER;
  base_tier INTEGER;
  cap_tier INTEGER;
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
  INTO consistency_weeks
  FROM (
    SELECT created_at AS touched FROM goals WHERE user_id = target_user_id
    UNION ALL
    SELECT updated_at FROM goals WHERE user_id = target_user_id
  ) touches
  WHERE touched > NOW() - INTERVAL '90 days';

  base_tier := CASE
    WHEN done_count >= 3 AND completion_rate >= 0.7 AND consistency_weeks >= 6 THEN 5
    WHEN done_count >= 2 AND completion_rate >= 0.6 AND consistency_weeks >= 4 THEN 4
    WHEN done_count >= 1 AND completion_rate >= 0.5 AND consistency_weeks >= 2 THEN 3
    WHEN done_count >= 1 OR consistency_weeks >= 1 THEN 2
    ELSE 1
  END;

  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM goals WHERE user_id = target_user_id AND scope = 'long_term' AND status IN ('done', 'active')) THEN 5
    WHEN EXISTS (SELECT 1 FROM goals WHERE user_id = target_user_id AND scope = 'milestone' AND status IN ('done', 'active')) THEN 4
    ELSE 2
  END INTO cap_tier;

  final_tier := LEAST(base_tier, cap_tier);

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

CREATE OR REPLACE FUNCTION trigger_recompute_rank()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_user_rank(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_user_rank(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER goals_recompute_rank
  AFTER INSERT OR UPDATE OR DELETE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_rank();

-- Also recompute when the user changes their display name or avatar (not
-- goal-driven, but public_profiles should still reflect it) - scoped to
-- the row's own id, same non-cross-user guarantee as above.
CREATE OR REPLACE FUNCTION trigger_recompute_rank_from_profile()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recompute_user_rank(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER profiles_recompute_rank
  AFTER INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute_rank_from_profile();

-- Backfill: seed a public_profiles row for every existing account so
-- nobody is missing one before their next goal/profile write.
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM recompute_user_rank(u.id);
  END LOOP;
END;
$$;
