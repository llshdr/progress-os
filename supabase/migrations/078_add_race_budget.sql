-- Simple cost-entry tracking for race prep expenses (gear, entry fee,
-- travel, coaching, nutrition) - a running total against an optional
-- stated budget, not a full accounting/receipts system. Scoped to a
-- single race (budget_target lives on races, entries reference it)
-- since costs genuinely differ per race - a destination Ironman costs
-- far more in travel than a local one - not one account-wide budget.
ALTER TABLE races ADD COLUMN IF NOT EXISTS budget_target NUMERIC CHECK (budget_target IS NULL OR budget_target >= 0);

CREATE TABLE IF NOT EXISTS race_budget_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_id UUID NOT NULL REFERENCES races(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('entry_fee', 'travel', 'gear', 'coaching', 'nutrition', 'other')),
  description TEXT,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  incurred_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_race_budget_items_race_id ON race_budget_items(race_id);
CREATE INDEX IF NOT EXISTS idx_race_budget_items_user_id ON race_budget_items(user_id);

ALTER TABLE race_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own race budget items"
  ON race_budget_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own race budget items"
  ON race_budget_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own race budget items"
  ON race_budget_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own race budget items"
  ON race_budget_items FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_race_budget_items_updated_at
  BEFORE UPDATE ON race_budget_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
