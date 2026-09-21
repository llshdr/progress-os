/* Used by verify-connected-ui.cjs with isolated fixtures only. */
module.exports = async ({ page, go, fits, fixtures, gid, today, assert }) => {
  await go(`/goals/${gid}`, "Ironman");
  const scene = page.locator(".ascent-scene");
  const initial = Number(await scene.getAttribute("data-ascent"));
  await page
    .getByRole("button", {
      name: "Complete milestone: First open-water session",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Reopen milestone: First open-water session",
      exact: true,
    })
    .waitFor();
  assert(
    Number(await scene.getAttribute("data-ascent")) > initial,
    "a saved milestone moves the climber",
  );
  await page
    .getByRole("button", {
      name: "Reopen milestone: First open-water session",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Complete milestone: First open-water session",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Make time for it", exact: true })
    .click();
  await page
    .getByLabel("What will you do?", { exact: true })
    .fill("Prepare open-water kit");
  await page.getByLabel("Date", { exact: true }).fill(today);
  await fits("goal step dialog");
  await page.getByRole("button", { name: "Add to Plan", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const entry = fixtures.calendar_entries.find(
    (e) => e.title === "Prepare open-water kit",
  );
  assert(entry && entry.goal_id === gid, "goal steps retain their destination");
  await go("/plan?date=" + today, "Plan");
  await page
    .getByRole("button", {
      name: "Complete Prepare open-water kit",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Undo Prepare open-water kit", exact: true })
    .waitFor();
  assert.equal(
    fixtures.goal_checkins.filter((c) => c.calendar_entry_id === entry.id)
      .length,
    1,
  );
  await page
    .getByRole("button", { name: "Read for ten minutes", exact: false })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector('button[aria-pressed="true"]')?.textContent !==
      null,
  );
  await page.waitForLoadState("networkidle");
  assert.equal(fixtures.habit_logs.length, 1);
  await page.screenshot({
    path: "artifacts/connected-review/390-plan-connected.png",
    fullPage: true,
  });
  await go(`/goals/${gid}?view=journal`, "Ironman");
  await page
    .getByText("Completed: Prepare open-water kit", { exact: true })
    .waitFor();
  await page
    .getByRole("button", {
      name: "Milestone: First open-water session",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Complete milestone: First open-water session",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "The route", exact: true })
      .getAttribute("aria-pressed"),
    "true",
    "a map pin opens the route from the journal",
  );
  await page.getByRole("button", { name: "Your journal", exact: true }).click();
  await page
    .getByLabel("What moved you forward?", { exact: true })
    .fill("The kit is ready. Next, choose a supervised session.");
  await page
    .getByRole("button", { name: "Save check-in", exact: true })
    .click();
  await page
    .getByText("The kit is ready. Next, choose a supervised session.", {
      exact: true,
    })
    .waitFor();
  await go("/plan?date=" + today, "Plan");
  await page
    .getByRole("button", { name: "Undo Prepare open-water kit", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Complete Prepare open-water kit",
      exact: true,
    })
    .waitFor();
  assert.equal(
    fixtures.goal_checkins.filter((c) => c.calendar_entry_id === entry.id)
      .length,
    0,
  );
  assert.equal(
    fixtures.goal_checkins.length,
    1,
    "undo keeps unrelated journal notes",
  );
  await go("/settings/world", "Your World");
  await page
    .getByLabel("Country or territory", { exact: true })
    .selectOption("NO");
  await page.getByRole("button", { name: "Save flag", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your flag is ready" })
    .waitFor();
  assert.equal(fixtures.user_settings[0].world_country, "NO");
  await go(`/goals/${gid}?view=route`, "Ironman");
  await page
    .getByRole("button", { name: "I’ve reached this goal", exact: true })
    .click();
  await fits("summit confirmation");
  await page
    .getByRole("button", { name: "Plant my flag", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A summit of your own.", exact: true })
    .waitFor();
  await fits("summit celebration");
  assert.equal(fixtures.goals[0].summit_country, "NO");
  await page
    .getByRole("button", { name: "Stay here for a moment", exact: true })
    .click();
  await page
    .locator('.ascent-summit img[src="/images/flags/NO.svg"]')
    .waitFor();
  await page.screenshot({
    path: "artifacts/connected-review/390-summit-reached.png",
    fullPage: true,
  });
  await go("/settings/world", "Your World");
  await page
    .getByLabel("Country or territory", { exact: true })
    .selectOption("SE");
  await page.getByRole("button", { name: "Save flag", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your flag is ready" })
    .waitFor();
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/rest/v1/goals?") && r.request().method() === "PATCH",
    ),
    page
      .getByLabel("Landscape for Ironman", { exact: true })
      .selectOption("trail"),
  ]);
  assert.equal(fixtures.goals[0].world_style, "trail");
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/rpc/arrange_world")),
    page
      .getByRole("button", { name: "Move Ironman right", exact: true })
      .click(),
  ]);
  assert.equal(fixtures.goals[0].world_slot, 1);
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/rest/v1/goals?") && r.request().method() === "PATCH",
    ),
    page
      .getByLabel("Landscape for Ironman", { exact: true })
      .selectOption("summit"),
  ]);
  await go(`/goals/${gid}`, "Ironman");
  await page
    .locator('.ascent-summit img[src="/images/flags/NO.svg"]')
    .waitFor();
  await page.getByRole("button", { name: "Reopen goal", exact: true }).click();
  await page
    .getByRole("button", { name: "Make time for it", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("/plan?date=" + today, "Plan");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await fits("desktop plan dialog");
  await page.keyboard.press("Escape");
  await go("/plan/calendar?date=" + today, "Calendar");
  await fits("detailed calendar remains available");
  await go("/goals/new", "New destination");
  await page.getByLabel("Title *", { exact: true }).fill("Build a studio");
  await page
    .getByRole("button", { name: "Choose basecamp landscape", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create destination", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Build a studio", level: 1, exact: true })
    .waitFor();
  assert(
    fixtures.goals.some(
      (g) => g.title === "Build a studio" && g.world_style === "basecamp",
    ),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  console.log(
    "New destinations keep their chosen landscape and open directly into the ascent.",
  );
  console.log(
    "Living World: ascent, milestone undo, Plan-to-journal, habit, saved flags, completion/reopening, arrangement and detailed calendar passed.",
  );
};
