-- Qualitative course context - read-only reference data, same "no client
-- write policy" precedent as race_courses. difficulty_factor is prompt/UI
-- context only, never multiplied into any time calculation (the time
-- bands below already encode real difficulty empirically) - avoids the
-- double-counting mistake that caused the Phase 1 volume bugs.
CREATE TABLE IF NOT EXISTS race_course_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL UNIQUE REFERENCES race_courses(id) ON DELETE CASCADE,
  difficulty_factor DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  elevation_gain_m INTEGER,
  swim_notes TEXT,
  bike_notes TEXT,
  run_notes TEXT
);

-- Expected elapsed-time RANGES by course + ability tier. All *_seconds
-- columns are elapsed time since race start (cumulative, matching how
-- cutoffs are actually published), not each discipline's own duration.
-- swim_exit/bike_finish are nullable - per-discipline splits are less
-- reliably sourceable per course than overall finish time; the app falls
-- back to a clearly-labeled estimated split when they're null.
CREATE TABLE IF NOT EXISTS race_course_time_bands (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES race_courses(id) ON DELETE CASCADE,
  ability_tier TEXT NOT NULL CHECK (ability_tier IN ('beginner', 'intermediate', 'advanced')),
  swim_exit_seconds_low INTEGER,
  swim_exit_seconds_high INTEGER,
  bike_finish_seconds_low INTEGER,
  bike_finish_seconds_high INTEGER,
  total_seconds_low INTEGER NOT NULL,
  total_seconds_high INTEGER NOT NULL,
  UNIQUE(course_id, ability_tier)
);

-- Per-segment cutoffs, also elapsed-since-start. No separate 'run' row -
-- the 'overall' cutoff IS the run/finish cutoff.
CREATE TABLE IF NOT EXISTS race_course_cutoffs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES race_courses(id) ON DELETE CASCADE,
  segment TEXT NOT NULL CHECK (segment IN ('swim', 'bike', 'overall')),
  cutoff_seconds_from_start INTEGER NOT NULL,
  UNIQUE(course_id, segment)
);

ALTER TABLE race_course_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_course_time_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_course_cutoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view race course profiles"
  ON race_course_profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view race course time bands"
  ON race_course_time_bands FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view race course cutoffs"
  ON race_course_cutoffs FOR SELECT USING (auth.role() = 'authenticated');

-- Seed data: a defensible STARTING POINT, not a claim of precise
-- per-course research. total_seconds bands use commonly-cited
-- industry-standard full-distance triathlon finish windows by ability
-- tier (beginner ~13-16h, intermediate ~11-13h, advanced ~9-11h).
-- Barcelona/Kalmar/Copenhagen get the standard bands unchanged (no
-- confident basis yet to differentiate between these three specifically).
-- Norseman/Swedeman get a flat +15% "harder" shift given their
-- well-documented extreme terrain/conditions (cold fjord swim, mountain
-- climbing/running) - a rough categorical adjustment, not fabricated
-- precision. swim_exit/bike_finish splits are left NULL everywhere
-- (honestly unsourced yet); the app derives a labeled estimate instead.
INSERT INTO race_course_time_bands (course_id, ability_tier, total_seconds_low, total_seconds_high)
SELECT id, tier.ability_tier, tier.total_seconds_low, tier.total_seconds_high
FROM race_courses,
  (VALUES
    ('beginner', 46800, 57600),
    ('intermediate', 39600, 46800),
    ('advanced', 32400, 39600)
  ) AS tier(ability_tier, total_seconds_low, total_seconds_high)
WHERE race_courses.race_type = 'ironman' AND race_courses.name IN ('Barcelona', 'Kalmar', 'Copenhagen');

INSERT INTO race_course_time_bands (course_id, ability_tier, total_seconds_low, total_seconds_high)
SELECT id, tier.ability_tier, tier.total_seconds_low, tier.total_seconds_high
FROM race_courses,
  (VALUES
    ('beginner', 54000, 64800),
    ('intermediate', 45000, 54000),
    ('advanced', 36000, 45000)
  ) AS tier(ability_tier, total_seconds_low, total_seconds_high)
WHERE race_courses.race_type = 'xtri' AND race_courses.name IN ('Norseman (Norway)', 'Swedeman (Sweden)');

-- Profiles: difficulty_factor is a display/prompt hint only (see comment
-- above) - Barcelona/Kalmar/Copenhagen at neutral 1.0, Norseman/Swedeman
-- flagged as notably harder (1.2) to match the time-band shift above.
INSERT INTO race_course_profiles (course_id, difficulty_factor, swim_notes, bike_notes, run_notes)
SELECT id, 1.0,
  'Sea swim, typically calm conditions.',
  'Flat, fast coastal bike course.',
  'Flat run course.'
FROM race_courses WHERE race_type = 'ironman' AND name IN ('Barcelona', 'Kalmar', 'Copenhagen');

INSERT INTO race_course_profiles (course_id, difficulty_factor, elevation_gain_m, swim_notes, bike_notes, run_notes)
SELECT id, 1.2, NULL,
  'Cold fjord-water swim start - wetsuit-mandatory conditions.',
  'Significant mountain climbing on the bike leg.',
  'Includes a mountain finish for athletes who qualify to continue past the cutoff.'
FROM race_courses WHERE race_type = 'xtri' AND name = 'Norseman (Norway)';

INSERT INTO race_course_profiles (course_id, difficulty_factor, swim_notes, bike_notes, run_notes)
SELECT id, 1.2,
  'Open-water swim in cold Scandinavian conditions.',
  'Hilly, technical bike course through northern Swedish terrain.',
  'Mountainous run terrain.'
FROM race_courses WHERE race_type = 'xtri' AND name = 'Swedeman (Sweden)';

-- Cutoffs: only the standard, extremely well-established full-distance
-- Ironman overall cutoff (17 hours) is seeded here, for the three
-- standard Ironman courses only. Norseman/Swedeman's real cutoff
-- structure is more unusual (staged qualification cutoffs, not a single
-- straightforward overall limit) and isn't confidently known enough to
-- assert here - left unseeded rather than guessed; the app already skips
-- cutoff messaging gracefully wherever no cutoff row exists. Add real
-- swim/bike/overall cutoffs for any course via manual SQL once sourced.
INSERT INTO race_course_cutoffs (course_id, segment, cutoff_seconds_from_start)
SELECT id, 'overall', 61200 -- 17:00:00
FROM race_courses WHERE race_type = 'ironman' AND name IN ('Barcelona', 'Kalmar', 'Copenhagen');
