-- Projects module: "actionmaxxing" - surfacing the single highest-leverage
-- next action toward active goals/projects. Deliberately minimal: no
-- subtasks, no collaborators, no hierarchy beyond one optional goal_id link.
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  next_action TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  next_action TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_goal_id ON projects(goal_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE status = 'active';

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goals"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON goals FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at IS the "last touched" timestamp for actionmaxxing purposes -
-- no separate column, just the same trigger already used elsewhere.
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- One-time copy of the orphaned business/productivity/self_improvement
-- weekly_goals rows into the new goals table. week_start_date is NOT mapped
-- to target_date - it records when the goal was created, not a deadline, so
-- carrying it over would fabricate a due date that was never set. Original
-- weekly_goals rows are left in place (not deleted): deleting user data
-- isn't reversible, and the fitness category still legitimately lives there.
INSERT INTO goals (user_id, title, description, status, created_at, updated_at)
SELECT
  user_id,
  title,
  description,
  CASE WHEN status = 'completed' THEN 'done' ELSE 'active' END,
  created_at,
  updated_at
FROM weekly_goals
WHERE category IN ('business', 'productivity', 'self_improvement');
