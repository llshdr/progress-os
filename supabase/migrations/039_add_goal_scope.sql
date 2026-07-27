-- Self-declared magnitude tag for goals - "how big I consider this", never
-- what it is. Purely structural metadata: used only by the rank system
-- (migration 040) to determine the maximum rank tier a user's activity can
-- unlock, without the ranking logic ever reading title/description. NULL
-- (the default for every existing goal) is treated as the lowest tier by
-- the rank function - existing goals don't retroactively unlock anything
-- until the user explicitly tags one.
ALTER TABLE goals
ADD COLUMN IF NOT EXISTS scope TEXT CHECK (scope IN ('quick_win', 'milestone', 'long_term'));
