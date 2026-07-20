-- Fix "relation "profiles" does not exist" on signup. handle_new_user() is
-- SECURITY DEFINER with no explicit search_path, and its inserts reference
-- profiles/user_settings unqualified. When fired from the auth.users
-- trigger, the active search_path doesn't reliably include public first,
-- so the unqualified name fails to resolve even though the table exists.
-- Schema-qualifying the references and pinning search_path on the function
-- itself fixes both possible causes at once. The trigger already points at
-- this function name, so replacing the body is enough - no trigger changes
-- needed.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id, weekly_workout_goal)
  VALUES (NEW.id, 5)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
