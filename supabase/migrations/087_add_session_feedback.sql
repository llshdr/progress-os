-- Optional post-session feedback - a genuinely different signal from
-- rpe/rir (which ask "how hard was this specific set/effort") or
-- cardio_logs.perceived_effort (a 0-10 continuous-intensity self-rating):
-- this asks "was the session as prescribed calibrated right," a
-- completion/calibration question neither existing field answers.
-- "couldn't complete" specifically isn't derivable from perceived_effort
-- at all - someone can log a high perceived_effort for a session they
-- still finished in full, so this can't be reduced to relabeling an
-- existing numeric scale.
--
-- Two separate columns, not one shared concept: workouts (session-level,
-- covers strength) and cardio_logs (exercise-instance-level, alongside
-- the existing perceived_effort it doesn't replace) are different tables
-- answering the same question for genuinely different training
-- modalities - a set of resistance work isn't a continuous cardio
-- effort, so forcing both under one column would blur what's actually
-- being asked. Both nullable, optional, never required.
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS session_feedback TEXT
  CHECK (session_feedback IN ('too_easy', 'just_right', 'could_not_complete'));

ALTER TABLE cardio_logs ADD COLUMN IF NOT EXISTS session_feedback TEXT
  CHECK (session_feedback IN ('too_easy', 'just_right', 'could_not_complete'));
