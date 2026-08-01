-- Day-by-day per-phase training template (Phase 4). Sibling to `weeks`,
-- not folded into it - one template per phase key, referenced implicitly
-- by every week whose phase matches. Regenerating the plan recomputes
-- and overwrites this too, same "not versioned" precedent as `weeks`.
ALTER TABLE race_training_plans ADD COLUMN IF NOT EXISTS phase_templates JSONB;
