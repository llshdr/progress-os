-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Weekly goals table
CREATE TABLE weekly_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('fitness', 'business', 'productivity', 'self_improvement')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  week_start_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Weight tracking table
CREATE TABLE weight_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight DECIMAL(5, 2) NOT NULL,
  body_fat_percentage DECIMAL(5, 2),
  notes TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for better performance
CREATE INDEX idx_weekly_goals_user_id ON weekly_goals(user_id);
CREATE INDEX idx_weekly_goals_week_start ON weekly_goals(week_start_date);
CREATE INDEX idx_weight_entries_user_id ON weight_entries(user_id);
CREATE INDEX idx_weight_entries_recorded_at ON weight_entries(recorded_at);

-- Enable Row Level Security
ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for weekly_goals
CREATE POLICY "Users can view their own weekly goals"
  ON weekly_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weekly goals"
  ON weekly_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly goals"
  ON weekly_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weekly goals"
  ON weekly_goals FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for weight_entries
CREATE POLICY "Users can view their own weight entries"
  ON weight_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weight entries"
  ON weight_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weight entries"
  ON weight_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weight entries"
  ON weight_entries FOR DELETE
  USING (auth.uid() = user_id);
