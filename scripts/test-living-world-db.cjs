/* Runs migration 092 against an isolated PostgreSQL fixture. No live database. */
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { PGlite } = require(
  process.env.LAPIS_PGLITE_MODULE || "@electric-sql/pglite",
);
(async () => {
  const db = new PGlite();
  const run = (sql, p) => db.query(sql, p);
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE TABLE user_settings(user_id uuid PRIMARY KEY);
CREATE TABLE goals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,title text,status text DEFAULT 'active',world_slot integer);
CREATE TABLE milestones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,goal_id uuid REFERENCES goals(id),title text,status text DEFAULT 'active');
CREATE TABLE workouts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,date date,completed_at timestamptz);
CREATE TABLE workout_goal_links(workout_id uuid REFERENCES workouts(id),goal_id uuid REFERENCES goals(id),user_id uuid);
CREATE TABLE nutrition_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,date date);
CREATE TABLE sleep_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,date date);
CREATE TABLE habit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,date date);
CREATE TABLE calendar_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,title text,start_date date,end_date date,recurrence_weekdays integer[]);
CREATE TABLE goal_checkins(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,goal_id uuid REFERENCES goals(id),focus text,created_at timestamptz DEFAULT now());
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`);
    for (const table of [
      "user_settings",
      "goals",
      "milestones",
      "workouts",
      "workout_goal_links",
      "nutrition_entries",
      "sleep_entries",
      "habit_logs",
      "calendar_entries",
      "goal_checkins",
    ])
      await db.exec(
        `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY own ON ${table} FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());`,
      );
    await db.exec(
      fs.readFileSync("supabase/migrations/092_living_world.sql", "utf8"),
    );
    const uid = "11111111-1111-4111-8111-111111111111",
      other = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await run("INSERT INTO auth.users VALUES($1),($2)", [uid, other]);
    const a = (
      await run(
        "INSERT INTO goals(user_id,title) VALUES($1,'Ironman') RETURNING id",
        [uid],
      )
    ).rows[0].id;
    const b = (
      await run(
        "INSERT INTO goals(user_id,title) VALUES($1,'Private') RETURNING id",
        [other],
      )
    ).rows[0].id;
    await db.exec("SET ROLE authenticated");
    await run("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
    await run(
      "INSERT INTO user_settings(user_id,world_country) VALUES($1,'SE')",
      [uid],
    );
    const summary = async () =>
      (await run("SELECT world_summary('Europe/Stockholm') AS data")).rows[0]
        .data;
    assert.equal((await summary()).xp, 0);
    await run(
      "INSERT INTO workouts(user_id,date,completed_at) VALUES($1,current_date,now()),($1,current_date,now())",
      [uid],
    );
    await run(
      "INSERT INTO nutrition_entries(user_id,date) VALUES($1,current_date),($1,current_date)",
      [uid],
    );
    await run(
      "INSERT INTO sleep_entries(user_id,date) VALUES($1,current_date)",
      [uid],
    );
    assert.equal(
      (await summary()).xp,
      60,
      "one reward per routine category/day, not per duplicate record",
    );
    const step = (
      await run(
        "INSERT INTO calendar_entries(user_id,title,start_date,end_date,goal_id) VALUES($1,'Study pacing',current_date,current_date,$2) RETURNING id",
        [uid, a],
      )
    ).rows[0].id;
    await run("SELECT set_goal_step_done($1,true,'Europe/Stockholm')", [step]);
    await run("SELECT set_goal_step_done($1,true,'Europe/Stockholm')", [step]);
    assert.equal(
      (await run("SELECT * FROM goal_checkins")).rows.length,
      1,
      "retry writes one check-in",
    );
    assert.equal((await summary()).xp, 70);
    await run("SELECT set_goal_step_done($1,false,'Europe/Stockholm')", [step]);
    assert.equal((await summary()).xp, 60);
    assert.equal((await run("SELECT * FROM goal_checkins")).rows.length, 0);
    await assert.rejects(
      run(
        "INSERT INTO calendar_entries(user_id,title,start_date,end_date,goal_id) VALUES($1,'Other goal',current_date,current_date,$2)",
        [uid, b],
      ),
      /Goal not available/,
    );
    await assert.rejects(
      run(
        "INSERT INTO goal_checkins(user_id,goal_id,focus) VALUES($1,$2,'private')",
        [uid, b],
      ),
      /Goal not available/,
    );
    const future = (
      await run(
        "INSERT INTO calendar_entries(user_id,title,start_date,end_date,goal_id) VALUES($1,'Later',current_date+5,current_date+5,$2) RETURNING id",
        [uid, a],
      )
    ).rows[0].id;
    await assert.rejects(
      run("SELECT set_goal_step_done($1,true,'Europe/Stockholm')", [future]),
      /future day/,
    );
    const milestone = (
      await run(
        "INSERT INTO milestones(user_id,goal_id,title,status) VALUES($1,$2,'First block','done') RETURNING id,reached_at",
        [uid, a],
      )
    ).rows[0];
    assert(milestone.reached_at);
    assert.equal((await summary()).xp, 110);
    await run("UPDATE goals SET status='done' WHERE id=$1", [a]);
    let achieved = (await run("SELECT * FROM goals WHERE id=$1", [a])).rows[0];
    assert.equal(achieved.summit_country, "SE");
    assert(achieved.reached_at);
    assert.equal((await summary()).xp, 260);
    await run("UPDATE user_settings SET world_country='NO' WHERE user_id=$1", [
      uid,
    ]);
    await run("UPDATE goals SET status='active' WHERE id=$1", [a]);
    assert.equal((await summary()).xp, 110);
    await run("UPDATE goals SET status='done' WHERE id=$1", [a]);
    const again = (await run("SELECT * FROM goals WHERE id=$1", [a])).rows[0];
    assert.equal(String(again.reached_at), String(achieved.reached_at));
    assert.equal(again.summit_country, "SE");
    assert.equal(
      (await summary()).xp,
      260,
      "reopening does not accumulate rewards",
    );
    await assert.rejects(
      run("SELECT arrange_world($1::uuid[])", [[b]]),
      /world changed/,
    );
    await run("SELECT arrange_world($1::uuid[])", [[a]]);
    assert.equal(
      (await run("SELECT world_slot FROM goals WHERE id=$1", [a])).rows[0]
        .world_slot,
      0,
    );
    await run("SELECT set_config('request.jwt.claim.sub',$1,false)", [other]);
    assert.equal(
      (await summary()).xp,
      0,
      "other account has no access to first account progress",
    );
    await assert.rejects(
      run("SELECT set_goal_step_done($1,true,'UTC')", [step]),
      /not available/,
    );
    await run("UPDATE goals SET status='done' WHERE id=$1", [b]);
    assert.equal(
      (await run("SELECT summit_country FROM goals WHERE id=$1", [b])).rows[0]
        .summit_country,
      "ZZ",
      "a LAPIS flag is also snapshotted",
    );
    await run(
      "INSERT INTO user_settings(user_id,world_country) VALUES($1,'SE')",
      [other],
    );
    await run("UPDATE goals SET status='active' WHERE id=$1", [b]);
    await run("UPDATE goals SET status='done' WHERE id=$1", [b]);
    assert.equal(
      (await run("SELECT summit_country FROM goals WHERE id=$1", [b])).rows[0]
        .summit_country,
      "ZZ",
      "a later country choice does not replace an existing LAPIS flag",
    );
    console.log(
      "Living World database: progress caps, retry/undo, owner isolation, future steps, milestone progress, flag snapshots and arrangement passed.",
    );
  } finally {
    await db.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
