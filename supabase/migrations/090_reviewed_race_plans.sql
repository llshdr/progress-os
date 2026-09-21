-- Generation creates a reviewable draft. Only an explicit Apply replaces a plan.
CREATE TABLE public.race_plan_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_id uuid NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  base_plan jsonb,
  base_race_date date NOT NULL,
  review_timezone text NOT NULL DEFAULT 'UTC',
  review_week date NOT NULL DEFAULT date_trunc('week', now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);
ALTER TABLE public.race_plan_previews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own plan previews" ON public.race_plan_previews FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.races r WHERE r.id = race_id AND r.user_id = auth.uid()));
CREATE INDEX race_plan_previews_owner ON public.race_plan_previews(user_id, race_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_race_plan_preview(p_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE draft race_plan_previews; current_plan race_training_plans; race_day date;
BEGIN
  SELECT * INTO draft FROM race_plan_previews WHERE id = p_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan preview unavailable'; END IF;
  IF draft.applied_at IS NOT NULL THEN RETURN draft.race_id; END IF;
  IF draft.created_at < now() - interval '24 hours' THEN RAISE EXCEPTION 'Preview expired. Generate a new preview.'; END IF;
  IF draft.review_week IS DISTINCT FROM date_trunc('week', now() AT TIME ZONE draft.review_timezone)::date THEN RAISE EXCEPTION 'Preview expired. A new training week has started; generate a new preview.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(draft.race_id::text, 19));
  SELECT race_date INTO race_day FROM races WHERE id = draft.race_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR race_day IS DISTINCT FROM draft.base_race_date THEN RAISE EXCEPTION 'Race changed. Generate a new preview.'; END IF;
  SELECT * INTO current_plan FROM race_training_plans WHERE race_id = draft.race_id AND user_id = auth.uid() FOR UPDATE;
  IF (current_plan.id IS NULL) <> (draft.base_plan IS NULL) THEN RAISE EXCEPTION 'Saved plan changed. Generate a new preview.'; END IF;
  IF current_plan.id IS NOT NULL AND (
    current_plan.generated_at IS DISTINCT FROM (draft.base_plan->>'generated_at')::timestamptz OR
    current_plan.weeks IS DISTINCT FROM draft.base_plan->'weeks' OR
    coalesce(current_plan.phase_templates, '{}'::jsonb) IS DISTINCT FROM coalesce(nullif(draft.base_plan->'phase_templates', 'null'::jsonb), '{}'::jsonb) OR
    current_plan.approach IS DISTINCT FROM draft.base_plan->>'approach' OR
    current_plan.overview IS DISTINCT FROM draft.base_plan->>'overview'
  ) THEN RAISE EXCEPTION 'Saved plan changed. Generate a new preview.'; END IF;
  INSERT INTO race_training_plans(race_id, user_id, approach, overview, weeks, phase_templates, generated_at)
  VALUES(draft.race_id, auth.uid(), draft.payload->>'approach', draft.payload->>'overview', draft.payload->'weeks', draft.payload->'phaseTemplates', now())
  ON CONFLICT (race_id) DO UPDATE SET approach = excluded.approach, overview = excluded.overview,
    weeks = excluded.weeks, phase_templates = excluded.phase_templates, generated_at = excluded.generated_at;
  UPDATE race_plan_previews SET applied_at = now() WHERE id = p_id;
  RETURN draft.race_id;
END $$;
REVOKE ALL ON FUNCTION public.apply_race_plan_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_race_plan_preview(uuid) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.race_plan_previews TO authenticated;
