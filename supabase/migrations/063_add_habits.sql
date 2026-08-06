-- Simple, fully optional habit tracking, integrated with the Calendar's
-- time-block day view (see migration 062). A habit is a lightweight
-- template (name + optional weekday schedule + optional usual time);
-- habit_logs is presence-only, one row per (habit, date) actually
-- logged - never a value/count, matching nutrition_entries' own
-- presence-only shape (see migration 021).
--
-- recurrence_weekdays mirrors calendar_entries' exact shape (migration
-- 062): NULL = no fixed schedule, always eligible to log; a set of
-- weekday indices (0=Monday..6=Sunday) = only shows on those days.
-- usual_time mirrors workout_schedule_slots.usual_time - display/
-- positioning only for the Calendar day view, never a real reminder
-- (this app has no push/email notification infra to hang one off of).
--
-- Deliberately NOT wired into the rank system (public_profiles) - every
-- existing rank input (goals, workouts, nutrition_entries) is a
-- structurally substantive, hard-to-fake act, while a habit log is
-- designed to be as frictionless as possible (that's the point of good
-- habit UX). Folding a trivially-gameable, often-private signal into a
-- number other users can see would blur what rank means, not extend it.
CREATE TABLE IF NOT EXISTS habits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  recurrence_weekdays INTEGER[],
  usual_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own habits"
  ON habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own habits"
  ON habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own habits"
  ON habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own habits"
  ON habits FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (habit_id, date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON habit_logs(user_id);

ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own habit logs"
  ON habit_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own habit logs"
  ON habit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own habit logs"
  ON habit_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own habit logs"
  ON habit_logs FOR DELETE USING (auth.uid() = user_id);
