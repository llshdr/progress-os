-- A minimal roles concept for this personal app: 'owner' (the app's owner)
-- vs 'user' (everyone else - currently the owner's brother and friend).
-- Deliberately NOT a column on profiles or user_settings: both of those
-- tables already have a self-service RLS UPDATE policy
-- (auth.uid() = user_id / = id) with no column-level restriction, so any
-- column added there could be self-granted by a normal authenticated user
-- via a plain `.update()` call - Postgres RLS gates rows, not columns.
-- user_roles instead has a SELECT-only policy (so a user can read their own
-- role client-side) and deliberately no INSERT/UPDATE/DELETE policy at all,
-- mirroring exercise_catalog's read-only-to-users shape. The only way a
-- role is ever set is direct SQL run manually in the Supabase SQL editor -
-- there is no service-role/CLI access in this environment, and no
-- client-reachable write path to this table by design.
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'owner')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own role"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Backfill: every existing account (owner, brother, friend) gets a 'user'
-- row today. Migration 038 extends handle_new_user() to seed this row for
-- every future signup too, so no account is ever missing one.
INSERT INTO user_roles (user_id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- One-time bootstrap: promote the app owner by email, since there's no
-- admin UI (or service-role access) to grant this any other way. Matching
-- by email keeps this reproducible/auditable in version control rather
-- than an untracked manual SQL edit.
UPDATE user_roles
SET role = 'owner'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'lucas.lun09@gmail.com');
