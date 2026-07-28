-- Collapsing the separate "Projects" concept into goal-nested "milestones"
-- (see the Goals IA restructure this migration backs). RENAME TO does not
-- cascade to index/constraint/trigger *names* - only the table's own name
-- changes, dependents keep working via OID regardless - but renaming them
-- too is cheap and avoids confusion later when inspecting the schema.
ALTER TABLE projects RENAME TO milestones;
ALTER INDEX idx_projects_user_id RENAME TO idx_milestones_user_id;
ALTER INDEX idx_projects_goal_id RENAME TO idx_milestones_goal_id;
ALTER INDEX idx_projects_status RENAME TO idx_milestones_status;
ALTER TABLE milestones RENAME CONSTRAINT projects_goal_id_fkey TO milestones_goal_id_fkey;
ALTER POLICY "Users can view their own projects" ON milestones RENAME TO "Users can view their own milestones";
ALTER POLICY "Users can insert their own projects" ON milestones RENAME TO "Users can insert their own milestones";
ALTER POLICY "Users can update their own projects" ON milestones RENAME TO "Users can update their own milestones";
ALTER POLICY "Users can delete their own projects" ON milestones RENAME TO "Users can delete their own milestones";
ALTER TRIGGER update_projects_updated_at ON milestones RENAME TO update_milestones_updated_at;

-- Plain nullable columns, no DB-level default. CURRENT_DATE is not
-- IMMUTABLE, so a DEFAULT would force a one-time backfill of *today's*
-- date onto every existing goal/milestone, misrepresenting when they
-- actually started - same "never backfill a guessed value onto existing
-- rows" discipline already applied to target_sets/rep-range defaults.
-- New goals default this client-side (today's date) in the creation form
-- instead.
ALTER TABLE goals ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS due_date DATE;
