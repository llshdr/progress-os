-- Bug fix: profiles never had an INSERT policy (only SELECT and UPDATE from
-- migration 012), so any user without an existing profiles row (e.g. an
-- account created before that migration, or if the signup trigger ever
-- failed to run) could never create one - the display name field always
-- loaded blank and every save silently failed at the RLS layer, since the
-- upsert's INSERT branch was denied by default.
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
