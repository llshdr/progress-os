-- Expands exercise_catalog (seeded in 029) with more common exercises.
-- Additive only: no ALTER, no UPDATE, no changes to 029/030 - both are
-- already applied and re-running either would duplicate existing rows.
--
-- Checked against 029 first to avoid near-duplicates. Skipped as already
-- covered there (same exercise, different naming in the request):
--   Hack Squats            -> already "Hack Squat"
--   Preacher Curls         -> already "Preacher Curl"
--   Lateral Raises (Cable) -> already "Cable Lateral Raise"
--   Lateral Raises (Dumbbell) -> already "Lateral Raise"
--   Shrugs (Dumbbell)      -> already "Shrugs" (Dumbbell)
--   Leg Extension          -> already present
--   Incline Barbell Bench Press -> already present
--   Hammer Curls (Dumbbell) -> already "Hammer Curl" (Dumbbell)
-- "Pec Flys" is included below despite overlapping with 029's "Pec Deck" /
-- "Dumbbell Flyes" since it was explicitly requested - aliased so it
-- doesn't read as a pure clone.
INSERT INTO exercise_catalog (name, muscle_group, equipment_type, category, exercise_type, aliases) VALUES

-- Explicitly requested, not already covered
('Leon Pushdowns', 'Arms', 'Cable', 'Isolation', 'strength', ARRAY['Seated Tricep Pushdown', 'Tricep Pushdown', 'Cable Tricep Pushdown']),
('Wrist Curls', 'Arms', 'Dumbbell', 'Isolation', 'strength', ARRAY['Kitty Curls', 'Handledscurl']),
('Tricep Cable Overhead Press', 'Arms', 'Cable', 'Isolation', 'strength', ARRAY['Overhead Cable Tricep Extension', 'Cable Overhead Press']),
('Lateral Raises (Machine)', 'Shoulders', 'Machine', 'Isolation', 'strength', ARRAY['Machine Lateral Raise', 'Machine Sidolyft']),
('Shrugs (Smith Machine)', 'Shoulders', 'Machine', 'Isolation', 'strength', ARRAY['Smith Machine Shrugs', 'Smith Axelryck']),
('Lying Leg Curl', 'Legs', 'Machine', 'Isolation', 'strength', ARRAY['Lying Hamstring Curl', 'Liggande Lårcurl']),
('Seated Leg Curl', 'Legs', 'Machine', 'Isolation', 'strength', ARRAY['Seated Hamstring Curl', 'Sittande Lårcurl']),
('Hammer Curls (Cable)', 'Arms', 'Cable', 'Isolation', 'strength', ARRAY['Cable Hammer Curl', 'Rope Hammer Curl']),
('Pec Flys', 'Chest', 'Machine', 'Isolation', 'strength', ARRAY['Pec Deck Fly', 'Butterfly Fly', 'Bröstflyes Maskin']),

-- Chest
('Landmine Press', 'Chest', 'Barbell', 'Compound', 'strength', ARRAY['Landmine Chest Press']),
('Cable Fly Low to High', 'Chest', 'Cable', 'Isolation', 'strength', ARRAY['Low Cable Fly', 'Incline Cable Fly']),
('Cable Fly High to Low', 'Chest', 'Cable', 'Isolation', 'strength', ARRAY['High Cable Fly', 'Decline Cable Fly']),
('Resistance Band Chest Press', 'Chest', 'Resistance Band', 'Compound', 'strength', ARRAY['Band Chest Press']),
('Svend Press', 'Chest', 'Other', 'Isolation', 'strength', ARRAY['Plate Press']),
('Decline Dumbbell Press', 'Chest', 'Dumbbell', 'Compound', 'strength', ARRAY['Decline Hantelpress']),
('Decline Push-Up', 'Chest', 'Bodyweight', 'Compound', 'strength', ARRAY['Decline Armhävning']),

-- Back
('Inverted Row', 'Back', 'Bodyweight', 'Compound', 'strength', ARRAY['Body Row']),
('Renegade Row', 'Back', 'Dumbbell', 'Compound', 'strength', ARRAY['Renegade Rodd']),
('Cable Pullover', 'Back', 'Cable', 'Isolation', 'strength', ARRAY['Cable Pullover']),
('Reverse Grip Lat Pulldown', 'Back', 'Cable', 'Compound', 'strength', ARRAY['Underhand Lat Pulldown', 'Underhand Latsdrag']),
('Meadows Row', 'Back', 'Barbell', 'Compound', 'strength', ARRAY['Meadows Rodd']),
('Band Pull-Apart', 'Back', 'Resistance Band', 'Isolation', 'strength', ARRAY['Band Pull Apart']),
('Superman', 'Back', 'Bodyweight', 'Isolation', 'strength', ARRAY['Superman Hold']),
('Straight-Arm Pulldown', 'Back', 'Cable', 'Isolation', 'strength', ARRAY['Straight Arm Pulldown']),
('Rack Pull', 'Back', 'Barbell', 'Compound', 'strength', ARRAY['Rack Pulls']),
('Kroc Row', 'Back', 'Dumbbell', 'Compound', 'strength', ARRAY['Kroc Rodd']),

-- Legs
('Sissy Squat', 'Legs', 'Bodyweight', 'Isolation', 'strength', ARRAY['Sissy Squats']),
('Box Squat', 'Legs', 'Barbell', 'Compound', 'strength', ARRAY['Box Knäböj']),
('Pistol Squat', 'Legs', 'Bodyweight', 'Compound', 'strength', ARRAY['Enbensknäböj']),
('Curtsy Lunge', 'Legs', 'Dumbbell', 'Compound', 'strength', ARRAY['Curtsy Utfall']),
('Reverse Lunge', 'Legs', 'Dumbbell', 'Compound', 'strength', ARRAY['Bakåtutfall']),
('Belt Squat', 'Legs', 'Machine', 'Compound', 'strength', ARRAY['Belt Squats']),
('Nordic Hamstring Curl', 'Legs', 'Bodyweight', 'Isolation', 'strength', ARRAY['Nordic Curl']),
('Donkey Calf Raise', 'Legs', 'Machine', 'Isolation', 'strength', ARRAY['Donkey Vadpress']),
('Adductor Machine', 'Legs', 'Machine', 'Isolation', 'strength', ARRAY['Inner Thigh Machine', 'Adduktormaskin']),
('Abductor Machine', 'Legs', 'Machine', 'Isolation', 'strength', ARRAY['Outer Thigh Machine', 'Abduktormaskin']),
('Single-Leg Deadlift', 'Legs', 'Dumbbell', 'Compound', 'strength', ARRAY['Enbensmarklyft', 'Single Leg RDL']),
('Trap Bar Deadlift', 'Legs', 'Barbell', 'Compound', 'strength', ARRAY['Hex Bar Deadlift']),
('Leg Press Calf Raise', 'Legs', 'Machine', 'Isolation', 'strength', ARRAY['Benpress Vadpress']),
('Cable Kickback', 'Legs', 'Cable', 'Isolation', 'strength', ARRAY['Glute Kickback']),
('Standing Hip Abduction', 'Legs', 'Cable', 'Isolation', 'strength', ARRAY['Cable Hip Abduction']),
('Sumo Squat', 'Legs', 'Dumbbell', 'Compound', 'strength', ARRAY['Sumoböj']),

-- Shoulders
('Push Press', 'Shoulders', 'Barbell', 'Compound', 'strength', ARRAY['Push Press']),
('Behind-the-Neck Press', 'Shoulders', 'Barbell', 'Compound', 'strength', ARRAY['Behind The Neck Press']),
('Cable Front Raise', 'Shoulders', 'Cable', 'Isolation', 'strength', ARRAY['Cable Framlyft']),
('Plate Front Raise', 'Shoulders', 'Other', 'Isolation', 'strength', ARRAY['Plate Raise']),
('Band Lateral Raise', 'Shoulders', 'Resistance Band', 'Isolation', 'strength', ARRAY['Band Sidolyft']),
('Cuban Press', 'Shoulders', 'Dumbbell', 'Compound', 'strength', ARRAY['Cuban Rotation Press']),
('Y-Raise', 'Shoulders', 'Dumbbell', 'Isolation', 'strength', ARRAY['Y Raise']),
('W-Raise', 'Shoulders', 'Dumbbell', 'Isolation', 'strength', ARRAY['W Raise']),

-- Arms
('Zottman Curl', 'Arms', 'Dumbbell', 'Isolation', 'strength', ARRAY['Zottmancurl']),
('Drag Curl', 'Arms', 'Barbell', 'Isolation', 'strength', ARRAY['Drag Curls']),
('Spider Curl', 'Arms', 'Barbell', 'Isolation', 'strength', ARRAY['Spider Curls']),
('21s Bicep Curl', 'Arms', 'Barbell', 'Isolation', 'strength', ARRAY['21s']),
('EZ Bar Curl', 'Arms', 'Barbell', 'Isolation', 'strength', ARRAY['EZ-stångscurl', 'EZ Curl']),
('Diamond Push-Up', 'Arms', 'Bodyweight', 'Compound', 'strength', ARRAY['Diamond Pushups']),
('Bench Dip', 'Arms', 'Bodyweight', 'Compound', 'strength', ARRAY['Tricep Bench Dip']),
('Reverse Curl', 'Arms', 'Barbell', 'Isolation', 'strength', ARRAY['Omvänd Curl']),
('Wrist Roller', 'Arms', 'Other', 'Isolation', 'strength', ARRAY['Wrist Roller Curl']),
('Bayesian Cable Curl', 'Arms', 'Cable', 'Isolation', 'strength', ARRAY['Behind The Back Cable Curl']),
('JM Press', 'Arms', 'Barbell', 'Isolation', 'strength', ARRAY['JM Press']),

-- Core
('Dead Bug', 'Core', 'Bodyweight', 'Isolation', 'strength', ARRAY['Dead Bugs']),
('Bird Dog', 'Core', 'Bodyweight', 'Isolation', 'strength', ARRAY['Bird Dogs']),
('Toes to Bar', 'Core', 'Bodyweight', 'Compound', 'strength', ARRAY['Toes-to-Bar']),
('Woodchopper', 'Core', 'Cable', 'Isolation', 'strength', ARRAY['Cable Woodchop']),
('Flutter Kicks', 'Core', 'Bodyweight', 'Isolation', 'strength', ARRAY['Flutter Kick']),
('Weighted Plank', 'Core', 'Other', 'Isolation', 'strength', ARRAY['Viktad Planka']),
('Landmine Rotation', 'Core', 'Barbell', 'Isolation', 'strength', ARRAY['Landmine Twist']),
('Pallof Press', 'Core', 'Cable', 'Isolation', 'strength', ARRAY['Pallof Press']),
('V-Ups', 'Core', 'Bodyweight', 'Isolation', 'strength', ARRAY['V-Up', 'V Sits']),

-- Full body / functional
('Wall Ball', 'Full Body', 'Other', 'Compound', 'strength', ARRAY['Wall Ball Shot']),
('Box Jump', 'Full Body', 'Bodyweight', 'Compound', 'strength', ARRAY['Boxhopp']),
('Thruster', 'Full Body', 'Barbell', 'Compound', 'strength', ARRAY['Thrusters']),
('Man Maker', 'Full Body', 'Dumbbell', 'Compound', 'strength', ARRAY['Man Makers']),
('Tire Flip', 'Full Body', 'Other', 'Compound', 'strength', ARRAY['Däckvändning']),
('Sled Pull', 'Full Body', 'Other', 'Compound', 'strength', ARRAY['Sled Drag']),
('Bear Crawl', 'Full Body', 'Bodyweight', 'Compound', 'strength', ARRAY['Bear Crawls']),
('Medicine Ball Slam', 'Full Body', 'Other', 'Compound', 'strength', ARRAY['Ball Slam']),
('Sandbag Carry', 'Full Body', 'Other', 'Compound', 'strength', ARRAY['Sandbag Carries']),
('Devil Press', 'Full Body', 'Dumbbell', 'Compound', 'strength', ARRAY['Devil Presses']),

-- Mobility / stretching
('Foam Rolling', 'Full Body', 'Other', 'Mobility', 'strength', ARRAY['Foam Roll']),
('Hip Flexor Stretch', 'Legs', 'Bodyweight', 'Stretching', 'strength', ARRAY['Höftböjarstretch']),
('Hamstring Stretch', 'Legs', 'Bodyweight', 'Stretching', 'strength', ARRAY['Hamstringstretch']),
('Cat-Cow Stretch', 'Back', 'Bodyweight', 'Mobility', 'strength', ARRAY['Cat Cow']),
('World''s Greatest Stretch', 'Full Body', 'Bodyweight', 'Mobility', 'strength', ARRAY['Worlds Greatest Stretch']),
('Shoulder Dislocates', 'Shoulders', 'Resistance Band', 'Mobility', 'strength', ARRAY['Band Dislocates']),
('Thoracic Spine Rotation', 'Back', 'Bodyweight', 'Mobility', 'strength', ARRAY['T-Spine Rotation']),
('Ankle Mobility Drill', 'Legs', 'Bodyweight', 'Mobility', 'strength', ARRAY['Ankle Mobilization']),
('Ninety-Ninety Stretch', 'Legs', 'Bodyweight', 'Stretching', 'strength', ARRAY['90/90 Stretch']),
('Couch Stretch', 'Legs', 'Bodyweight', 'Stretching', 'strength', ARRAY['Couch Stretches']),

-- Cardio
('Sprints', 'Full Body', 'Bodyweight', 'Cardio', 'cardio', ARRAY['Sprint Intervals', 'Sprinting']),
('Incline Treadmill Walk', 'Full Body', 'Machine', 'Cardio', 'cardio', ARRAY['Incline Walk']),
('Ski Erg', 'Full Body', 'Machine', 'Cardio', 'cardio', ARRAY['SkiErg']),
('Versaclimber', 'Full Body', 'Machine', 'Cardio', 'cardio', ARRAY['VersaClimber']),
('Shadow Boxing', 'Full Body', 'Bodyweight', 'Cardio', 'cardio', ARRAY['Skuggboxning']),
('Hiking', 'Full Body', 'Bodyweight', 'Cardio', 'cardio', ARRAY['Vandring']),
('Spin Class', 'Full Body', 'Machine', 'Cardio', 'cardio', ARRAY['Spinning']),
('Rucking', 'Full Body', 'Other', 'Cardio', 'cardio', ARRAY['Ruck March'])

ON CONFLICT DO NOTHING;
