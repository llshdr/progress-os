-- Simple goal-to-goal dependency: "this goal requires that goal to be
-- done first." Deliberately a single optional link, not a general DAG -
-- ON DELETE SET NULL so deleting a prerequisite goal never orphans the
-- dependent one in a broken state, it just silently unblocks it (same
-- "never leave a dangling reference" precedent as milestones.goal_id).
-- No cycle-prevention constraint: this is a personal single-user app: a
-- self-created cycle is self-evident (the note never clears) and
-- trivially fixable by editing the goal, not worth a trigger for.
ALTER TABLE goals ADD COLUMN IF NOT EXISTS depends_on_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;
