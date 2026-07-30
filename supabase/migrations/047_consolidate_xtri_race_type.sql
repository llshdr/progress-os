-- Consolidate Norseman and Swedeman from separate top-level race types
-- into selectable courses under one 'xtri' (extreme triathlon) race_type -
-- they're both iron-distance triathlons in the same category, not
-- distinct series, and this leaves room to add more Xtri races (Celtman,
-- etc.) as courses later without needing a new race_type each time.

-- Existing course rows just move under the new race_type; their ids
-- don't change, so any races.course_id already pointing at them keeps
-- working with no further changes needed. display_order is renumbered
-- (both were 0 as the sole course of their own former race_type) so they
-- don't collide, and to leave 2+ open for future Xtri courses.
UPDATE race_courses
SET race_type = 'xtri',
    display_order = CASE name WHEN 'Norseman (Norway)' THEN 0 WHEN 'Swedeman (Sweden)' THEN 1 ELSE display_order END
WHERE race_type IN ('norseman', 'swedeman');

-- Drop the old CHECK constraint before touching existing race_type values
-- below - Postgres would otherwise reject the UPDATE against the still-
-- active old constraint (which doesn't yet allow 'xtri').
ALTER TABLE races DROP CONSTRAINT races_race_type_check;

-- Migrate any already-created race rows onto the new type, rather than
-- leaving them with a now-invalid race_type. course_id (if set) already
-- points at the correct course row updated above, so it's left untouched.
UPDATE races SET race_type = 'xtri' WHERE race_type IN ('norseman', 'swedeman');

ALTER TABLE races ADD CONSTRAINT races_race_type_check CHECK (race_type IN
  ('ironman', 'xtri', 'marathon', 'half_marathon', '10k', '5k', 'ultra_run', 'other'));
