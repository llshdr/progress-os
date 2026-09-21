const assert = require("node:assert/strict");
module.exports = async function verifyFocusFlow({
  page,
  go,
  fits,
  gid,
  rid,
  today,
  shift,
}) {
  const settled = async (path) => {
    await page.waitForURL((url) => url.pathname === path);
    await page.waitForLoadState("networkidle");
  };
  const idle = () => page.waitForLoadState("networkidle");
  const back = async () => {
    const before = page.url();
    await page.getByRole("link", { name: "Back", exact: true }).first().click();
    await page.waitForURL((url) => url.href !== before);
    await idle();
  };
  const path = () => new URL(page.url()).pathname;
  await go("/dashboard", "Today");
  assert.equal(
    await page.locator('main a[href^="/journey"]').count(),
    0,
    "Today has no World promotions",
  );
  const requests = [];
  const collect = (r) => {
    if (r.url().includes(":54321/")) requests.push(r.url());
  };
  page.on("request", collect);
  await page
    .locator('nav[aria-label="Main navigation"] a[href="/gym"]:visible')
    .click();
  await page
    .getByRole("heading", { name: "Training", exact: true, level: 1 })
    .waitFor();
  await page.locator(".training-hero").waitFor();
  await idle();
  assert.equal(await page.locator('main a[href^="/journey"]').count(), 0);
  await fits("Training hero");
  await page
    .locator('nav[aria-label="Main navigation"] a[href="/dashboard"]:visible')
    .click();
  await settled("/dashboard");
  page.off("request", collect);
  assert.equal(
    requests.length,
    0,
    `Today → Training → Today should reuse fresh shared data: ${requests.join(", ")}`,
  );
  console.log(
    "Warm Today → Training → Today: 0 repeated browser Supabase requests.",
  );

  // The caller survives a nested edit and a browser back/forward traversal.
  await page.locator(`main a[href="/goals/${gid}"]`).first().click();
  await settled(`/goals/${gid}`);
  await page.getByRole("link", { name: "Edit destination" }).click();
  await settled(`/goals/${gid}/edit`);
  await back();
  assert.equal(path(), `/goals/${gid}`);
  await back();
  assert.equal(path(), "/dashboard");
  await page.goForward();
  await idle();
  assert.equal(path(), `/goals/${gid}`);
  await back();
  assert.equal(path(), "/dashboard");

  const date = shift(today, 1);
  await go(`/plan?date=${date}`, "Plan");
  // Plan's goal link must return to the chosen date and scroll position.
  await page
    .locator(`main a[href="/goals/${gid}"]`)
    .first()
    .scrollIntoViewIfNeeded();
  const planScroll = await page.evaluate(() => scrollY);
  await page.locator(`main a[href="/goals/${gid}"]`).first().click();
  await settled(`/goals/${gid}`);
  await back();
  assert.equal(path(), "/plan");
  assert.equal(new URL(page.url()).searchParams.get("date"), date);
  assert(
    Math.abs((await page.evaluate(() => scrollY)) - planScroll) < 40,
    "Plan return should preserve scroll position",
  );

  await go("/dashboard", "Today");
  await page
    .locator(`main a[href="/gym/progress/races/${rid}"]`)
    .first()
    .click();
  await settled(`/gym/progress/races/${rid}`);
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await idle();
  const selectedDay = new URL(page.url()).searchParams.get("day");
  await page.getByRole("button", { name: "Race day", exact: true }).click();
  await idle();
  await page.getByRole("link", { name: "Budget", exact: true }).click();
  await settled(`/gym/progress/races/${rid}/budget`);
  await back();
  assert.equal(path(), `/gym/progress/races/${rid}`);
  assert.equal(new URL(page.url()).searchParams.get("tab"), "prep");
  assert.equal(new URL(page.url()).searchParams.get("day"), selectedDay);
  await back();
  assert.equal(path(), "/dashboard");

  // Reloading a detail preserves its caller. A direct entry has a safe fallback.
  await page.locator(`main a[href="/goals/${gid}"]`).first().click();
  await settled(`/goals/${gid}`);
  await page.waitForURL((url) => url.pathname === `/goals/${gid}`);
  await page.reload();
  await idle();
  await back();
  assert.equal(path(), "/dashboard");
  await go(`/goals/${gid}`, "Ironman");
  await back();
  assert.equal(path(), "/goals");
  await go("/profile", "Lucas");
  assert.equal(
    await page
      .getByText(/Rank & consistency|Tier [IV]+|Rank Breakdown/)
      .count(),
    0,
  );
  await page.getByRole("region", { name: "Your level", exact: true }).waitFor();
  await fits("Unified profile level");
  console.log(
    "Caller return paths, query preservation, browser history, reload, direct entry and single Level passed.",
  );
};
