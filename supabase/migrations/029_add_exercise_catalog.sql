-- Shared, read-only exercise catalog for search/quick-add. Completely
-- separate from each user's own exercise_library: no user_id, no writable
-- access for regular users, no foreign key ever points at it from
-- exercise_library. Copying a catalog entry into your own library is a
-- one-time field copy performed by the app - the resulting row has no
-- ongoing link back here. This migration does not touch exercise_library
-- or any existing user data in any way.
CREATE TABLE IF NOT EXISTS exercise_catalog (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  category TEXT NOT NULL,
  exercise_type TEXT NOT NULL DEFAULT 'strength' CHECK (exercise_type IN ('strength', 'cardio')),
  aliases TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_exercise_catalog_name ON exercise_catalog(name);

ALTER TABLE exercise_catalog ENABLE ROW LEVEL SECURITY;

-- Read-only for every authenticated user. No INSERT/UPDATE/DELETE policy
-- at all - this table is seeded once below and never written to by the app.
CREATE POLICY "Authenticated users can read the exercise catalog"
  ON exercise_catalog FOR SELECT
  USING (auth.uid() IS NOT NULL);

INSERT INTO exercise_catalog (name, muscle_group, equipment_type, category, exercise_type, aliases) VALUES
-- Chest
('Barbell Bench Press', 'Chest', 'Barbell', 'Compound', 'strength', ARRAY['Bänkpress', 'Bench Press']),
('Incline Barbell Bench Press', 'Chest', 'Barbell', 'Compound', 'strength', ARRAY['Lutande bänkpress']),
('Decline Barbell Bench Press', 'Chest', 'Barbell', 'Compound', 'strength', ARRAY['Decline bänkpress']),
('Dumbbell Bench Press', 'Chest', 'Dumbbell', 'Compound', 'strength', ARRAY['Hantelpress']),
('Incline Dumbbell Press', 'Chest', 'Dumbbell', 'Compound', 'strength', ARRAY['Lutande hantelpress']),
('Dumbbell Flyes', 'Chest', 'Dumbbell', 'Isolation', 'strength', ARRAY['Flyes', 'Bröstflyes']),
('Incline Dumbbell Flyes', 'Chest', 'Dumbbell', 'Isolation', 'strength', ARRAY['Lutande flyes']),
('Cable Crossover', 'Chest', 'Cable', 'Isolation', 'strength', ARRAY['Cable Fly']),
('Machine Chest Press', 'Chest', 'Machine', 'Compound', 'strength', ARRAY['Bröstpress']),
('Pec Deck', 'Chest', 'Machine', 'Isolation', 'strength', ARRAY['Butterfly']),
('Push-Up', 'Chest', 'Bodyweight', 'Compound', 'strength', ARRAY['Armhävning', 'Push Up']),
('Dips', 'Chest', 'Bodyweight', 'Compound', 'strength', ARRAY['Dip']),
('Dumbbell Pullover', 'Chest', 'Dumbbell', 'Isolation', 'strength', ARRAY['Pullover']),

-- Back
('Deadlift', 'Back', 'Barbell', 'Compound', 'strength', ARRAY['Marklyft']),
('Sumo Deadlift', 'Back', 'Barbell', 'Compound', 'strength', ARRAY['Sumomarklyft']),
('Barbell Row', 'Back', 'Barbell', 'Compound', 'strength', ARRAY['Rodd', 'Barbell Rodd']),
('Pendlay Row', 'Back', 'Barbell', 'Compound', 'strength', ARRAY['Pendlay Rodd']),
('T-Bar Row', 'Back', 'Machine', 'Compound', 'strength', ARRAY['T-bar Rodd']),
('Single-Arm Dumbbell Row', 'Back', 'Dumbbell', 'Compound', 'strength', ARRAY['Enarmsrodd']),
('Seated Cable Row', 'Back', 'Cable', 'Compound', 'strength', ARRAY['Sittande Rodd']),
('Lat Pulldown', 'Back', 'Cable', 'Compound', 'strength', ARRAY['Latsdrag']),
('Wide-Grip Lat Pulldown', 'Back', 'Cable', 'Compound', 'strength', ARRAY['Brett Latsdrag']),
('Pull-Up', 'Back', 'Bodyweight', 'Compound', 'strength', ARRAY['Pullups', 'Chins']),
('Chin-Up', 'Back', 'Bodyweight', 'Compound', 'strength', ARRAY['Chinups']),
('Face Pull', 'Back', 'Cable', 'Isolation', 'strength', ARRAY['Face Pulls']),
('Hyperextension', 'Back', 'Bodyweight', 'Isolation', 'strength', ARRAY['Rygglyft']),
('Machine Row', 'Back', 'Machine', 'Compound', 'strength', ARRAY['Maskinrodd']),

-- Legs
('Barbell Back Squat', 'Legs', 'Barbell', 'Compound', 'strength', ARRAY['Knäböj', 'Bakre Knäböj']),
('Front Squat', 'Legs', 'Barbell', 'Compound', 'strength', ARRAY['Frontböj']),
('Goblet Squat', 'Legs', 'Dumbbell', 'Compound', 'strength', ARRAY['Goblet Knäböj']),
('Leg Press', 'Legs', 'Machine', 'Compound', 'strength', ARRAY['Benpress']),
('Hack Squat', 'Legs', 'Machine', 'Compound', 'strength', ARRAY['Hackenpress']),
('Romanian Deadlift', 'Legs', 'Barbell', 'Compound', 'strength', ARRAY['RDL', 'Rumänsk Marklyft']),
('Leg Curl', 'Legs', 'Machine', 'Isolation', 'strength', ARRAY['Lårcurl']),
('Leg Extension', 'Legs', 'Machine', 'Isolation', 'strength', ARRAY['Benspark']),
('Walking Lunges', 'Legs', 'Dumbbell', 'Compound', 'strength', ARRAY['Utfall', 'Utfallssteg']),
('Bulgarian Split Squat', 'Legs', 'Dumbbell', 'Compound', 'strength', ARRAY['Bulgarisk Utfall']),
('Hip Thrust', 'Legs', 'Barbell', 'Compound', 'strength', ARRAY['Höftlyft']),
('Standing Calf Raise', 'Legs', 'Machine', 'Isolation', 'strength', ARRAY['Vadpress', 'Stående Vadpress']),
('Seated Calf Raise', 'Legs', 'Machine', 'Isolation', 'strength', ARRAY['Sittande Vadpress']),
('Glute Bridge', 'Legs', 'Bodyweight', 'Isolation', 'strength', ARRAY['Höftbrygga']),
('Step-Up', 'Legs', 'Dumbbell', 'Compound', 'strength', ARRAY['Step Up']),
('Smith Machine Squat', 'Legs', 'Machine', 'Compound', 'strength', ARRAY['Smith Knäböj']),
('Zercher Squat', 'Legs', 'Barbell', 'Compound', 'strength', ARRAY['Zercherböj']),
('Good Morning', 'Legs', 'Barbell', 'Compound', 'strength', ARRAY['God Morgon']),

-- Shoulders
('Barbell Overhead Press', 'Shoulders', 'Barbell', 'Compound', 'strength', ARRAY['Axelpress', 'OHP', 'Militärpress']),
('Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', 'Compound', 'strength', ARRAY['Hantelaxelpress']),
('Arnold Press', 'Shoulders', 'Dumbbell', 'Compound', 'strength', ARRAY['Arnoldpress']),
('Lateral Raise', 'Shoulders', 'Dumbbell', 'Isolation', 'strength', ARRAY['Sidolyft', 'Axellyft']),
('Cable Lateral Raise', 'Shoulders', 'Cable', 'Isolation', 'strength', ARRAY['Cable Sidolyft']),
('Front Raise', 'Shoulders', 'Dumbbell', 'Isolation', 'strength', ARRAY['Framlyft']),
('Rear Delt Fly', 'Shoulders', 'Dumbbell', 'Isolation', 'strength', ARRAY['Bakre Delt', 'Reverse Flyes']),
('Reverse Fly Machine', 'Shoulders', 'Machine', 'Isolation', 'strength', ARRAY['Reverse Flyes Maskin']),
('Machine Shoulder Press', 'Shoulders', 'Machine', 'Compound', 'strength', ARRAY['Maskinaxelpress']),
('Upright Row', 'Shoulders', 'Barbell', 'Compound', 'strength', ARRAY['Uppåtroddning']),
('Shrugs', 'Shoulders', 'Dumbbell', 'Isolation', 'strength', ARRAY['Axelryck']),

-- Arms
('Barbell Curl', 'Arms', 'Barbell', 'Isolation', 'strength', ARRAY['Bicepscurl']),
('Dumbbell Curl', 'Arms', 'Dumbbell', 'Isolation', 'strength', ARRAY['Hantelcurl']),
('Hammer Curl', 'Arms', 'Dumbbell', 'Isolation', 'strength', ARRAY['Hammercurl']),
('Preacher Curl', 'Arms', 'Barbell', 'Isolation', 'strength', ARRAY['Scottcurl']),
('Cable Curl', 'Arms', 'Cable', 'Isolation', 'strength', ARRAY['Cable Bicepscurl']),
('Concentration Curl', 'Arms', 'Dumbbell', 'Isolation', 'strength', ARRAY['Koncentrationscurl']),
('Triceps Pushdown', 'Arms', 'Cable', 'Isolation', 'strength', ARRAY['Tricepspress']),
('Overhead Triceps Extension', 'Arms', 'Dumbbell', 'Isolation', 'strength', ARRAY['Triceps Extension']),
('Skull Crushers', 'Arms', 'Barbell', 'Isolation', 'strength', ARRAY['Fransk Press']),
('Close-Grip Bench Press', 'Arms', 'Barbell', 'Compound', 'strength', ARRAY['Smalt Grepp Bänkpress']),
('Triceps Dip', 'Arms', 'Bodyweight', 'Compound', 'strength', ARRAY['Triceps Dips']),

-- Core
('Plank', 'Core', 'Bodyweight', 'Isolation', 'strength', ARRAY['Planka']),
('Side Plank', 'Core', 'Bodyweight', 'Isolation', 'strength', ARRAY['Sidoplanka']),
('Crunch', 'Core', 'Bodyweight', 'Isolation', 'strength', ARRAY['Situps', 'Sit-Up']),
('Hanging Leg Raise', 'Core', 'Bodyweight', 'Isolation', 'strength', ARRAY['Hängande Benlyft']),
('Cable Crunch', 'Core', 'Cable', 'Isolation', 'strength', ARRAY['Cable Situps']),
('Russian Twist', 'Core', 'Bodyweight', 'Isolation', 'strength', ARRAY['Rysk Vridning']),
('Ab Wheel Rollout', 'Core', 'Other', 'Isolation', 'strength', ARRAY['Ab Wheel']),
('Mountain Climbers', 'Core', 'Bodyweight', 'Isolation', 'strength', ARRAY['Bergsklättrare']),

-- Full body / conditioning
('Kettlebell Swing', 'Full Body', 'Kettlebell', 'Compound', 'strength', ARRAY['Kettlebellsving']),
('Turkish Get-Up', 'Full Body', 'Kettlebell', 'Compound', 'strength', ARRAY['Turkish Getup']),
('Farmer''s Carry', 'Full Body', 'Dumbbell', 'Compound', 'strength', ARRAY['Farmers Walk', 'Farmers Carry']),
('Clean and Jerk', 'Full Body', 'Barbell', 'Compound', 'strength', ARRAY['Ryck Och Stöt']),
('Snatch', 'Full Body', 'Barbell', 'Compound', 'strength', ARRAY['Ryck']),
('Burpee', 'Full Body', 'Bodyweight', 'Compound', 'strength', ARRAY['Burpees']),
('Sled Push', 'Full Body', 'Other', 'Compound', 'strength', ARRAY['Slädpush']),
('Battle Ropes', 'Full Body', 'Other', 'Cardio', 'cardio', ARRAY['Battle Rope']),

-- Cardio
('Running', 'Full Body', 'Bodyweight', 'Cardio', 'cardio', ARRAY['Löpning', 'Jogging']),
('Treadmill Running', 'Full Body', 'Machine', 'Cardio', 'cardio', ARRAY['Löpband']),
('Cycling', 'Full Body', 'Machine', 'Cardio', 'cardio', ARRAY['Cykling']),
('Stationary Bike', 'Full Body', 'Machine', 'Cardio', 'cardio', ARRAY['Motionscykel']),
('Rowing Machine', 'Full Body', 'Machine', 'Cardio', 'cardio', ARRAY['Roddmaskin']),
('Stair Climber', 'Full Body', 'Machine', 'Cardio', 'cardio', ARRAY['Trappmaskin']),
('Elliptical', 'Full Body', 'Machine', 'Cardio', 'cardio', ARRAY['Crosstrainer']),
('Jump Rope', 'Full Body', 'Bodyweight', 'Cardio', 'cardio', ARRAY['Hopprep']),
('Swimming', 'Full Body', 'Bodyweight', 'Cardio', 'cardio', ARRAY['Simning']),
('Assault Bike', 'Full Body', 'Machine', 'Cardio', 'cardio', ARRAY['Airbike'])
ON CONFLICT DO NOTHING;
