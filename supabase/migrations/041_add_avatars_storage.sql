-- Avatar storage - first use of Supabase Storage in this app. Path
-- convention: avatars/{user_id}/{filename}, enforced by the policies below
-- so a user can only write inside their own folder. Bucket is public (like
-- the picture itself, already cleared for cross-user display) so
-- public_profiles.avatar_url can just be a stable public URL - no
-- signed-URL refresh logic needed.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
