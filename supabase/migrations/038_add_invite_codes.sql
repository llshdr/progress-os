-- Invite-code-gated signup. A single rotating shared code (not per-invitee
-- tokens - this is a personal app with a handful of known invitees, not a
-- multi-tenant product). Two enforcement layers:
--   1. check_invite_code() - a SECURITY DEFINER RPC callable by anonymous
--      visitors, so the signup form can validate before submitting and show
--      a friendly error. It returns only a boolean, never the code itself -
--      invite_codes has no anonymous or non-owner SELECT policy, so there's
--      no client-reachable way to read the real code except the owner's own
--      gated view.
--   2. handle_new_user() (updated below) re-validates the code passed via
--      signUp's raw_user_meta_data and RAISE EXCEPTIONs on mismatch. Since
--      this fires in the same transaction as the auth.users insert, an
--      exception here rolls back the whole signup, including the
--      auth.users row itself. This is the real, non-bypassable check;
--      layer 1 above is just fast UX. The trigger only fires on INSERT
--      into auth.users (new signups) - existing users signing in never
--      re-enter it, so no existing account is affected by this migration.
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Only the owner (via user_roles) can read or rotate the code - everyone
-- else, including other authenticated users, is denied by this same check.
CREATE POLICY "Owner can view invite code"
  ON invite_codes FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

CREATE POLICY "Owner can update invite code"
  ON invite_codes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

-- Seed the one-and-only row with a placeholder code. Rotate it for real
-- from the owner-only /owner/invite-code page right after this migration
-- runs - no further manual SQL needed after this.
INSERT INTO invite_codes (code) VALUES ('changeme-rotate-me');

-- Anonymous-callable check: whether `input` matches the current code,
-- without ever exposing the stored value itself.
CREATE OR REPLACE FUNCTION check_invite_code(input TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM invite_codes WHERE code = input);
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION check_invite_code(TEXT) TO anon, authenticated;

-- handle_new_user(), extended from migration 025's version: validates the
-- invite code passed as signup metadata (raising an exception aborts the
-- whole signup transaction on mismatch), and seeds a user_roles row
-- ('user') for every new signup alongside the existing profiles/
-- user_settings rows, so no account is ever missing one going forward.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM invite_codes WHERE code = NEW.raw_user_meta_data->>'invite_code'
  ) THEN
    RAISE EXCEPTION 'Invalid or missing invite code';
  END IF;

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id, weekly_workout_goal)
  VALUES (NEW.id, 5)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
