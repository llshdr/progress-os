/* Isolated PostgreSQL (PGlite) checks. Uses a minimal owner-scoped baseline;
   applies the real migrations 088–091. Never reads a live database URL. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { PGlite } = require(
  process.env.LAPIS_PGLITE_MODULE || "@electric-sql/pglite",
);
const uid = "11111111-1111-4111-8111-111111111111",
  other = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const gid = "22222222-2222-4222-8222-222222222222",
  otherGoal = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const race = "33333333-3333-4333-8333-333333333333",
  otherRace = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
(async () => {
  const db = new PGlite();
  const run = (sql, params) => db.query(sql, params);
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth, public TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      CREATE TABLE goals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),title text,status text DEFAULT 'active',created_at timestamptz DEFAULT now());
      CREATE TABLE races(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),race_date date NOT NULL);
      CREATE TABLE user_settings(user_id uuid PRIMARY KEY REFERENCES auth.users(id));
      CREATE TABLE workout_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id));
      CREATE TABLE workout_schedule_slots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id));
      CREATE TABLE workouts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),date date NOT NULL,workout_type text,notes text,template_id uuid REFERENCES workout_templates(id),schedule_slot_id uuid REFERENCES workout_schedule_slots(id),started_at timestamptz DEFAULT now(),completed_at timestamptz);
      CREATE TABLE exercise_library(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),name text NOT NULL,primary_muscle_group text NOT NULL,equipment_type text NOT NULL,category text NOT NULL,exercise_type text,cardio_type text,archived boolean DEFAULT false,created_at timestamptz DEFAULT now());
      CREATE TABLE workout_template_exercises(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),template_id uuid REFERENCES workout_templates(id),exercise_library_id uuid REFERENCES exercise_library(id),exercise_order integer,notes text);
      CREATE TABLE exercises(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workout_id uuid REFERENCES workouts(id),exercise_library_id uuid REFERENCES exercise_library(id),exercise_order integer,notes text,template_exercise_id uuid REFERENCES workout_template_exercises(id));
      CREATE TABLE cardio_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),exercise_id uuid UNIQUE REFERENCES exercises(id),distance_km numeric(6,2) NOT NULL,duration_seconds integer NOT NULL);
      CREATE TABLE race_training_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),race_id uuid UNIQUE REFERENCES races(id),approach text,overview text,weeks jsonb,phase_templates jsonb,generated_at timestamptz DEFAULT now());
      CREATE TABLE calendar_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),title text,start_date date,end_date date,start_time time,end_time time,note text,CHECK(end_date>=start_date));
      CREATE TABLE milestones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),goal_id uuid REFERENCES goals(id),title text,description text,due_date date,status text CHECK(status IN ('active','done','archived')));
      CREATE TABLE race_budget_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES auth.users(id),race_id uuid REFERENCES races(id),category text,description text,amount numeric CHECK(amount>=0),incurred_date date);`);
    for (const table of [
      "goals",
      "races",
      "user_settings",
      "workout_templates",
      "workout_schedule_slots",
      "workouts",
      "exercise_library",
      "race_training_plans",
      "calendar_entries",
      "milestones",
      "race_budget_items",
    ]) {
      await db.exec(
        `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY own_rows ON ${table} FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());`,
      );
    }
    await db.exec(`ALTER TABLE exercises ENABLE ROW LEVEL SECURITY; CREATE POLICY own_rows ON exercises FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM workouts w WHERE w.id=workout_id AND w.user_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM workouts w WHERE w.id=workout_id AND w.user_id=auth.uid()));
      ALTER TABLE cardio_logs ENABLE ROW LEVEL SECURITY; CREATE POLICY own_rows ON cardio_logs FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM exercises e JOIN workouts w ON w.id=e.workout_id WHERE e.id=exercise_id AND w.user_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM exercises e JOIN workouts w ON w.id=e.workout_id WHERE e.id=exercise_id AND w.user_id=auth.uid()));
      ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY; CREATE POLICY own_rows ON workout_template_exercises FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM workout_templates t WHERE t.id=template_id AND t.user_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM workout_templates t WHERE t.id=template_id AND t.user_id=auth.uid()));`);
    for (const prefix of ["088_", "089_", "090_", "091_"]) {
      const file = fs
        .readdirSync("supabase/migrations")
        .find((f) => f.startsWith(prefix));
      await db.exec(fs.readFileSync(`supabase/migrations/${file}`, "utf8"));
    }
    await db.exec(
      "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated",
    );
    await run("INSERT INTO auth.users VALUES($1),($2)", [uid, other]);
    await run(
      "INSERT INTO goals(id,user_id,title) VALUES($1,$2,$3),($4,$5,$6)",
      [gid, uid, "Ironman", otherGoal, other, "Private goal"],
    );
    await run(
      "INSERT INTO races(id,user_id,race_date,goal_id) VALUES($1,$2,'2027-10-03',$3),($4,$5,'2027-10-03',$6)",
      [race, uid, gid, otherRace, other, otherGoal],
    );
    await db.exec("SET ROLE authenticated");
    await run("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
    assert.equal(
      (await run("SELECT * FROM goals")).rows.length,
      1,
      "RLS hides the other account",
    );
    assert.equal(
      (await run("SELECT world_slot FROM goals WHERE id=$1", [gid])).rows[0]
        .world_slot,
      0,
    );
    const second = (
      await run(
        "INSERT INTO goals(user_id,title) VALUES($1,'Business') RETURNING id,world_slot",
        [uid],
      )
    ).rows[0];
    assert.equal(second.world_slot, 1);
    await run(
      "UPDATE goals SET attention='paused',status='archived' WHERE id=$1",
      [gid],
    );
    assert.equal(
      (await run("SELECT world_slot FROM goals WHERE id=$1", [second.id]))
        .rows[0].world_slot,
      1,
      "archiving preserves positions",
    );
    await assert.rejects(
      run("UPDATE races SET goal_id=$1 WHERE id=$2", [otherGoal, race]),
      /Goal not available/,
    );
    await run(
      "INSERT INTO user_settings(user_id,active_race_id) VALUES($1,$2)",
      [uid, race],
    );
    await assert.rejects(
      run("UPDATE user_settings SET active_race_id=$1 WHERE user_id=$2", [
        otherRace,
        uid,
      ]),
      /Race not available/,
    );
    const start = async (key, kind, r = race) =>
      (
        await run("SELECT start_planned_session($1,$2,$3,$4,$5) AS id", [
          key,
          "2026-09-21",
          kind,
          kind,
          r,
        ])
      ).rows[0].id;
    const first = await start("race:swim", "swim");
    assert.equal(
      await start("race:swim", "swim"),
      first,
      "retry returns the same workout",
    );
    assert.equal(
      await start("race:strength", "strength"),
      first,
      "another tap resumes the active workout",
    );
    assert.equal(
      (await run("SELECT * FROM exercises WHERE workout_id=$1", [first])).rows
        .length,
      1,
    );
    assert.equal(
      (
        await run("SELECT * FROM workout_goal_links WHERE workout_id=$1", [
          first,
        ])
      ).rows.length,
      1,
    );
    await run("UPDATE workouts SET completed_at=now() WHERE id=$1", [first]);
    const next = await start("race:strength", "strength");
    assert.notEqual(next, first);
    assert.equal(
      (await run("SELECT * FROM workouts")).rows.length,
      2,
      "two disciplines create two sessions after completion",
    );
    await assert.rejects(
      start("race:other", "run", otherRace),
      /Race not available/,
    );
    await run("UPDATE workouts SET completed_at=now() WHERE id=$1", [next]);
    const candidate = {
      approach: "balanced",
      overview: "Reviewed",
      weeks: [],
      phaseTemplates: {},
    };
    const draft = (
      await run(
        "INSERT INTO race_plan_previews(user_id,race_id,payload,base_race_date) VALUES($1,$2,$3,'2027-10-03') RETURNING id",
        [uid, race, JSON.stringify(candidate)],
      )
    ).rows[0].id;
    assert.equal(
      (await run("SELECT * FROM race_training_plans")).rows.length,
      0,
      "preview alone does not save a plan",
    );
    await run("SELECT apply_race_plan_preview($1)", [draft]);
    const version = (await run("SELECT * FROM race_training_plans")).rows[0];
    await run("SELECT apply_race_plan_preview($1)", [draft]);
    assert.equal(
      (await run("SELECT * FROM race_training_plans")).rows.length,
      1,
      "Apply is idempotent",
    );
    const expired = (
      await run(
        "INSERT INTO race_plan_previews(user_id,race_id,payload,base_plan,base_race_date,review_week) VALUES($1,$2,$3,$4,'2027-10-03',date_trunc('week',now() AT TIME ZONE 'UTC')::date-7) RETURNING id",
        [uid, race, JSON.stringify(candidate), JSON.stringify(version)],
      )
    ).rows[0].id;
    await assert.rejects(
      run("SELECT apply_race_plan_preview($1)", [expired]),
      /new training week/,
    );
    const conflict = (
      await run(
        "INSERT INTO race_plan_previews(user_id,race_id,payload,base_plan,base_race_date) VALUES($1,$2,$3,$4,'2027-10-03') RETURNING id",
        [uid, race, JSON.stringify(candidate), JSON.stringify(version)],
      )
    ).rows[0].id;
    await run(
      "UPDATE race_training_plans SET phase_templates='{" +
        '"base":{}' +
        "}'::jsonb WHERE race_id=$1",
      [race],
    );
    await assert.rejects(
      run("SELECT apply_race_plan_preview($1)", [conflict]),
      /Saved plan changed/,
    );
    const baseItem = {
      sourceKey: "f".repeat(64),
      title: "Booking",
      kind: "calendar",
      date: "2026-10-01",
      endDate: "2026-10-03",
    };
    const apply = async (item) =>
      (
        await run("SELECT apply_import_item($1) AS result", [
          JSON.stringify(item),
        ])
      ).rows[0].result;
    const imported = await apply(baseItem);
    assert.equal(imported.duplicate, false);
    assert.equal((await apply(baseItem)).duplicate, true);
    assert.equal(
      (await run("SELECT * FROM calendar_entries")).rows.length,
      1,
      "retry does not duplicate an import",
    );
    await assert.rejects(
      apply({
        ...baseItem,
        sourceKey: "a".repeat(64),
        kind: "task",
        goalId: otherGoal,
      }),
      /Goal unavailable/,
    );
    await assert.rejects(
      apply({
        ...baseItem,
        sourceKey: "b".repeat(64),
        kind: "expense",
        raceId: race,
        amount: 10,
        currencyConfirmed: false,
      }),
      /Confirm race/,
    );
    await apply({
      ...baseItem,
      sourceKey: "c".repeat(64),
      kind: "expense",
      raceId: race,
      amount: 10,
      currencyConfirmed: true,
    });
    await apply({
      ...baseItem,
      sourceKey: "d".repeat(64),
      kind: "task",
      goalId: gid,
    });
    const importedWorkout = await apply({
      ...baseItem,
      sourceKey: "e".repeat(64),
      kind: "workout",
      raceId: race,
      discipline: "running",
      distanceKm: 5,
      durationSeconds: 1800,
    });
    assert.equal((await run("SELECT * FROM cardio_logs")).rows.length, 1);
    assert.equal(
      (
        await run("SELECT * FROM workout_goal_links WHERE workout_id=$1", [
          importedWorkout.id,
        ])
      ).rows.length,
      1,
    );
    await assert.rejects(
      apply({
        ...baseItem,
        sourceKey: "9".repeat(64),
        kind: "workout",
        discipline: "running",
        distanceKm: -1,
        durationSeconds: 1800,
      }),
      /Invalid workout/,
    );
    assert.equal(
      (await run("SELECT * FROM import_receipts")).rows.length,
      4,
      "failed imports leave no receipt or partial destination",
    );
    await run(
      "INSERT INTO integration_connections(user_id,provider,encrypted_tokens,expires_at) VALUES($1,'gmail','test-ciphertext',now())",
      [uid],
    );
    await run("SELECT set_config('request.jwt.claim.sub',$1,false)", [other]);
    assert.equal(
      (await run("SELECT * FROM integration_connections")).rows.length,
      0,
      "tokens are account-scoped",
    );
    assert.equal(
      (await run("SELECT * FROM import_receipts")).rows.length,
      0,
      "receipts are account-scoped",
    );
    await assert.rejects(
      run("SELECT apply_race_plan_preview($1)", [draft]),
      /Plan preview unavailable/,
    );
    console.log(
      "Connected migrations: ownership, RLS, stable positions, idempotent sessions/imports, and plan conflict checks passed.",
    );
  } finally {
    await db.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
