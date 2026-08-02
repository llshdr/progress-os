-- Nullable - null means "start now" (today), preserving current behavior
-- for every existing race with no explicit chosen training start.
ALTER TABLE races ADD COLUMN IF NOT EXISTS training_start_date DATE;
