-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for weekly_goals
CREATE TRIGGER update_weekly_goals_updated_at
  BEFORE UPDATE ON weekly_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
