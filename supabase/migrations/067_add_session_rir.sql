-- Session-level RIR (Reps in Reserve) - a single optional self-rating for
-- the whole workout, not per-set. Deliberately distinct from sets.rpe
-- (migration 005): that column is already read by the AI coach prompt
-- ("@RPE ${set.rpe}") and nothing writes to it today, so repurposing it
-- for RIR would silently feed the AI coach a value on an inverted scale
-- (RIR: lower = harder/closer to failure; RPE: higher = harder) under the
-- same label. A new column keeps both concepts, and the AI coach's
-- existing (currently dormant) rpe integration, intact.
-- 0-10, not the more common 0-5 RIR scale some coaching literature uses -
-- matches this feature's own "optional 1-10 field" framing rather than a
-- narrower range, while still allowing 0 (failure) as a real value, since
-- excluding it would drop the single most informative RIR reading.
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS session_rir INTEGER CHECK (session_rir IS NULL OR (session_rir >= 0 AND session_rir <= 10));
