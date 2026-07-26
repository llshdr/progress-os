-- Granular muscle targeting, one layer under the existing broad
-- primary_muscle_group/muscle_group columns (both left completely
-- untouched - every existing display/filter/AI prompt keeps working
-- exactly as before). Nullable on both tables, so nothing is required and
-- nothing blocks: a null value just means "broad group only," same as
-- today, everywhere.
--
-- Populated via three passes, none of which are a manual re-tagging step
-- for any user:
--   1. exercise_catalog gets granular tags for the exercises where a
--      specific muscle/head actually matters (skipped for cardio/mobility/
--      stretching/whole-body-compound movements, where a broad tag is
--      already the accurate answer).
--   2. exercise_library rows that share a name with a tagged catalog entry
--      inherit its tags automatically (covers anyone who used the
--      catalog-copy flow, or just happens to use a standard exercise name).
--   3. A modest keyword-based fallback for anything left over, using the
--      same naming patterns as src/lib/muscle-targets.ts's inference
--      function. Anything still unmatched stays null - never re-prompted.
ALTER TABLE exercise_library ADD COLUMN IF NOT EXISTS muscle_targets TEXT[];
ALTER TABLE exercise_catalog ADD COLUMN IF NOT EXISTS muscle_targets TEXT[];

-- Pass 1: tag the catalog (both 029's and 031's rows), by name.
UPDATE exercise_catalog AS ec
SET muscle_targets = v.targets
FROM (VALUES
  -- Chest
  ('Barbell Bench Press', ARRAY['Chest (Mid)', 'Triceps (Lateral Head)', 'Shoulders (Front Delt)']),
  ('Incline Barbell Bench Press', ARRAY['Chest (Upper)', 'Shoulders (Front Delt)', 'Triceps (Lateral Head)']),
  ('Decline Barbell Bench Press', ARRAY['Chest (Lower)', 'Triceps (Lateral Head)']),
  ('Dumbbell Bench Press', ARRAY['Chest (Mid)', 'Shoulders (Front Delt)', 'Triceps (Lateral Head)']),
  ('Incline Dumbbell Press', ARRAY['Chest (Upper)', 'Shoulders (Front Delt)']),
  ('Dumbbell Flyes', ARRAY['Chest (Mid)']),
  ('Incline Dumbbell Flyes', ARRAY['Chest (Upper)']),
  ('Cable Crossover', ARRAY['Chest (Mid)']),
  ('Machine Chest Press', ARRAY['Chest (Mid)', 'Triceps (Lateral Head)']),
  ('Pec Deck', ARRAY['Chest (Mid)']),
  ('Push-Up', ARRAY['Chest (Mid)', 'Triceps (Lateral Head)', 'Shoulders (Front Delt)']),
  ('Dips', ARRAY['Chest (Lower)', 'Triceps (Lateral Head)']),
  ('Dumbbell Pullover', ARRAY['Chest (Mid)', 'Back (Lats)']),
  ('Pec Flys', ARRAY['Chest (Mid)']),
  ('Landmine Press', ARRAY['Chest (Upper)', 'Shoulders (Front Delt)']),
  ('Cable Fly Low to High', ARRAY['Chest (Upper)']),
  ('Cable Fly High to Low', ARRAY['Chest (Lower)']),
  ('Resistance Band Chest Press', ARRAY['Chest (Mid)']),
  ('Svend Press', ARRAY['Chest (Mid)']),
  ('Decline Dumbbell Press', ARRAY['Chest (Lower)']),
  ('Decline Push-Up', ARRAY['Chest (Lower)', 'Triceps (Lateral Head)']),

  -- Back
  ('Deadlift', ARRAY['Back (Lower Back)', 'Hamstrings', 'Glutes', 'Back (Traps)']),
  ('Sumo Deadlift', ARRAY['Glutes', 'Hamstrings', 'Adductors', 'Back (Lower Back)']),
  ('Barbell Row', ARRAY['Back (Lats)', 'Back (Mid-Back/Rhomboids)', 'Biceps (Short Head)']),
  ('Pendlay Row', ARRAY['Back (Lats)', 'Back (Mid-Back/Rhomboids)']),
  ('T-Bar Row', ARRAY['Back (Mid-Back/Rhomboids)', 'Back (Lats)']),
  ('Single-Arm Dumbbell Row', ARRAY['Back (Lats)', 'Back (Mid-Back/Rhomboids)']),
  ('Seated Cable Row', ARRAY['Back (Mid-Back/Rhomboids)', 'Back (Lats)']),
  ('Lat Pulldown', ARRAY['Back (Lats)', 'Biceps (Short Head)']),
  ('Wide-Grip Lat Pulldown', ARRAY['Back (Lats)']),
  ('Pull-Up', ARRAY['Back (Lats)', 'Biceps (Short Head)']),
  ('Chin-Up', ARRAY['Back (Lats)', 'Biceps (Short Head)']),
  ('Face Pull', ARRAY['Shoulders (Rear Delt)', 'Back (Mid-Back/Rhomboids)']),
  ('Hyperextension', ARRAY['Back (Lower Back)', 'Glutes']),
  ('Machine Row', ARRAY['Back (Mid-Back/Rhomboids)', 'Back (Lats)']),
  ('Inverted Row', ARRAY['Back (Lats)', 'Back (Mid-Back/Rhomboids)']),
  ('Renegade Row', ARRAY['Back (Lats)', 'Core (Rectus Abdominis)']),
  ('Cable Pullover', ARRAY['Back (Lats)']),
  ('Reverse Grip Lat Pulldown', ARRAY['Back (Lats)', 'Biceps (Long Head)']),
  ('Meadows Row', ARRAY['Back (Lats)']),
  ('Band Pull-Apart', ARRAY['Shoulders (Rear Delt)', 'Back (Mid-Back/Rhomboids)']),
  ('Superman', ARRAY['Back (Lower Back)']),
  ('Straight-Arm Pulldown', ARRAY['Back (Lats)']),
  ('Rack Pull', ARRAY['Back (Lower Back)', 'Back (Traps)']),
  ('Kroc Row', ARRAY['Back (Lats)']),

  -- Legs
  ('Barbell Back Squat', ARRAY['Quadriceps', 'Glutes']),
  ('Front Squat', ARRAY['Quadriceps', 'Glutes']),
  ('Goblet Squat', ARRAY['Quadriceps', 'Glutes']),
  ('Leg Press', ARRAY['Quadriceps', 'Glutes']),
  ('Hack Squat', ARRAY['Quadriceps']),
  ('Romanian Deadlift', ARRAY['Hamstrings', 'Glutes']),
  ('Leg Curl', ARRAY['Hamstrings']),
  ('Leg Extension', ARRAY['Quadriceps']),
  ('Walking Lunges', ARRAY['Quadriceps', 'Glutes']),
  ('Bulgarian Split Squat', ARRAY['Quadriceps', 'Glutes']),
  ('Hip Thrust', ARRAY['Glutes', 'Hamstrings']),
  ('Standing Calf Raise', ARRAY['Calves']),
  ('Seated Calf Raise', ARRAY['Calves']),
  ('Glute Bridge', ARRAY['Glutes']),
  ('Step-Up', ARRAY['Quadriceps', 'Glutes']),
  ('Smith Machine Squat', ARRAY['Quadriceps', 'Glutes']),
  ('Zercher Squat', ARRAY['Quadriceps', 'Glutes', 'Back (Lower Back)']),
  ('Good Morning', ARRAY['Hamstrings', 'Back (Lower Back)', 'Glutes']),
  ('Lying Leg Curl', ARRAY['Hamstrings']),
  ('Seated Leg Curl', ARRAY['Hamstrings']),
  ('Sissy Squat', ARRAY['Quadriceps']),
  ('Box Squat', ARRAY['Quadriceps', 'Glutes']),
  ('Pistol Squat', ARRAY['Quadriceps', 'Glutes']),
  ('Curtsy Lunge', ARRAY['Glutes', 'Quadriceps']),
  ('Reverse Lunge', ARRAY['Quadriceps', 'Glutes']),
  ('Belt Squat', ARRAY['Quadriceps']),
  ('Nordic Hamstring Curl', ARRAY['Hamstrings']),
  ('Donkey Calf Raise', ARRAY['Calves']),
  ('Adductor Machine', ARRAY['Adductors']),
  ('Abductor Machine', ARRAY['Abductors']),
  ('Single-Leg Deadlift', ARRAY['Hamstrings', 'Glutes']),
  ('Trap Bar Deadlift', ARRAY['Quadriceps', 'Glutes', 'Back (Traps)']),
  ('Leg Press Calf Raise', ARRAY['Calves']),
  ('Cable Kickback', ARRAY['Glutes']),
  ('Standing Hip Abduction', ARRAY['Abductors']),
  ('Sumo Squat', ARRAY['Quadriceps', 'Glutes', 'Adductors']),

  -- Shoulders
  ('Barbell Overhead Press', ARRAY['Shoulders (Front Delt)', 'Triceps (Lateral Head)']),
  ('Dumbbell Shoulder Press', ARRAY['Shoulders (Front Delt)', 'Triceps (Lateral Head)']),
  ('Arnold Press', ARRAY['Shoulders (Front Delt)', 'Shoulders (Side Delt)']),
  ('Lateral Raise', ARRAY['Shoulders (Side Delt)']),
  ('Cable Lateral Raise', ARRAY['Shoulders (Side Delt)']),
  ('Front Raise', ARRAY['Shoulders (Front Delt)']),
  ('Rear Delt Fly', ARRAY['Shoulders (Rear Delt)']),
  ('Reverse Fly Machine', ARRAY['Shoulders (Rear Delt)']),
  ('Machine Shoulder Press', ARRAY['Shoulders (Front Delt)']),
  ('Upright Row', ARRAY['Shoulders (Side Delt)', 'Back (Traps)']),
  ('Shrugs', ARRAY['Back (Traps)']),
  ('Lateral Raises (Machine)', ARRAY['Shoulders (Side Delt)']),
  ('Shrugs (Smith Machine)', ARRAY['Back (Traps)']),
  ('Push Press', ARRAY['Shoulders (Front Delt)', 'Triceps (Lateral Head)']),
  ('Behind-the-Neck Press', ARRAY['Shoulders (Side Delt)']),
  ('Cable Front Raise', ARRAY['Shoulders (Front Delt)']),
  ('Plate Front Raise', ARRAY['Shoulders (Front Delt)']),
  ('Band Lateral Raise', ARRAY['Shoulders (Side Delt)']),
  ('Cuban Press', ARRAY['Shoulders (Side Delt)', 'Shoulders (Rear Delt)']),
  ('Y-Raise', ARRAY['Shoulders (Rear Delt)']),
  ('W-Raise', ARRAY['Shoulders (Rear Delt)']),

  -- Arms
  ('Barbell Curl', ARRAY['Biceps (Long Head)', 'Biceps (Short Head)']),
  ('Dumbbell Curl', ARRAY['Biceps (Long Head)', 'Biceps (Short Head)']),
  ('Hammer Curl', ARRAY['Brachialis', 'Forearms']),
  ('Preacher Curl', ARRAY['Biceps (Short Head)']),
  ('Cable Curl', ARRAY['Biceps (Long Head)']),
  ('Concentration Curl', ARRAY['Biceps (Short Head)']),
  ('Triceps Pushdown', ARRAY['Triceps (Lateral Head)']),
  ('Overhead Triceps Extension', ARRAY['Triceps (Long Head)']),
  ('Skull Crushers', ARRAY['Triceps (Long Head)']),
  ('Close-Grip Bench Press', ARRAY['Triceps (Lateral Head)', 'Chest (Mid)']),
  ('Triceps Dip', ARRAY['Triceps (Lateral Head)']),
  ('Leon Pushdowns', ARRAY['Triceps (Lateral Head)']),
  ('Wrist Curls', ARRAY['Forearms']),
  ('Tricep Cable Overhead Press', ARRAY['Triceps (Long Head)']),
  ('Hammer Curls (Cable)', ARRAY['Brachialis', 'Forearms']),
  ('Zottman Curl', ARRAY['Biceps (Long Head)', 'Forearms']),
  ('Drag Curl', ARRAY['Biceps (Short Head)']),
  ('Spider Curl', ARRAY['Biceps (Short Head)']),
  ('21s Bicep Curl', ARRAY['Biceps (Long Head)', 'Biceps (Short Head)']),
  ('EZ Bar Curl', ARRAY['Biceps (Short Head)']),
  ('Diamond Push-Up', ARRAY['Triceps (Lateral Head)', 'Chest (Mid)']),
  ('Bench Dip', ARRAY['Triceps (Lateral Head)']),
  ('Reverse Curl', ARRAY['Brachialis', 'Forearms']),
  ('Wrist Roller', ARRAY['Forearms']),
  ('Bayesian Cable Curl', ARRAY['Biceps (Long Head)']),
  ('JM Press', ARRAY['Triceps (Long Head)']),

  -- Core
  ('Plank', ARRAY['Core (Rectus Abdominis)']),
  ('Side Plank', ARRAY['Core (Obliques)']),
  ('Crunch', ARRAY['Core (Rectus Abdominis)']),
  ('Hanging Leg Raise', ARRAY['Core (Rectus Abdominis)']),
  ('Cable Crunch', ARRAY['Core (Rectus Abdominis)']),
  ('Russian Twist', ARRAY['Core (Obliques)']),
  ('Ab Wheel Rollout', ARRAY['Core (Rectus Abdominis)']),
  ('Mountain Climbers', ARRAY['Core (Rectus Abdominis)']),
  ('Dead Bug', ARRAY['Core (Rectus Abdominis)']),
  ('Bird Dog', ARRAY['Core (Rectus Abdominis)', 'Back (Lower Back)']),
  ('Toes to Bar', ARRAY['Core (Rectus Abdominis)']),
  ('Woodchopper', ARRAY['Core (Obliques)']),
  ('Flutter Kicks', ARRAY['Core (Rectus Abdominis)']),
  ('Weighted Plank', ARRAY['Core (Rectus Abdominis)']),
  ('Landmine Rotation', ARRAY['Core (Obliques)']),
  ('Pallof Press', ARRAY['Core (Obliques)']),
  ('V-Ups', ARRAY['Core (Rectus Abdominis)'])
) AS v(name, targets)
WHERE ec.name = v.name;

-- Pass 2: exercise_library rows that share a name with a now-tagged
-- catalog entry inherit its tags automatically. Case-insensitive since
-- personal libraries aren't guaranteed to match catalog capitalization.
UPDATE exercise_library AS el
SET muscle_targets = ec.muscle_targets
FROM exercise_catalog AS ec
WHERE el.muscle_targets IS NULL
  AND ec.muscle_targets IS NOT NULL
  AND lower(el.name) = lower(ec.name);

-- Pass 3: modest keyword fallback for exercise_library rows that still
-- have no tags (custom names with no catalog match). Mirrors the highest-
-- confidence patterns in src/lib/muscle-targets.ts. Anything not matched
-- here stays null - broad-group-only, same as today, never blocking.
UPDATE exercise_library AS el
SET muscle_targets = CASE
  WHEN el.name ILIKE '%hammer curl%' THEN ARRAY['Brachialis', 'Forearms']
  WHEN el.name ILIKE '%curl%' AND el.primary_muscle_group = 'Arms' THEN ARRAY['Biceps (Long Head)', 'Biceps (Short Head)']
  WHEN el.name ILIKE '%pushdown%' OR el.name ILIKE '%close-grip%' THEN ARRAY['Triceps (Lateral Head)']
  WHEN el.name ILIKE '%tricep%' THEN ARRAY['Triceps (Lateral Head)']
  WHEN (el.name ILIKE '%bench press%' OR el.name ILIKE '%chest press%' OR el.name ILIKE '%push-up%' OR el.name ILIKE '%pushup%')
    AND el.primary_muscle_group = 'Chest' THEN ARRAY['Chest (Mid)']
  WHEN el.name ILIKE '%lat pulldown%' OR el.name ILIKE '%pull-up%' OR el.name ILIKE '%pullup%' OR el.name ILIKE '%chin-up%' THEN ARRAY['Back (Lats)']
  WHEN el.name ILIKE '%row%' AND el.primary_muscle_group = 'Back' THEN ARRAY['Back (Lats)', 'Back (Mid-Back/Rhomboids)']
  WHEN el.name ILIKE '%shrug%' THEN ARRAY['Back (Traps)']
  WHEN el.name ILIKE '%lateral raise%' OR el.name ILIKE '%side raise%' THEN ARRAY['Shoulders (Side Delt)']
  WHEN el.name ILIKE '%front raise%' OR el.name ILIKE '%overhead press%' OR el.name ILIKE '%shoulder press%' THEN ARRAY['Shoulders (Front Delt)']
  WHEN (el.name ILIKE '%squat%' OR el.name ILIKE '%leg press%' OR el.name ILIKE '%lunge%') AND el.primary_muscle_group = 'Legs' THEN ARRAY['Quadriceps', 'Glutes']
  WHEN el.name ILIKE '%leg curl%' OR el.name ILIKE '%hamstring%' THEN ARRAY['Hamstrings']
  WHEN el.name ILIKE '%deadlift%' THEN ARRAY['Hamstrings', 'Glutes', 'Back (Lower Back)']
  WHEN el.name ILIKE '%calf raise%' THEN ARRAY['Calves']
  WHEN (el.name ILIKE '%plank%' OR el.name ILIKE '%crunch%' OR el.name ILIKE '%sit-up%') AND el.primary_muscle_group = 'Core' THEN ARRAY['Core (Rectus Abdominis)']
  WHEN el.name ILIKE '%twist%' OR el.name ILIKE '%oblique%' THEN ARRAY['Core (Obliques)']
  ELSE NULL
END
WHERE el.muscle_targets IS NULL;
