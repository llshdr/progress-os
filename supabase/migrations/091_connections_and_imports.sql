-- Tokens are encrypted by the server before storage. No service role key is used.
CREATE TABLE public.integration_connections (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gmail','google_calendar','outlook','outlook_calendar','strava')),
  encrypted_tokens text NOT NULL,
  expires_at timestamptz NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, provider)
);
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own connections" ON public.integration_connections FOR ALL TO authenticated
  USING(user_id = auth.uid()) WITH CHECK(user_id = auth.uid());

-- A receipt and its destination are committed together. Retrying cannot duplicate a saved item.
CREATE TABLE public.import_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_key text NOT NULL CHECK (source_key ~ '^[a-f0-9]{64}$'),
  kind text NOT NULL CHECK (kind IN ('calendar','task','expense','workout')),
  destination_id uuid NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_key, kind)
);
ALTER TABLE public.import_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own import receipts" ON public.import_receipts FOR ALL TO authenticated
  USING(user_id = auth.uid()) WITH CHECK(user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.apply_import_item(p_item jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); destination uuid; receipt import_receipts; eid uuid; library_id uuid;
  gid uuid := nullif(p_item->>'goalId', '')::uuid; rid uuid := nullif(p_item->>'raceId', '')::uuid;
  item_kind text := p_item->>'kind'; day date := (p_item->>'date')::date; title text := trim(p_item->>'title');
BEGIN
  IF uid IS NULL OR title IS NULL OR length(title) NOT BETWEEN 1 AND 200 OR day IS NULL OR
    p_item->>'sourceKey' IS NULL OR (p_item->>'sourceKey') !~ '^[a-f0-9]{64}$' OR
    item_kind IS NULL OR item_kind NOT IN ('calendar','task','expense','workout') THEN RAISE EXCEPTION 'Invalid import'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text || (p_item->>'sourceKey') || item_kind, 27));
  SELECT * INTO receipt FROM import_receipts WHERE user_id = uid AND source_key = p_item->>'sourceKey' AND import_receipts.kind = item_kind;
  IF FOUND THEN RETURN jsonb_build_object('id', receipt.destination_id, 'duplicate', true); END IF;
  IF gid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM goals WHERE id = gid AND user_id = uid) THEN RAISE EXCEPTION 'Goal unavailable'; END IF;
  IF rid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM races WHERE id = rid AND user_id = uid) THEN RAISE EXCEPTION 'Race unavailable'; END IF;
  IF item_kind = 'calendar' THEN
    INSERT INTO calendar_entries(user_id,title,start_date,end_date,start_time,end_time,note)
    VALUES(uid,title,day,coalesce(nullif(p_item->>'endDate','')::date,day),nullif(p_item->>'time','')::time,nullif(p_item->>'endTime','')::time,left(p_item->>'note',4000)) RETURNING id INTO destination;
  ELSIF item_kind = 'task' THEN
    INSERT INTO milestones(user_id,goal_id,title,description,due_date,status)
    VALUES(uid,gid,title,left(p_item->>'note',4000),day,'active') RETURNING id INTO destination;
  ELSIF item_kind = 'expense' THEN
    IF rid IS NULL OR p_item->>'amount' IS NULL OR (p_item->>'amount')::numeric NOT BETWEEN 0 AND 1000000000 OR
      coalesce((p_item->>'currencyConfirmed')::boolean,false) = false THEN RAISE EXCEPTION 'Confirm race and budget currency'; END IF;
    INSERT INTO race_budget_items(user_id,race_id,category,description,amount,incurred_date)
    VALUES(uid,rid,'other',title || CASE WHEN nullif(p_item->>'note','') IS NOT NULL THEN E'\n' || left(p_item->>'note',4000) ELSE '' END,(p_item->>'amount')::numeric,day) RETURNING id INTO destination;
  ELSE
    IF p_item->>'discipline' IS NULL OR p_item->>'discipline' NOT IN ('swimming','cycling','running','other') OR
      p_item->>'distanceKm' IS NULL OR (p_item->>'distanceKm')::numeric <= 0 OR (p_item->>'distanceKm')::numeric >= 10000 OR
      p_item->>'durationSeconds' IS NULL OR (p_item->>'durationSeconds')::integer NOT BETWEEN 1 AND 2678400 THEN RAISE EXCEPTION 'Invalid workout'; END IF;
    INSERT INTO workouts(user_id,date,workout_type,started_at,completed_at,race_id,notes)
    VALUES(uid,day,title,day::timestamptz,day::timestamptz + make_interval(secs => (p_item->>'durationSeconds')::integer),rid,
      'Imported workout; date and duration supplied, start time unspecified.' || E'\n' || coalesce(left(p_item->>'note',4000),'')) RETURNING id INTO destination;
    SELECT id INTO library_id FROM exercise_library WHERE user_id = uid AND exercise_type = 'cardio' AND cardio_type = p_item->>'discipline' AND archived = false ORDER BY created_at LIMIT 1;
    IF library_id IS NULL THEN
      INSERT INTO exercise_library(user_id,name,primary_muscle_group,equipment_type,category,exercise_type,cardio_type)
      VALUES(uid,initcap(p_item->>'discipline'),'Full Body','Bodyweight','Cardio','cardio',p_item->>'discipline') RETURNING id INTO library_id;
    END IF;
    INSERT INTO exercises(workout_id,exercise_library_id,exercise_order) VALUES(destination,library_id,0) RETURNING id INTO eid;
    INSERT INTO cardio_logs(exercise_id,distance_km,duration_seconds) VALUES(eid,(p_item->>'distanceKm')::numeric,(p_item->>'durationSeconds')::integer);
    IF gid IS NULL AND rid IS NOT NULL THEN SELECT goal_id INTO gid FROM races WHERE id = rid AND user_id = uid; END IF;
    IF gid IS NOT NULL THEN INSERT INTO workout_goal_links(workout_id,goal_id,user_id) VALUES(destination,gid,uid); END IF;
  END IF;
  INSERT INTO import_receipts(user_id,source_key,kind,destination_id,title) VALUES(uid,p_item->>'sourceKey',item_kind,destination,title);
  RETURN jsonb_build_object('id',destination,'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.apply_import_item(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_import_item(jsonb) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections, public.import_receipts TO authenticated;
