/* Local UI integration test. Uses an isolated mock auth/database server;
   never connects to a live Supabase project. Run after a build configured with
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 and
   NEXT_PUBLIC_SUPABASE_ANON_KEY=local-ui-test-key. Requires Playwright. */
const http = require("node:http");
const { spawn } = require("node:child_process");
const { mkdirSync } = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
process.env.NO_PROXY = "127.0.0.1,localhost";
process.env.no_proxy = "127.0.0.1,localhost";
const uid = "11111111-1111-4111-8111-111111111111";
const goalId = "22222222-2222-4222-8222-222222222222";
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "ui-test@example.test",
  app_metadata: { provider: "email" },
  user_metadata: { full_name: "Lucas" },
  created_at: "2026-01-01T00:00:00Z",
};
const today = new Date().toISOString().slice(0, 10);
const baseGoal = {
  id: goalId,
  user_id: uid,
  title: "Ironman",
  next_action: "Plan the next swim",
  scope: "long_term",
  world_style: "summit",
  status: "active",
  target_date: "2027-10-03",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};
let mode = "normal";
const fixtures = {
  profiles: [{ id: uid, full_name: "Lucas" }],
  user_roles: [{ user_id: uid, role: "owner" }],
  user_settings: [
    {
      user_id: uid,
      weekly_workout_goal: 5,
      schedule_mode: "calendar",
      count_cardio_toward_workout_goal: true,
      show_today_suggestions: true,
    },
  ],
  goals: [
    baseGoal,
    {
      ...baseGoal,
      id: "33333333-3333-4333-8333-333333333333",
      title: "Build LAPIS",
      next_action: "Finish the onboarding flow",
      scope: "milestone",
      world_style: "basecamp",
    },
  ],
  workouts: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      user_id: uid,
      date: today,
      started_at: today + "T07:00:00Z",
      completed_at: today + "T08:00:00Z",
      workout_type: "Upper body",
      template_id: null,
      schedule_slot_id: null,
      workout_templates: null,
    },
  ],
  workout_schedule_slots: [],
  races: [],
  milestones: [],
  dismissed_suggestions: [],
  workout_goal_links: [],
};
const mock = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const url = new URL(req.url, "http://127.0.0.1");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/auth/v1/user") return res.end(JSON.stringify(user));
  if (url.pathname.startsWith("/auth/"))
    return res.end(JSON.stringify({ user }));
  const table = url.pathname.split("/").pop();
  if (mode === "error" && ["goals", "workouts"].includes(table)) {
    res.writeHead(500);
    return res.end(JSON.stringify({ message: "Fixture failure" }));
  }
  let rows =
    mode === "empty" && ["goals", "workouts"].includes(table)
      ? []
      : [...(fixtures[table] || [])];
  for (const [key, value] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
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
  }
  if (url.searchParams.has("limit"))
    rows = rows.slice(0, Number(url.searchParams.get("limit")));
  res.setHeader(
    "Content-Range",
    `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
  );
  if (req.method === "HEAD") return res.end();
  if (req.method === "PATCH" || req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body || "{}");
    if (table === "goals" && req.method === "PATCH") {
      for (const row of rows) Object.assign(row, input);
    }
    if (table === "workout_goal_links" && req.method === "POST")
      fixtures.workout_goal_links.push({
        ...input,
        created_at: new Date().toISOString(),
      });
    return res.end(JSON.stringify(rows));
  }
  if (table === "workout_goal_links" && req.method === "DELETE") {
    fixtures.workout_goal_links = fixtures.workout_goal_links.filter(
      (r) => !rows.includes(r),
    );
    return res.end(JSON.stringify({}));
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
  const app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      "3100",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-ui-test-key",
      },
    },
  );
  let browser;
  try {
    console.log("Waiting for local test app");
    for (let i = 0; i < 100; i++) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get("http://127.0.0.1:3100/auth", (res) => {
            res.resume();
            resolve();
          });
          req.on("error", reject);
          req.setTimeout(2000, () => req.destroy(new Error("timeout")));
        });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    console.log("Launching browser");
    const bundled = process.env.LAPIS_CHROMIUM_BUNDLE
      ? (await import(process.env.LAPIS_CHROMIUM_BUNDLE)).default
      : null;
    browser = await chromium.launch(
      bundled
        ? {
            headless: true,
            executablePath: await bundled.executablePath(),
            args: bundled.args,
          }
        : { headless: true, args: ["--no-sandbox"] },
    );
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const token =
      enc({ alg: "HS256", typ: "JWT" }) +
      "." +
      enc({
        sub: uid,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
      }) +
      ".fixture";
    const session = {
      access_token: token,
      refresh_token: "test-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: "bearer",
      user,
    };
    await context.addCookies([
      {
        name: "sb-127-auth-token",
        value: "base64-" + enc(session),
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/ai-coach/today", (r) =>
      r.fulfill({ json: { status: "ok", suggestions: [] } }),
    );
    mkdirSync("artifacts/ui-review", { recursive: true });
    for (const [route, title] of [
      ["dashboard", "Today"],
      ["gym", "Training"],
      ["journey", "Journey"],
      ["gym/library", "Library"],
      ["gym/progress", "Progress"],
      ["settings", "Settings"],
      ["coach", "Coach"],
    ]) {
      await page.goto("http://127.0.0.1:3100/" + route);
      await page
        .getByRole("heading", { name: title, exact: true, level: 1 })
        .waitFor();
      if (route === "dashboard")
        await page.getByText("Session complete", { exact: true }).waitFor();
      if (route === "journey")
        await page.getByText("2 active destinations").waitFor();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route}: mobile overflow`,
      );
      await page.screenshot({
        path: "artifacts/ui-review/" + route.replaceAll("/", "-") + ".png",
        fullPage: true,
      });
    }
    await page.goto("http://127.0.0.1:3100/gym/library");
    assert.equal(
      await page
        .locator(
          'nav[aria-label="Main navigation"]:visible a[aria-current="page"]',
        )
        .innerText(),
      "Training",
    );
    await page.goto("http://127.0.0.1:3100/dashboard");
    await page.getByText("Quick log", { exact: true }).click();
    await page.getByRole("link", { name: "Meal", exact: true }).waitFor();
    await page.goto("http://127.0.0.1:3100/journey");
    await page.getByRole("button", { name: "Basecamp", exact: true }).click();
    await page.getByRole("heading", { name: "Build LAPIS" }).waitFor();
    assert.equal(
      await page.getByRole("heading", { name: "Ironman", exact: true }).count(),
      0,
    );
    await page.goto("http://127.0.0.1:3100/goals/" + goalId);
    await page.getByRole("heading", { name: "Ironman", exact: true }).waitFor();
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await page.getByLabel("Place in your world").selectOption("trail");
    await page
      .getByRole("button", { name: "Update Goal", exact: true })
      .click();
    await page.waitForURL("**/goals");
    assert.equal(fixtures.goals[0].world_style, "trail");
    assert.equal(fixtures.goals[0].scope, "long_term");
    await page.goto(
      "http://127.0.0.1:3100/gym/workouts/" + fixtures.workouts[0].id,
    );
    await page.getByRole("button", { name: "Ironman", exact: true }).click();
    await page
      .getByRole("link", { name: "Open Ironman", exact: false })
      .waitFor();
    await page
      .getByRole("button", { name: "Build LAPIS", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Open Build LAPIS", exact: false })
      .waitFor();
    assert.equal(fixtures.workout_goal_links.length, 2);
    assert.equal(fixtures.workouts.length, 1);
    await page.goto("http://127.0.0.1:3100/goals/" + goalId);
    await page
      .getByRole("heading", { name: "Sessions along the way" })
      .waitFor();
    await page.getByRole("link", { name: /Upper body/ }).waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:3100/dashboard");
    await page.getByText("Session complete", { exact: true }).waitFor();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: "artifacts/ui-review/desktop-today.png",
      fullPage: true,
    });
    mode = "empty";
    await page.goto("http://127.0.0.1:3100/journey");
    await page.getByText("Your next chapter starts here.").waitFor();
    mode = "error";
    await page.goto("http://127.0.0.1:3100/gym");
    await page
      .getByText(
        "Couldn't load your training. Your library and logs are still accessible below.",
      )
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: 7 mobile screens, desktop Today, nested navigation, quick log, world filtering, appearance persistence, multi-goal workout links, goal detail, empty and error states; no page errors or horizontal overflow.",
    );
  } finally {
    if (browser) await browser.close();
    app.kill();
    mock.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
