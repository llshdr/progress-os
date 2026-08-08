-- Adds 'injury' as its own training_disruptions reason, distinct from
-- 'illness' - injury guidance (rest the affected area, don't run through
-- pain, POLICE-protocol initial care) is genuinely different in shape
-- from illness guidance (systemic/viral go-no-go, graduated return), so
-- lumping it into 'other' would bury real, actionable guidance behind a
-- catch-all. Same additive-CHECK-widening pattern as migration 055's
-- nutrition_food_items_meal_tag_check.

ALTER TABLE training_disruptions DROP CONSTRAINT training_disruptions_reason_check;
ALTER TABLE training_disruptions ADD CONSTRAINT training_disruptions_reason_check CHECK
  (reason IN ('travel', 'illness', 'injury', 'other'));
