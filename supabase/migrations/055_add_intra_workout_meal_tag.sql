-- Adds an 'intra_workout' meal tag for logging on-bike/on-run fueling
-- (carbs/fat/protein taken DURING a session) as an ordinary food entry,
-- reusing the existing per-item macro fields rather than a parallel
-- system - same additive-CHECK-widening pattern as migration 049's
-- race_training_plans_approach_check.

ALTER TABLE nutrition_food_items DROP CONSTRAINT nutrition_food_items_meal_tag_check;
ALTER TABLE nutrition_food_items ADD CONSTRAINT nutrition_food_items_meal_tag_check CHECK
  (meal_tag IN ('breakfast', 'lunch', 'dinner', 'pwo', 'snack', 'intra_workout'));

ALTER TABLE food_library DROP CONSTRAINT food_library_default_meal_tag_check;
ALTER TABLE food_library ADD CONSTRAINT food_library_default_meal_tag_check CHECK
  (default_meal_tag IN ('breakfast', 'lunch', 'dinner', 'pwo', 'snack', 'intra_workout'));
