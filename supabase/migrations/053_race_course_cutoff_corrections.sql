-- Corrects the generic 17:00 Ironman-standard 'overall' cutoff seeded in
-- 051_race_course_data.sql for the three courses whose real cutoffs are
-- shorter than the standard. A starting point from the best available
-- research, not a claim of precise official confirmation - same framing
-- as 051's own seed data comment. Sources:
--  - Phazon Triathlon's dedicated European-cutoff roundup
--    (https://www.phazontriathlon.com/european-ironman-cut-off-times/):
--    Barcelona 16:00, Kalmar 16:00, Copenhagen 15:45.
--  - barcelonahacks.com's more granular segment breakdown (swim 2:20,
--    swim+bike 9:10) implies an overall cutoff of 15:40 for Barcelona
--    specifically - conflicts with Phazon's 16:00, and that page's own
--    comments show readers disputing it too. Neither source is the
--    official IRONMAN athlete guide (not reachable to verify directly).
--    Using the STRICTER of the two candidates (15:40) as the
--    conservative choice for a safety-margin feature: a falsely tight
--    margin just means training more conservatively than strictly
--    necessary; a falsely loose one risks a genuinely wrong safety read.
--    Barcelona's exact figure remains unresolved pending the official
--    athlete guide - revisit if/when that's confirmed.
--  - Copenhagen (15:45) and Kalmar (16:00) are better/single-sourced
--    respectively - Copenhagen had a second independent corroborating
--    mention, Kalmar rests on Phazon alone.
UPDATE race_course_cutoffs SET cutoff_seconds_from_start = 56400 -- 15:40:00
WHERE segment = 'overall' AND course_id = (SELECT id FROM race_courses WHERE race_type = 'ironman' AND name = 'Barcelona');

UPDATE race_course_cutoffs SET cutoff_seconds_from_start = 56700 -- 15:45:00
WHERE segment = 'overall' AND course_id = (SELECT id FROM race_courses WHERE race_type = 'ironman' AND name = 'Copenhagen');

UPDATE race_course_cutoffs SET cutoff_seconds_from_start = 57600 -- 16:00:00
WHERE segment = 'overall' AND course_id = (SELECT id FROM race_courses WHERE race_type = 'ironman' AND name = 'Kalmar');
