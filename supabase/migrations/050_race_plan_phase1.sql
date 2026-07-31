-- Persists the AI weakness-analysis output so it doesn't need
-- regenerating every page visit, and so the plan-generation route reads
-- the SAME ranking the user already saw, rather than risking a second
-- call landing on a different order.
ALTER TABLE races ADD COLUMN IF NOT EXISTS discipline_weakness JSONB;
