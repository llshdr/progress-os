/* Browser integration against an isolated mock Supabase server. Build with
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 and
   NEXT_PUBLIC_SUPABASE_ANON_KEY=local-ui-test-key first. No live accounts. */
const http = require("node:http"),
  { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { randomUUID } = require("node:crypto");
const { chromium } = require("playwright");
process.env.NO_PROXY = process.env.no_proxy = "127.0.0.1,localhost";
const uid = "11111111-1111-4111-8111-111111111111",
  gid = "22222222-2222-4222-8222-222222222222",
  rid = "33333333-3333-4333-8333-333333333333",
  wid = "44444444-4444-4444-8444-444444444444",
  exid = "55555555-5555-4555-8555-555555555555",
  lid = "66666666-6666-4666-8666-666666666666",
  slotId = "77777777-7777-4777-8777-777777777777";
const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
  weekday = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7;
const shift = (day, n) => {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const monday = shift(today, -weekday);
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "fixture@example.test",
  app_metadata: { provider: "email" },
  user_metadata: { full_name: "Lucas" },
  created_at: "2026-01-01T00:00:00Z",
};
const avatar =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#147cd5"/><circle cx="16" cy="12" r="6" fill="#fae5be"/><path d="M4 32v-7q12-16 24 0v7" fill="#f4c074"/></svg>',
  ).toString("base64");
const template = {
  enduranceSlots: [
    {
      day: weekday,
      type: "swim",
      role: "technique",
      shareOfWeeklyTotal: 1,
      progression: null,
      time: "06:30",
    },
  ],
  strengthSlots: [{ day: weekday, focus: "upper", time: "17:30" }],
  brickDays: [],
  dayCapacityWarning: null,
};
const week = (start, phase = "base") => ({
  weekStartDate: start,
  phase,
  disciplines: {
    swim: { sessions: 1, km: 2, protectedKeyKm: null },
    bike: { sessions: 0, km: 0, protectedKeyKm: null },
    run: { sessions: 0, km: 0, protectedKeyKm: null },
  },
  brickSessions: 0,
  targetCardioKm: 2,
  targetCardioSessions: 1,
  targetStrengthSessions: 1,
  isAcclimation: false,
  isSimulationWeek: false,
  combinedBikeLoad: null,
  focusNote: "Keep the week consistent and make room for recovery.",
});
const baseGoal = {
  id: gid,
  user_id: uid,
  title: "Ironman",
  next_action: "Complete an easy technique swim",
  scope: "long_term",
  world_style: "summit",
  status: "active",
  attention: "focus",
  world_slot: 0,
  target_date: shift(today, 300),
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  description: "Build toward the start line, one week at a time.",
  milestones: [
    {
      id: randomUUID(),
      title: "Complete the first training block",
      status: "done",
      next_action: null,
    },
    {
      id: randomUUID(),
      title: "First open-water session",
      status: "active",
      next_action: "Choose a supervised session",
    },
  ],
};
const fixtures = {
  profiles: [{ id: uid, full_name: "Lucas", avatar_url: avatar }],
  public_profiles: [
    { user_id: uid, display_name: "Lucas", rank: 2, avatar_url: avatar },
  ],
  user_roles: [{ user_id: uid, role: "owner" }],
  user_settings: [
    {
      user_id: uid,
      weekly_workout_goal: 5,
      schedule_mode: "calendar",
      count_cardio_toward_workout_goal: true,
      show_today_suggestions: false,
      wake_time: "06:00:00",
      sleep_time: "23:00:00",
      active_race_id: rid,
      world_country: "SE",
    },
  ],
  goals: [
    baseGoal,
    ...[
      "Olympics · Sweden",
      "Everest summit",
      "IFBB Pro · natural",
      "Build my business",
    ].map((title, i) => ({
      ...baseGoal,
      id: randomUUID(),
      title,
      world_slot: i + 1,
      attention: i === 1 ? "later" : i === 2 ? "paused" : "focus",
      world_style: i === 3 ? "basecamp" : "summit",
      milestones: [],
    })),
  ],
  workouts: [
    {
      id: wid,
      user_id: uid,
      date: today,
      started_at: today + "T07:00:00Z",
      completed_at: today + "T08:00:00Z",
      workout_type: "Upper body",
      template_id: null,
      schedule_slot_id: slotId,
      planned_session_key: `race:${rid}:${today}:strength:0`,
      workout_templates: null,
      exercises: [
        { exercise_library: { exercise_type: "strength" }, cardio_logs: null },
      ],
    },
  ],
  workout_schedule_slots: Array.from({ length: 7 }, (_, i) => ({
    id: i === weekday ? slotId : randomUUID(),
    user_id: uid,
    template_id: null,
    label: i === weekday ? "Upper body" : "Rest Day",
    slot_order: i,
    usual_time: "17:30",
    workout_templates: null,
  })),
  exercise_library: [
    {
      id: lid,
      user_id: uid,
      name: "Bench press",
      primary_muscle_group: "Chest",
      equipment_type: "Barbell",
      exercise_type: "strength",
      cardio_type: null,
      archived: false,
    },
  ],
  exercises: [
    {
      id: exid,
      workout_id: wid,
      exercise_library_id: lid,
      exercise_order: 0,
      exercise_library: {
        id: lid,
        name: "Bench press",
        exercise_type: "strength",
        primary_muscle_group: "Chest",
      },
    },
  ],
  sets: [],
  cardio_logs: [],
  races: [
    {
      id: rid,
      user_id: uid,
      race_type: "ironman",
      location: "Barcelona",
      course_id: null,
      race_date: shift(today, 300),
      training_start_date: shift(today, -60),
      goal_id: gid,
      target_finish_seconds: 54000,
      result_duration_seconds: null,
      self_assessment: null,
      discipline_weakness: {
        order: ["swim", "run", "bike"],
        notes: { swim: "Technique", run: "Consistency", bike: "Base" },
      },
    },
  ],
  race_training_plans: [
    {
      id: randomUUID(),
      race_id: rid,
      user_id: uid,
      approach: "balanced",
      overview: "Build a consistent foundation across disciplines.",
      weeks: [
        week(shift(monday, -7)),
        week(monday),
        week(shift(monday, 7)),
        week(shift(monday, 14), "build"),
      ],
      phase_templates: { base: template, build: template },
      generated_at: new Date().toISOString(),
    },
  ],
  race_checklist_items: [
    {
      id: randomUUID(),
      race_id: rid,
      user_id: uid,
      title: "Check wetsuit fit",
      category: "gear",
      done_at: null,
      display_order: 0,
    },
  ],
  milestones: baseGoal.milestones.map((m) =>
    Object.assign(m, {
      user_id: uid,
      goal_id: gid,
      created_at: "2026-09-01T00:00:00Z",
    }),
  ),
  goal_checkins: [],
  habits: [
    {
      id: "88888888-8888-4888-8888-888888888888",
      user_id: uid,
      name: "Read for ten minutes",
      recurrence_weekdays: [0, 1, 2, 3, 4, 5, 6],
      usual_time: null,
    },
  ],
  habit_logs: [],
  sleep_entries: [],
  workout_goal_links: [],
  calendar_entries: [],
  nutrition_entries: [],
  nutrition_food_items: [],
  integration_connections: [],
  import_receipts: [],
  race_plan_previews: [],
};
let mode = "normal",
  failSets = false,
  previewApplies = 0;
const mock = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const url = new URL(req.url, "http://127.0.0.1"),
    table = url.pathname.split("/").pop();
  if (url.pathname === "/auth/v1/user") return res.end(JSON.stringify(user));
  if (url.pathname.startsWith("/auth/"))
    return res.end(JSON.stringify({ user }));
  let input = {};
  if (["POST", "PATCH"].includes(req.method)) {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    input = JSON.parse(raw || "{}");
  }
  if (url.pathname.includes("/rpc/")) {
    if (table === "world_summary") {
      if (mode === "error") {
        res.writeHead(500);
        return res.end(JSON.stringify({ message: "Isolated failure" }));
      }
      const done = fixtures.goals.filter((g) => g.status === "done");
      const xp =
        90 +
        fixtures.milestones.filter((m) => m.status === "done").length * 50 +
        done.length * 150 +
        (fixtures.goal_checkins.length ? 10 : 0) +
        fixtures.habit_logs.length * 5;
      return res.end(
        JSON.stringify({
          xp: mode === "empty" ? 0 : xp,
          todayXp: 40,
          country: fixtures.user_settings[0].world_country,
          sources: { training: 40, milestones: 50 },
          activity: [
            {
              kind: "training",
              day: today,
              xp: 40,
              title: "Training logged",
              href: "/gym/workouts",
            },
          ],
          goals: Object.fromEntries(
            fixtures.goals.map((g) => [
              g.id,
              {
                sessions: fixtures.workout_goal_links.filter(
                  (l) => l.goal_id === g.id,
                ).length,
                checkins: fixtures.goal_checkins.filter(
                  (c) => c.goal_id === g.id,
                ).length,
              },
            ]),
          ),
        }),
      );
    }
    if (table === "arrange_world") {
      input.p_ids.forEach((id, i) => {
        fixtures.goals.find((g) => g.id === id).world_slot = i;
      });
      return res.end("null");
    }
    if (table === "set_goal_step_done") {
      const item = fixtures.calendar_entries.find(
        (e) => e.id === input.p_entry,
      );
      item.completed_at = input.p_done ? new Date().toISOString() : null;
      fixtures.goal_checkins = fixtures.goal_checkins.filter(
        (c) => c.calendar_entry_id !== item.id,
      );
      if (input.p_done)
        fixtures.goal_checkins.push({
          id: randomUUID(),
          user_id: uid,
          goal_id: item.goal_id,
          calendar_entry_id: item.id,
          focus: "Completed: " + item.title,
          created_at: new Date().toISOString(),
        });
      return res.end("null");
    }
    if (table === "start_planned_session") {
      let w =
        fixtures.workouts.find((w) => w.planned_session_key === input.p_key) ||
        fixtures.workouts.find((w) => w.completed_at == null);
      if (!w) {
        w = {
          id: randomUUID(),
          user_id: uid,
          date: input.p_date,
          workout_type: input.p_title,
          completed_at: null,
          started_at: new Date().toISOString(),
          planned_session_key: input.p_key,
          race_id: input.p_race,
          schedule_slot_id: input.p_slot,
          template_id: null,
          workout_templates: null,
        };
        fixtures.workouts.push(w);
      }
      return res.end(JSON.stringify(w.id));
    }
    if (table === "apply_import_item") {
      const item = input.p_item;
      let receipt = fixtures.import_receipts.find(
        (r) => r.source_key === item.sourceKey && r.kind === item.kind,
      );
      const duplicate = !!receipt;
      if (!receipt) {
        receipt = {
          id: randomUUID(),
          user_id: uid,
          source_key: item.sourceKey,
          kind: item.kind,
          destination_id: randomUUID(),
          title: item.title,
          created_at: new Date().toISOString(),
        };
        fixtures.import_receipts.push(receipt);
      }
      return res.end(JSON.stringify({ id: receipt.destination_id, duplicate }));
    }
    if (table === "apply_race_plan_preview") {
      previewApplies++;
      return res.end(JSON.stringify(rid));
    }
    return res.end("null");
  }
  if (
    (mode === "error" && ["goals", "workouts"].includes(table)) ||
    (failSets && table === "sets" && req.method === "POST")
  ) {
    res.writeHead(500);
    return res.end(JSON.stringify({ message: "Isolated test failure" }));
  }
  const empty =
    mode === "empty" &&
    [
      "goals",
      "races",
      "race_training_plans",
      "workouts",
      "workout_schedule_slots",
    ].includes(table);
  let rows = empty ? [] : [...(fixtures[table] || [])];
  for (const [key, value] of url.searchParams) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(key))
      continue;
    if (value === "is.null") rows = rows.filter((r) => r[key] == null);
    else if (value === "not.is.null") rows = rows.filter((r) => r[key] != null);
    else if (value.startsWith("eq."))
      rows = rows.filter((r) => String(r[key]) === value.slice(3));
    else if (value.startsWith("neq."))
      rows = rows.filter((r) => String(r[key]) !== value.slice(4));
    else if (value.startsWith("gte."))
      rows = rows.filter((r) => String(r[key]) >= value.slice(4));
    else if (value.startsWith("lte."))
      rows = rows.filter((r) => String(r[key]) <= value.slice(4));
    else if (value.startsWith("lt."))
      rows = rows.filter((r) => String(r[key]) < value.slice(3));
    else if (value.startsWith("in.(")) {
      const choices = value.slice(4, -1).split(",");
      rows = rows.filter((r) => choices.includes(String(r[key])));
    }
  }
  if (url.searchParams.has("order")) {
    const [key, direction] = url.searchParams.get("order").split(".");
    rows.sort(
      (a, b) =>
        String(a[key] ?? "").localeCompare(String(b[key] ?? "")) *
        (direction === "desc" ? -1 : 1),
    );
  }
  const count = rows.length;
  if (url.searchParams.has("limit"))
    rows = rows.slice(0, Number(url.searchParams.get("limit")));
  res.setHeader("Content-Range", `0-${Math.max(0, rows.length - 1)}/${count}`);
  if (req.method === "HEAD") return res.end();
  if (req.method === "PATCH") {
    rows.forEach((r) => Object.assign(r, input));
    if (table === "goals" && input.status === "done")
      rows.forEach((r) => {
        r.reached_at ??= new Date().toISOString();
        r.summit_country ??= fixtures.user_settings[0].world_country || "ZZ";
      });
    return res.end(
      JSON.stringify(
        (req.headers.accept || "").includes("vnd.pgrst.object+json")
          ? rows[0]
          : rows,
      ),
    );
  }
  if (req.method === "DELETE") {
    fixtures[table] = (fixtures[table] || []).filter((r) => !rows.includes(r));
    return res.end("{}");
  }
  if (req.method === "POST") {
    const newRows = (Array.isArray(input) ? input : [input]).map((v) => {
      let existing = fixtures[table]?.find(
        (r) =>
          (v.id && r.id === v.id) ||
          (table === "habit_logs" &&
            r.habit_id === v.habit_id &&
            r.date === v.date) ||
          (table === "user_settings" && r.user_id === v.user_id),
      );
      if (existing) {
        Object.assign(existing, v);
        return existing;
      }
      const row = {
        id: randomUUID(),
        created_at: new Date().toISOString(),
        ...v,
      };
      (fixtures[table] ??= []).push(row);
      return row;
    });
    return res.end(
      JSON.stringify(
        (req.headers.accept || "").includes("vnd.pgrst.object+json")
          ? newRows[0]
          : newRows,
      ),
    );
  }
  if (
    table === "workout_goal_links" &&
    (url.searchParams.get("select") || "").includes("workouts(")
  )
    rows = rows.map((r) => ({
      ...r,
      workouts: fixtures.workouts.find((w) => w.id === r.workout_id),
    }));
  res.end(
    JSON.stringify(
      (req.headers.accept || "").includes("vnd.pgrst.object+json")
        ? rows[0] || null
        : rows,
    ),
  );
});
(async () => {
  await new Promise((resolve) => mock.listen(54321, "127.0.0.1", resolve));
  fs.mkdirSync("artifacts/connected-review", { recursive: true });
  const log = fs.openSync("artifacts/connected-review/server.log", "w");
  const app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      ...(process.env.LAPIS_UI_DEV
        ? process.env.LAPIS_UI_DEV === "webpack"
          ? ["dev", "--webpack"]
          : ["dev"]
        : ["start"]),
      "-H",
      "127.0.0.1",
      "-p",
      "3100",
    ],
    {
      stdio: ["ignore", log, log],
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-ui-test-key",
        GEMINI_API_KEY: "",
        APP_URL: "http://127.0.0.1:3100",
        LAPIS_CONNECTIONS_KEY: "00".repeat(32),
        GOOGLE_CLIENT_ID: "test-client",
        GOOGLE_CLIENT_SECRET: "test-secret",
      },
    },
  );
  let browser;
  try {
    for (let i = 0; i < 150; i++) {
      try {
        const r = await fetch("http://127.0.0.1:3100/auth");
        if (r.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.LAPIS_CHROMIUM_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      timezoneId: "Europe/Stockholm",
    });
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"),
      token =
        enc({ alg: "HS256", typ: "JWT" }) +
        "." +
        enc({
          sub: uid,
          exp: Math.floor(Date.now() / 1000) + 3600,
          role: "authenticated",
        }) +
        ".fixture";
    await context.addCookies([
      {
        name: "sb-127-auth-token",
        value:
          "base64-" +
          enc({
            access_token: token,
            refresh_token: "test-refresh",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: "bearer",
            user,
          }),
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    const page = await context.newPage(),
      errors = [];
    page.on("response", async (response) => {
      if (response.url().includes("/api/imports/") && !response.ok())
        console.log(
          "Import response",
          response.status(),
          await response.text(),
        );
    });
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("Browser exception:", page.url(), e.message);
    });
    page.on("console", (m) => {
      if (
        m.type() === "error" &&
        /hydration|cannot be a descendant|cannot contain a nested/.test(
          m.text(),
        )
      )
        errors.push(m.text());
    });
    await page.route("**/api/ai-coach/**", (r) =>
      r.fulfill({ json: { status: "ok", suggestions: [] } }),
    );
    fs.mkdirSync("artifacts/connected-review", { recursive: true });
    const go = async (route, title) => {
      await page.goto("http://127.0.0.1:3100" + route);
      await page
        .getByRole("heading", { level: 1, name: title, exact: true })
        .waitFor()
        .catch(async (e) => {
          await page.screenshot({
            path: "artifacts/connected-review/failure.png",
            fullPage: true,
          });
          console.log((await page.locator("body").innerText()).slice(0, 1800));
          throw e;
        });
      await page.waitForLoadState("networkidle", { timeout: 20000 });
    };
    const fits = async (label) => {
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      );
      if (!fits) {
        console.log(
          await page.evaluate(() =>
            Array.from(document.querySelectorAll("body *"))
              .filter((e) => {
                const b = e.getBoundingClientRect();
                return (
                  b.right > innerWidth + 1 && !e.closest(".lapis-world-scroll")
                );
              })
              .slice(0, 15)
              .map((e) => ({
                tag: e.tagName,
                cls: e.className,
                width: e.getBoundingClientRect().width,
                text: e.textContent.slice(0, 60),
              })),
          ),
        );
        await page.screenshot({
          path: "artifacts/connected-review/overflow.png",
          fullPage: true,
        });
      }
      assert(fits, `${label}: horizontal overflow`);
      if (await page.getByRole("dialog").count()) {
        await page.waitForTimeout(150);
        const bounds = await page.getByRole("dialog").last().boundingBox();
        const viewport = page.viewportSize();
        assert(
          bounds &&
            bounds.x >= -1 &&
            bounds.y >= -1 &&
            bounds.x + bounds.width <= viewport.width + 1 &&
            bounds.y + bounds.height <= viewport.height + 1,
          `${label}: dialog leaves the viewport`,
        );
      }
    };
    for (const width of process.env.LAPIS_UI_SKIP_LAYOUT
      ? []
      : (process.env.LAPIS_UI_WIDTHS || "390,1440,320")
          .split(",")
          .map(Number)) {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 1000 : 844,
      });
      for (const [route, title] of [
        ["/dashboard", "Today"],
        ["/journey", "Your World"],
        ["/goals", "Goals"],
        [`/goals/${gid}`, "Ironman"],
        ["/plan", "Plan"],
        ["/settings/world", "Your World"],
        ["/gym", "Training"],
        ["/gym/progress/races", "Races"],
        [`/gym/progress/races/${rid}`, "Ironman"],
        ["/nutrition", "Nutrition"],
        ["/profile", "Lucas"],
        ["/settings/connections", "Connections & imports"],
      ]) {
        await go(route, title);
        if (route === "/dashboard")
          await page.getByText("1 of 2 planned sessions complete").waitFor();
        if (route === "/journey")
          await page.locator(".lapis-destination").first().waitFor();
        if (route === "/journey")
          assert(
            (await page.locator(".living-world").boundingBox()).height > 400,
            "World CSS must load",
          );
        await fits(`${width} ${route}`);
        if (width !== 320)
          await page.screenshot({
            path: `artifacts/connected-review/${width}-${route.slice(1).replaceAll("/", "-")}.png`,
            fullPage: true,
          });
      }
      console.log(`${width}px: primary screens rendered without overflow`);
    }
    if (!process.env.LAPIS_UI_LAYOUT_ONLY) {
      await require("./verify-focus-flow.cjs")({
        page,
        go,
        fits,
        gid,
        rid,
        today,
        shift,
      });
      if (process.env.LAPIS_UI_FLOW_ONLY) {
        assert.deepEqual(errors, []);
        return;
      }
    }
    if (process.env.LAPIS_UI_LAYOUT_ONLY) {
      assert.deepEqual(errors, []);
      console.log("Layout and hydration checks passed.");
      return;
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await go("/journey", "Your World");
    await page.getByRole("button", { name: "Horizon", exact: true }).click();
    assert.equal(await page.locator(".lapis-destination").count(), 1);
    await page.locator(".lapis-destination").click();
    await page
      .getByRole("heading", { name: "Everest summit", level: 1, exact: true })
      .waitFor();
    await fits("mobile goal ascent");
    await page.getByRole("link", { name: "Edit destination" }).click();
    await page.getByLabel("Where this fits right now").selectOption("focus");
    await page
      .getByRole("button", { name: "Update Goal", exact: true })
      .click();
    await page.waitForURL(
      (url) => url.pathname === `/goals/${fixtures.goals[2].id}`,
    );
    assert.equal(fixtures.goals[2].attention, "focus");
    await go("/journey?focus=all", "Your World");
    await page.reload();
    await page.locator(".lapis-destination").first().waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "All", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await require("./verify-living-world-flows.cjs")({
      page,
      go,
      fits,
      fixtures,
      gid,
      today,
      assert,
    });
    if (process.env.LAPIS_UI_WORLD_ONLY) {
      assert.deepEqual(errors, []);
      console.log("Living World flow checks passed.");
      return;
    }
    await go("/plan?date=" + shift(today, 1) + "&view=week", "Plan");
    await page.reload();
    await page
      .getByRole("heading", { name: "Plan", level: 1, exact: true })
      .waitFor();
    assert(page.url().includes("view=week"));
    await go("/gym/library", "Library");
    assert.equal(
      await page
        .locator(
          'nav[aria-label="Main navigation"]:visible a[aria-current="page"]',
        )
        .innerText(),
      "Training",
    );
    await page.getByRole("button", { name: "Search app", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Search destinations" })
      .fill("Everest");
    await page
      .getByRole("navigation", { name: "Search results" })
      .getByRole("link", { name: /Everest/ })
      .waitFor();
    await page.keyboard.press("Escape");
    assert(
      (await page.locator('nav[aria-label="Tools"] img').count()) > 0,
      "profile avatar is shown in navigation",
    );
    await page.goto("http://127.0.0.1:3100/nutrition?log=1");
    await page.getByRole("dialog").waitFor();
    await fits("nutrition log sheet");
    await page.keyboard.press("Escape");
    console.log(
      "Navigation, goal ascent, profile avatar and direct nutrition logging passed.",
    );
    await go("/settings/connections", "Connections & imports");
    await page.getByLabel("Source", { exact: true }).selectOption("csv");
    await page
      .getByRole("textbox", { name: "Text to review" })
      .fill(
        `id,date,type,title,distance_km,duration_minutes,note\nrun-1,${today},run,Evening run,5,30,Easy`,
      );
    await page
      .getByRole("button", { name: "Preview import", exact: true })
      .click();
    await page.getByRole("heading", { name: "1 item to review" }).waitFor();
    assert.equal(fixtures.import_receipts.length, 0, "preview must not save");
    await page
      .getByRole("button", { name: "Import 1 item", exact: true })
      .click();
    await page.getByRole("link", { name: /Imported · Open/ }).waitFor();
    assert.equal(fixtures.import_receipts.length, 1);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page
      .getByRole("button", { name: "Preview import", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Import 1 item", exact: true })
      .click();
    await page.getByRole("link", { name: /Already imported · Open/ }).waitFor();
    assert.equal(fixtures.import_receipts.length, 1);
    const badOrigin = await context.request.post(
      "http://127.0.0.1:3100/api/imports/apply",
      { headers: { origin: "https://other.example" }, data: { items: [] } },
    );
    assert.equal(badOrigin.status(), 403);
    const oauth = await context.request.post(
      "http://127.0.0.1:3100/api/connections/gmail/start",
      { headers: { origin: "http://127.0.0.1:3100" } },
    );
    assert.equal(oauth.status(), 200);
    const authorization = new URL((await oauth.json()).url);
    assert.equal(authorization.hostname, "accounts.google.com");
    assert.equal(
      authorization.searchParams.get("code_challenge_method"),
      "S256",
    );
    const denied = await context.request.get(
      "http://127.0.0.1:3100/api/connections/gmail/callback?state=invalid&code=test",
      { maxRedirects: 0 },
    );
    assert.equal(denied.status(), 307);
    assert(denied.headers().location.includes("connection=failed"));
    assert.equal(fixtures.integration_connections.length, 0);
    console.log(
      "Reviewed imports, duplicate prevention and OAuth guards passed.",
    );
    // Exercise the actual plan review UI; the expensive AI generator alone is stubbed.
    await page.route("**/api/ai-coach/race-plan", (r) =>
      r.fulfill({
        json: {
          status: "ok",
          previewId: randomUUID(),
          plan: {
            approach: "balanced",
            overview: "Future weeks adjusted.",
            weeks: fixtures.race_training_plans[0].weeks,
            phaseTemplates: { base: template, build: template },
          },
        },
      }),
    );
    await go(`/gym/progress/races/${rid}?tab=plan`, "Ironman");
    await page
      .getByRole("button", { name: "Regenerate Plan", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Regenerate Plan", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Review plan changes", exact: true })
      .waitFor();
    assert.equal(previewApplies, 0);
    await page.getByRole("button", { name: "Apply plan", exact: true }).click();
    await page.getByRole("button", { name: "Overview", exact: true }).waitFor();
    assert.equal(previewApplies, 1);
    // Starting the remaining swim returns one workout; repeating the API is idempotent.
    await go("/dashboard", "Today");
    await page
      .getByRole("button", { name: "Start session", exact: true })
      .click();
    await page.waitForURL("**/gym/workouts/*");
    const swimId = page.url().split("/").pop();
    assert.equal(fixtures.workouts.length, 2);
    await go("/plan", "Plan");
    await page.locator(".lapis-resume").waitFor();
    assert(
      (await page.locator(".lapis-resume").getAttribute("href")).endsWith(
        swimId,
      ),
    );
    await page.locator(".lapis-resume").click();
    await page.waitForURL((url) => url.pathname === `/gym/workouts/${swimId}`);
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/plan");
    assert(
      fixtures.workouts.find((w) => w.id === swimId).completed_at,
      "Session completion must save before returning to Plan",
    );
    // Restore a failed strength-set save after a real browser reload.
    fixtures.workouts[0].completed_at = null;
    fixtures.workouts[1].completed_at = new Date().toISOString();
    await go(`/gym/workouts/${wid}`, "Upper body");
    await page
      .getByRole("button", { name: /Bench press/ })
      .first()
      .click();
    const weight = page.getByLabel(/Weight/).first(),
      reps = page.getByLabel("Reps", { exact: true }).first();
    await weight.fill("60");
    await reps.fill("8");
    await page
      .getByText("Draft saved on this device.", { exact: false })
      .waitFor();
    failSets = true;
    await page.getByRole("button", { name: /Save Set/ }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: /Could not save/ })
      .waitFor();
    await page.reload();
    await page
      .getByRole("button", { name: /Bench press/ })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Restore draft", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Reps", { exact: true }).first().inputValue(),
      "8",
    );
    failSets = false;
    await page.getByRole("button", { name: /Save Set/ }).click();
    await page.waitForTimeout(250);
    assert.equal(fixtures.sets.length, 1);
    console.log("Plan review, session start/resume and draft recovery passed.");
    await go("/gym", "Training");
    await page.locator(".lapis-resume").click();
    await page.waitForURL((url) => url.pathname === `/gym/workouts/${wid}`);
    await page.getByRole("button", { name: "Complete", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/gym");
    assert(
      fixtures.workouts.every((w) => w.completed_at),
      "Training must return to the completed state after a real save",
    );
    await go("/dashboard", "Today");
    await page
      .getByRole("heading", { name: "Session complete", exact: true })
      .waitFor();
    await page
      .locator('.training-hero img[src="/images/world/dumbbells.webp"]')
      .waitFor();
    await fits("completed training hero");
    await page.screenshot({
      path: "artifacts/connected-review/390-training-complete.png",
      fullPage: true,
    });
    await page
      .locator('nav[aria-label="Main navigation"] a[href="/gym"]:visible')
      .click();
    await page
      .getByRole("heading", { name: "Training", level: 1, exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Session complete", exact: true })
      .waitFor();
    await page
      .locator('.training-hero img[src="/images/world/dumbbells.webp"]')
      .waitFor();
    await fits("completed hero on Training");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "artifacts/connected-review/1440-training-complete.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    mode = "empty";
    await go("/journey", "Your World");
    await page.getByText("Your world starts here.", { exact: true }).waitFor();
    mode = "error";
    await go("/journey", "Your World");
    await page
      .getByRole("alert")
      .filter({ hasText: "Your world could not load" })
      .waitFor();
    assert.deepEqual(errors, [], `Browser errors: ${errors.join("\n")}`);
    console.log(
      "Connected UI: navigation, destination editing, imports, OAuth guards, plan review, session start, recovery, empty/error states passed.",
    );
  } catch (error) {
    const failedPage = browser?.contexts()[0]?.pages()[0];
    if (failedPage) {
      console.log((await failedPage.locator("body").innerText()).slice(-6500));
      await failedPage.screenshot({
        path: "artifacts/connected-review/action-failure.png",
        fullPage: true,
      });
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    app.kill("SIGTERM");
    await new Promise((resolve) => mock.close(resolve));
    fs.closeSync(log);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
