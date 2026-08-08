-- Persists what the "you leveled up" banner used to track purely in
-- browser localStorage (lastSeenRank:{uid}). That's private, per-device
-- state - never meant to be visible to other users - so it belongs on
-- user_settings, not public_profiles. Moving it server-side means the
-- one-time banner survives across devices/browsers instead of re-firing
-- (or silently missing) depending on which browser last saw it.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS last_seen_rank INTEGER;
