-- Living World: personal scenery and progress, independent of public rank.
-- Additive only. Existing training, nutrition and goal history stay in place.
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS world_country text
  CHECK (world_country IS NULL OR world_country ~ '^[A-Z]{2}$');
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS reached_at timestamptz;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS summit_country text
  CHECK (summit_country IS NULL OR summit_country ~ '^[A-Z]{2}$');
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS reached_at timestamptz;

CREATE OR REPLACE FUNCTION public.record_world_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'done') THEN
    -- Reopening and completing again never generates a new achievement date.
    NEW.reached_at := coalesce(NEW.reached_at, now());
    IF TG_TABLE_NAME = 'goals' THEN
      IF NEW.summit_country IS NULL THEN
        -- ZZ is a frozen LAPIS flag, distinct from legacy unsnapshotted NULL.
        SELECT coalesce((SELECT world_country FROM user_settings WHERE user_id = NEW.user_id),'ZZ') INTO NEW.summit_country;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER record_goal_summit BEFORE INSERT OR UPDATE OF status ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.record_world_completion();
CREATE TRIGGER record_milestone_reached BEFORE INSERT OR UPDATE OF status ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.record_world_completion();

ALTER TABLE public.calendar_entries ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;
ALTER TABLE public.calendar_entries ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.goal_checkins ADD COLUMN IF NOT EXISTS calendar_entry_id uuid REFERENCES public.calendar_entries(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS goal_checkins_calendar_entry_unique ON public.goal_checkins(calendar_entry_id) WHERE calendar_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS calendar_entries_goal_idx ON public.calendar_entries(goal_id);

CREATE OR REPLACE FUNCTION public.check_world_goal_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.goal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM goals WHERE id = NEW.goal_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Goal not available';
  END IF;
  IF TG_TABLE_NAME = 'calendar_entries' THEN
    IF NEW.goal_id IS NOT NULL AND (coalesce(cardinality(NEW.recurrence_weekdays),0) > 0 OR NEW.start_date <> NEW.end_date) THEN
      RAISE EXCEPTION 'A goal step needs a single date. Use a regular event for recurring or multi-day plans.';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'goal_checkins' THEN
    IF NEW.calendar_entry_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM calendar_entries WHERE id = NEW.calendar_entry_id AND user_id = NEW.user_id AND goal_id = NEW.goal_id
    ) THEN RAISE EXCEPTION 'Plan entry not available'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER calendar_goal_owner BEFORE INSERT OR UPDATE ON public.calendar_entries
  FOR EACH ROW EXECUTE FUNCTION public.check_world_goal_owner();
CREATE TRIGGER checkin_goal_owner BEFORE INSERT OR UPDATE ON public.goal_checkins
  FOR EACH ROW EXECUTE FUNCTION public.check_world_goal_owner();

-- Completing a planned goal step and recording its check-in is one transaction.
-- Repeated taps/retries do not create duplicate check-ins; Undo removes only it.
CREATE OR REPLACE FUNCTION public.set_goal_step_done(p_entry uuid, p_done boolean, p_timezone text DEFAULT 'UTC')
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); item calendar_entries%ROWTYPE;
BEGIN
  IF uid IS NULL OR p_done IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;
  SELECT * INTO item FROM calendar_entries WHERE id = p_entry AND user_id = uid FOR UPDATE;
  IF NOT FOUND OR item.goal_id IS NULL THEN RAISE EXCEPTION 'Goal step not available'; END IF;
  IF p_done AND item.start_date > (now() AT TIME ZONE p_timezone)::date THEN RAISE EXCEPTION 'This step is planned for a future day'; END IF;
  IF p_done THEN
    UPDATE calendar_entries SET completed_at = coalesce(completed_at,now()) WHERE id = item.id;
    INSERT INTO goal_checkins(user_id,goal_id,focus,calendar_entry_id)
      VALUES(uid,item.goal_id,'Completed: ' || item.title,item.id)
      ON CONFLICT (calendar_entry_id) WHERE calendar_entry_id IS NOT NULL DO NOTHING;
  ELSE
    DELETE FROM goal_checkins WHERE calendar_entry_id = item.id AND user_id = uid;
    UPDATE calendar_entries SET completed_at = NULL WHERE id = item.id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_goal_step_done(uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_goal_step_done(uuid,boolean,text) TO authenticated;

-- Progress is computed from owned records, never awarded by a client increment.
-- Daily caps reward showing up, not logging extra meals or more training volume.
-- Removing/undoing a source removes its contribution. No streak or inactivity penalty.
CREATE OR REPLACE FUNCTION public.world_summary(p_timezone text DEFAULT 'UTC') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); today date; result jsonb;
BEGIN
  IF uid IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN RAISE EXCEPTION 'Invalid request'; END IF;
  today := (now() AT TIME ZONE p_timezone)::date;
  WITH contributions AS (
    SELECT 'training'::text AS kind, date AS day, 40::bigint AS xp, 'Training logged'::text AS title, '/gym/workouts'::text AS href
      FROM workouts WHERE user_id = uid AND completed_at IS NOT NULL AND date <= today GROUP BY date
    UNION ALL SELECT 'nutrition', date, 10, 'Nutrition logged', '/nutrition'
      FROM nutrition_entries WHERE user_id = uid AND date <= today GROUP BY date
    UNION ALL SELECT 'sleep', date, 10, 'Sleep logged', '/gym/sleep'
      FROM sleep_entries WHERE user_id = uid AND date <= today GROUP BY date
    UNION ALL SELECT 'habits', date, least(count(*) * 5,20), 'Habits practiced', '/plan?date=' || date::text
      FROM habit_logs WHERE user_id = uid AND date <= today GROUP BY date
    UNION ALL SELECT 'checkins', (c.created_at AT TIME ZONE p_timezone)::date, least(count(DISTINCT c.goal_id) * 10,30), 'Goals moved forward', '/goals'
      FROM goal_checkins c JOIN goals g ON g.id = c.goal_id AND g.user_id = uid
      WHERE c.user_id = uid AND (c.created_at AT TIME ZONE p_timezone)::date <= today GROUP BY (c.created_at AT TIME ZONE p_timezone)::date
    UNION ALL SELECT 'milestones', (reached_at AT TIME ZONE p_timezone)::date, 50, title, coalesce('/goals/' || goal_id::text,'/goals/milestones/' || id::text || '/edit')
      FROM milestones WHERE user_id = uid AND status = 'done'
    UNION ALL SELECT 'summits', (reached_at AT TIME ZONE p_timezone)::date, 150, title, '/goals/' || id::text
      FROM goals WHERE user_id = uid AND status = 'done'
  )
  SELECT jsonb_build_object(
    'xp', coalesce((SELECT sum(xp) FROM contributions),0),
    'todayXp', coalesce((SELECT sum(xp) FROM contributions WHERE day = today),0),
    'country', (SELECT world_country FROM user_settings WHERE user_id = uid),
    'sources', coalesce((SELECT jsonb_object_agg(kind,total) FROM (SELECT kind,sum(xp) total FROM contributions GROUP BY kind) c),'{}'::jsonb),
    'activity', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT kind,day,xp,title,href FROM contributions WHERE day IS NOT NULL ORDER BY day DESC,kind,title LIMIT 12) c),'[]'::jsonb),
    'goals', coalesce((SELECT jsonb_object_agg(g.id,jsonb_build_object(
      'sessions',(SELECT count(DISTINCT w.id) FROM workout_goal_links l JOIN workouts w ON w.id = l.workout_id AND w.user_id = uid WHERE l.goal_id = g.id AND l.user_id = uid AND w.completed_at IS NOT NULL),
      'checkins',(SELECT count(*) FROM goal_checkins c WHERE c.goal_id = g.id AND c.user_id = uid)
    )) FROM goals g WHERE g.user_id = uid),'{}'::jsonb)
  ) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.world_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.world_summary(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.arrange_world(p_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR p_ids IS NULL THEN RAISE EXCEPTION 'Invalid request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,42));
  IF cardinality(p_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_ids) id)
    OR cardinality(p_ids) <> (SELECT count(*) FROM goals WHERE user_id = uid AND status <> 'archived')
    OR EXISTS (SELECT 1 FROM unnest(p_ids) AS requested(id) WHERE NOT EXISTS (SELECT 1 FROM goals g WHERE g.id = requested.id AND g.user_id = uid AND g.status <> 'archived'))
  THEN RAISE EXCEPTION 'Your world changed. Refresh and try arranging it again.'; END IF;
  UPDATE goals g SET world_slot = ordered.position - 1 FROM unnest(p_ids) WITH ORDINALITY AS ordered(id,position)
    WHERE g.id = ordered.id AND g.user_id = uid;
END $$;
REVOKE ALL ON FUNCTION public.arrange_world(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.arrange_world(uuid[]) TO authenticated;
