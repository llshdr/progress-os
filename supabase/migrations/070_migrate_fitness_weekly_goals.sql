-- Completes the goals/weekly_goals unification migration 024 started -
-- that migration already moved business/productivity/self_improvement
-- weekly_goals rows into `goals`, deliberately leaving 'fitness' rows in
-- weekly_goals since /gym/goals was still their legitimate home then.
-- It no longer is: /gym/goals now reads a target_date-filtered view of
-- `goals` (scope='quick_win') instead of its own table, so this migrates
-- the remaining 'fitness' rows the same way 024 did the others - same
-- status mapping, and deliberately NO target_date here either, for
-- exactly 024's own stated reason (week_start_date records when a row
-- was created, not a deadline the user set - mapping it to target_date
-- would fabricate a due date that never existed). scope is set to
-- 'quick_win' since that's a true classification (small, short-lived),
-- not a fabricated date claim.
--
-- Original weekly_goals rows are left in place, same "never delete user
-- data" precedent 024 already established - the table is now fully
-- retired from the app (not read or written anywhere going forward),
-- but not dropped.
INSERT INTO goals (user_id, title, description, status, scope, created_at, updated_at)
SELECT
  user_id,
  title,
  description,
  CASE WHEN status = 'completed' THEN 'done' ELSE 'active' END,
  'quick_win',
  created_at,
  updated_at
FROM weekly_goals
WHERE category = 'fitness';
