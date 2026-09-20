-- Visual representation is independent of goal scope/rank and completion.
-- Nullable preserves automatic appearance for existing goals. Existing RLS applies.
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS world_style text
  CHECK (world_style IS NULL OR world_style IN ('summit', 'basecamp', 'trail'));
COMMENT ON COLUMN public.goals.world_style IS
  'Optional Journey appearance; changing it never resets milestones or history.';

-- One logged workout can support multiple goals without duplicating the workout.
CREATE TABLE IF NOT EXISTS public.workout_goal_links (
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workout_id, goal_id)
);
CREATE INDEX IF NOT EXISTS workout_goal_links_goal_idx ON public.workout_goal_links(goal_id);
CREATE INDEX IF NOT EXISTS workout_goal_links_user_idx ON public.workout_goal_links(user_id);
ALTER TABLE public.workout_goal_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own workout goal links" ON public.workout_goal_links
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Link own workouts to own goals" ON public.workout_goal_links
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id AND w.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())
  );
CREATE POLICY "Remove own workout goal links" ON public.workout_goal_links
  FOR DELETE TO authenticated USING (user_id = auth.uid());
GRANT SELECT, INSERT, DELETE ON public.workout_goal_links TO authenticated;
