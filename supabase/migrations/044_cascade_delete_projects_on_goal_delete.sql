-- Real delete for goals now needs to not leave orphaned/dangling project
-- rows behind - projects.goal_id was ON DELETE SET NULL (migration 024),
-- meaning deleting a goal previously just unlinked its projects, leaving
-- them sitting in the projects list with no context (including any
-- AI-generated milestones from the goal-plan feature, which have no
-- independent meaning without their parent goal). Switching to CASCADE so
-- deleting a goal removes its linked projects/milestones with it - the app
-- warns the user with the linked count before confirming the delete.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_goal_id_fkey;
ALTER TABLE projects
ADD CONSTRAINT projects_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE;
