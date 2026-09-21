-- Stable world destinations and exact links between planned and logged sessions.
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS attention text NOT NULL DEFAULT 'focus'
  CHECK (attention IN ('focus', 'later', 'paused'));
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS world_slot integer;
WITH positions AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) - 1 AS slot
  FROM public.goals
) UPDATE public.goals g SET world_slot = p.slot FROM positions p WHERE g.id = p.id AND g.world_slot IS NULL;
CREATE OR REPLACE FUNCTION public.assign_world_slot() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.world_slot IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 42));
    SELECT coalesce(max(world_slot), -1) + 1 INTO NEW.world_slot FROM goals WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assign_world_slot BEFORE INSERT ON public.goals FOR EACH ROW EXECUTE FUNCTION public.assign_world_slot();

ALTER TABLE public.races ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS active_race_id uuid REFERENCES public.races(id) ON DELETE SET NULL;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS planned_session_key text;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS race_id uuid REFERENCES public.races(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workouts_planned_session_unique ON public.workouts(user_id, planned_session_key) WHERE planned_session_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_journey_owner() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'races' THEN
    IF NEW.goal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM goals WHERE id = NEW.goal_id AND user_id = NEW.user_id) THEN RAISE EXCEPTION 'Goal not available'; END IF;
  ELSIF TG_TABLE_NAME = 'workouts' THEN
    IF NEW.race_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM races WHERE id = NEW.race_id AND user_id = NEW.user_id) THEN RAISE EXCEPTION 'Race not available'; END IF;
  ELSIF TG_TABLE_NAME = 'user_settings' THEN
    IF NEW.active_race_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM races WHERE id = NEW.active_race_id AND user_id = NEW.user_id) THEN RAISE EXCEPTION 'Race not available'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER race_goal_owner BEFORE INSERT OR UPDATE OF goal_id ON public.races FOR EACH ROW EXECUTE FUNCTION public.check_journey_owner();
CREATE TRIGGER workout_race_owner BEFORE INSERT OR UPDATE OF race_id ON public.workouts FOR EACH ROW EXECUTE FUNCTION public.check_journey_owner();
CREATE TRIGGER active_race_owner BEFORE INSERT OR UPDATE OF active_race_id ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.check_journey_owner();

-- One transaction creates a session, its exercises, and its goal link. The
-- advisory lock makes repeated taps/concurrent devices return the same workout.
CREATE OR REPLACE FUNCTION public.start_planned_session(
  p_key text, p_date date, p_title text, p_kind text,
  p_race uuid DEFAULT NULL, p_template uuid DEFAULT NULL, p_slot uuid DEFAULT NULL,
  p_existing uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); wid uuid; eid uuid; gid uuid;
BEGIN
  IF uid IS NULL OR p_key IS NULL OR p_date IS NULL OR p_kind IS NULL OR p_kind NOT IN ('swim','bike','run','cardio','strength') OR length(p_key) > 300 OR length(p_key) < 3 THEN RAISE EXCEPTION 'Invalid session'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 7));
  IF p_race IS NOT NULL THEN
    SELECT goal_id INTO gid FROM races WHERE id = p_race AND user_id = uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Race not available'; END IF;
  END IF;
  IF p_template IS NOT NULL AND NOT EXISTS (SELECT 1 FROM workout_templates WHERE id = p_template AND user_id = uid) THEN RAISE EXCEPTION 'Template not available'; END IF;
  IF p_slot IS NOT NULL AND NOT EXISTS (SELECT 1 FROM workout_schedule_slots WHERE id = p_slot AND user_id = uid) THEN RAISE EXCEPTION 'Slot not available'; END IF;
  SELECT id INTO wid FROM workouts WHERE user_id = uid AND planned_session_key = p_key;
  IF wid IS NOT NULL THEN RETURN wid; END IF;
  IF p_existing IS NOT NULL THEN
    UPDATE workouts SET planned_session_key = p_key, race_id = p_race
      WHERE id = p_existing AND user_id = uid AND date = p_date AND planned_session_key IS NULL RETURNING id INTO wid;
    IF wid IS NULL THEN RAISE EXCEPTION 'Choose an unlinked workout on the same day'; END IF;
  ELSE
    SELECT id INTO wid FROM workouts WHERE user_id = uid AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1;
    IF wid IS NOT NULL THEN RETURN wid; END IF;
    INSERT INTO workouts(user_id, date, workout_type, template_id, schedule_slot_id, planned_session_key, race_id)
      VALUES(uid, p_date, p_title, p_template, p_slot, p_key, p_race) RETURNING id INTO wid;
    IF p_template IS NOT NULL THEN
      INSERT INTO exercises(workout_id, exercise_library_id, exercise_order, notes, template_exercise_id)
      SELECT wid, exercise_library_id, exercise_order, notes, id FROM workout_template_exercises WHERE template_id = p_template;
    ELSIF p_kind IN ('swim', 'bike', 'run', 'cardio') THEN
      SELECT id INTO eid FROM exercise_library WHERE user_id = uid AND exercise_type = 'cardio'
        AND cardio_type = CASE p_kind WHEN 'swim' THEN 'swimming' WHEN 'bike' THEN 'cycling' WHEN 'run' THEN 'running' ELSE 'other' END
        AND archived = false ORDER BY created_at LIMIT 1;
      IF eid IS NULL THEN
        INSERT INTO exercise_library(user_id, name, primary_muscle_group, equipment_type, category, exercise_type, cardio_type)
        VALUES(uid, CASE p_kind WHEN 'swim' THEN 'Swimming' WHEN 'bike' THEN 'Cycling' WHEN 'run' THEN 'Running' ELSE 'Cardio' END,
          'Full Body', 'Bodyweight', 'Cardio', 'cardio', CASE p_kind WHEN 'swim' THEN 'swimming' WHEN 'bike' THEN 'cycling' WHEN 'run' THEN 'running' ELSE 'other' END) RETURNING id INTO eid;
      END IF;
      INSERT INTO exercises(workout_id, exercise_library_id, exercise_order) VALUES(wid, eid, 0);
    END IF;
  END IF;
  IF gid IS NOT NULL THEN INSERT INTO workout_goal_links(workout_id, goal_id, user_id) VALUES(wid, gid, uid) ON CONFLICT DO NOTHING; END IF;
  RETURN wid;
END $$;
REVOKE ALL ON FUNCTION public.start_planned_session(text,date,text,text,uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_planned_session(text,date,text,text,uuid,uuid,uuid,uuid) TO authenticated;
