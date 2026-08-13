-- Cookbook: a curated collection of recipes, owner-authored, readable by
-- every app user - same owner-only write / open-to-all read shape as the
-- strength leaderboard's public data (migration 081/084), but for content
-- instead of stats. Write access reuses the exact same user_roles
-- role-check pattern as invite_codes (migration 038): no INSERT/UPDATE/
-- DELETE policy exists for anyone except the owner role. There's no
-- "user can edit their own recipes" concept here - there is exactly one
-- writer by design, same as invite_codes.
CREATE TABLE IF NOT EXISTS cookbook_recipes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  -- One ingredient/step per line, split client-side for display - same
  -- freeform-text precedent as food_library.ingredients. Appropriate here
  -- since there's exactly one writer (the owner) and no need yet for
  -- ingredient-level structure (a shopping list, serving-size scaling).
  ingredients TEXT NOT NULL,
  instructions TEXT NOT NULL,
  -- All nullable, unlike food_library's NOT NULL macro columns - a
  -- curated recipe is worth publishing before its macros are known, not
  -- only after.
  calories INTEGER,
  protein_g DECIMAL(6, 1),
  fat_g DECIMAL(6, 1),
  carbs_g DECIMAL(6, 1),
  servings INTEGER,
  -- Free text, not a fixed enum like food_library's default_meal_tag -
  -- recipe categories span two different dimensions (meal timing like
  -- "breakfast" vs. purpose like "high-protein snack") that one rigid
  -- enum can't cleanly hold, and with a single owner-writer the usual
  -- free-text drift/consistency risk doesn't really apply.
  category TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_cookbook_recipes_category ON cookbook_recipes(category);

ALTER TABLE cookbook_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can view recipes"
  ON cookbook_recipes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner can insert recipes"
  ON cookbook_recipes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

CREATE POLICY "Owner can update recipes"
  ON cookbook_recipes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

CREATE POLICY "Owner can delete recipes"
  ON cookbook_recipes FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

CREATE TRIGGER update_cookbook_recipes_updated_at
  BEFORE UPDATE ON cookbook_recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Recipe photos - same public-bucket shape as avatars (migration 041),
-- but write access is owner-role-gated rather than folder-scoped-by-uid,
-- since there's exactly one writer for this whole bucket by design (no
-- per-recipe folder needed - filenames are just random, flat in the
-- bucket root).
INSERT INTO storage.buckets (id, name, public)
VALUES ('cookbook-photos', 'cookbook-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Owner can upload cookbook photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cookbook-photos' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

CREATE POLICY "Owner can update cookbook photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'cookbook-photos' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

CREATE POLICY "Owner can delete cookbook photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'cookbook-photos' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

CREATE POLICY "Anyone can view cookbook photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cookbook-photos');
