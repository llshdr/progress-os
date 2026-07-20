-- Manual training phase/intensity setting - a placeholder until real kcal/
-- nutrition tracking exists to derive this automatically. Used by the AI
-- Coach recommendation to calibrate how aggressive to be.
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS training_phase TEXT DEFAULT 'maintain' CHECK (training_phase IN ('bulk', 'cut', 'maintain'));

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS training_intensity TEXT DEFAULT 'mild' CHECK (training_intensity IN ('mild', 'aggressive'));
