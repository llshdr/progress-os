-- Lightweight annotation for myo-reps/drop-set logging - deliberately
-- NOT a linked structure (no parent_set_id back to an originating top
-- set). The problem this solves doesn't need reconstructing full
-- drop-set/myo-rep sequences, only knowing "is this row a real top-set
-- data point or a follow-on/burnout one" - a single nullable flag
-- answers that. NULL = normal (the default for every existing row and
-- every set logged without picking a technique).
ALTER TABLE sets
ADD COLUMN IF NOT EXISTS set_type TEXT CHECK (set_type IN ('drop', 'myo'));
