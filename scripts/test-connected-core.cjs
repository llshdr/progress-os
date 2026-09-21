/* Pure domain checks; no network, credentials, or database required. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name === "server-only") return __filename;
  if (name.startsWith("@/"))
    name = path.join(process.cwd(), "src", name.slice(2));
  return originalResolve.call(this, name, parent, ...rest);
};
require.extensions[".ts"] = (m, filename) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
const {
  buildDaySessions,
  connectSessions,
} = require("../src/lib/daily-plan.ts");
const {
  preserveStartedWeeks,
} = require("../src/lib/race-plan/preserve-weeks.ts");
const { slotsForWeek } = require("../src/lib/race-plan/day-template.ts");
const { buildTimedItemsForDate } = require("../src/lib/calendar.ts");
const {
  parseCalendar,
  parseWorkoutCsv,
  sourceHash,
} = require("../src/lib/imports/parsers.ts");
const { validateImport, validDate } = require("../src/lib/imports/types.ts");
const { trainingActuals } = require("../src/lib/training-actuals.ts");
const {worldLevel,goalProgress}=require('../src/lib/world-progress.ts');
assert.deepEqual(worldLevel(-30),{level:1,earned:0,next:300});
assert.deepEqual(worldLevel(600),{level:3,earned:0,next:300});
assert.equal(worldLevel(NaN).level,1);
assert.equal(goalProgress({status:'active',milestones:[]}).ascent,0,'no made-up goal completion');
assert.equal(goalProgress({status:'done',milestones:[]}).ascent,1,'a goal can be reached without a milestone plan');
const climb=goalProgress({status:'active',milestones:[{id:'1',title:'First',status:'done',next_action:null},{id:'2',title:'Next',status:'active',next_action:'Try it'},{id:'3',title:'Removed',status:'archived',next_action:null}]});
assert.equal(climb.total,2);assert.equal(climb.ascent,.44);assert.equal(climb.next.id,'2');
assert.equal(goalProgress({status:'active',milestones:[{id:'1',title:'Only',status:'done',next_action:null}]}).ascent,.88,'summit awaits explicit goal completion');
const {
  seal,
  unseal,
  equalState,
} = require("../src/lib/connections/crypto.ts");
const race = {
  id: "race",
  race_type: "ironman",
  race_date: "2026-10-04",
  location: "Barcelona",
  training_start_date: "2026-09-01",
  target_finish_seconds: null,
};
const template = {
  enduranceSlots: [
    {
      day: 0,
      type: "swim",
      role: "technique",
      shareOfWeeklyTotal: 1,
      progression: null,
      time: "06:00",
    },
  ],
  strengthSlots: [{ day: 0, focus: "upper", time: "17:00" }],
  brickDays: [],
  dayCapacityWarning: null,
};
const week = {
  weekStartDate: "2026-09-21",
  phase: "base",
  isAcclimation: false,
  isSimulationWeek: false,
  disciplines: {
    swim: { sessions: 1, km: 2 },
    bike: { sessions: 0, km: 0 },
    run: { sessions: 0, km: 0 },
  },
  brickSessions: 0,
  targetCardioKm: 2,
  targetCardioSessions: 1,
  targetStrengthSessions: 1,
  combinedBikeLoad: null,
};
const gym = {
  id: "gym",
  templateId: "upper",
  templateName: "Upper body",
  label: null,
  slotOrder: 0,
  usualTime: "18:00",
};
const plan = { weeks: [week], phase_templates: { base: template } };
const sessions = buildDaySessions("2026-09-21", race, plan, gym);
assert.equal(
  sessions.length,
  2,
  "race strength and the gym routine must not duplicate",
);
assert.equal(sessions[0].kind, "swim");
assert.equal(sessions[0].km, 2);
assert.equal(sessions[1].templateId, "upper");
assert.equal(sessions[1].time, "17:00");
const completed = {
  id: "workout",
  date: "2026-09-21",
  completed_at: "2026-09-21T10:00:00Z",
  workout_type: "Upper",
  template_id: "upper",
  schedule_slot_id: "gym",
  planned_session_key: sessions[1].key,
};
const linked = connectSessions(sessions, [completed]);
assert.equal(
  linked.sessions.filter((s) => s.completed).length,
  1,
  "one workout cannot complete both planned sessions",
);
assert.equal(linked.sessions[0].completed, undefined);
assert.equal(
  connectSessions(sessions, [
    { ...completed, planned_session_key: null, schedule_slot_id: null },
  ]).unlinked.length,
  1,
  "an unrelated same-day workout stays unlinked",
);
assert.equal(
  connectSessions(sessions, [{ ...completed, planned_session_key: null }])
    .sessions[1].workoutId,
  "workout",
  "legacy exact schedule-slot links work",
);
assert.deepEqual(
  buildDaySessions(race.race_date, race, plan, gym),
  [],
  "race day is not a training day",
);
assert.equal(buildDaySessions("2026-09-22", race, plan, null).length, 0);
const timed = buildTimedItemsForDate({
  date: "2026-09-21",
  calendarEntries: [],
  goalItems: [],
  activeRace: null,
  scheduleMode: "calendar",
  scheduleSlots: [gym],
  raceWeekSlots: null,
  habits: [],
  habitLogs: [],
  training: { race, plan, rotationSlot: null },
});
assert.deepEqual(
  timed.map((i) => i.id),
  sessions.map((s) => s.key),
  "Plan and Today use identical session identities",
);
const changedTemplate = {
  ...template,
  strengthSlots: [{ day: 2, focus: "lower" }],
};
const nextWeek = {
  ...week,
  weekStartDate: "2026-09-28",
  targetStrengthSessions: 2,
};
const preserved = preserveStartedWeeks(
  [week, nextWeek],
  [
    { ...week, targetStrengthSessions: 4 },
    { ...nextWeek, targetStrengthSessions: 3 },
  ],
  { base: template },
  "2026-09-21",
);
assert.equal(preserved[0].targetStrengthSessions, 1);
assert.equal(preserved[1].targetStrengthSessions, 3);
assert.equal(
  slotsForWeek(changedTemplate, preserved[0]).strengthSlots[0].day,
  0,
  "new phase templates cannot move the current week",
);
assert.equal(preserved[0].progressionIndex, 0);
const ics =
  "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:flight-1\r\nSUMMARY:Race trip\r\nDTSTART;VALUE=DATE:20261002\r\nDTEND;VALUE=DATE:20261005\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:swim-1\r\nSUMMARY:Pool\\, lane 3\r\nDTSTART:20260921T060000Z\r\nDTEND:20260921T070000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
const events = parseCalendar(ics, "Europe/Stockholm");
assert.equal(
  events[0].endDate,
  "2026-10-04",
  "ICS all-day end dates are exclusive",
);
assert.equal(
  events[1].time,
  "08:00",
  "UTC events convert to the reviewing timezone",
);
assert.equal(events[1].title, "Pool, lane 3");
assert.equal(
  events[1].sourceKey,
  parseCalendar(ics, "Europe/Stockholm")[1].sourceKey,
);
const zoned = parseCalendar(
  "BEGIN:VEVENT\nUID:x\nDTSTART;TZID=America/New_York:20260921T080000\nDTEND;TZID=America/New_York:20260921T090000\nEND:VEVENT",
  "Europe/Stockholm",
);
assert.equal(
  zoned[0].time,
  "14:00",
  "named source timezones convert correctly",
);
assert.throws(
  () => parseCalendar("BEGIN:VEVENT\nDTSTART:20260230\nEND:VEVENT", "UTC"),
  /invalid date/,
);
assert.throws(
  () =>
    parseCalendar(
      "BEGIN:VEVENT\nDTSTART;TZID=America/New_York:20260308T023000\nEND:VEVENT",
      "UTC",
    ),
  /daylight-saving/,
);
assert.equal(validDate("2026-02-30"), false);
const csv = parseWorkoutCsv(
  'id,date,type,title,distance_km,duration_minutes,note\n1,2026-09-21,swim,"Pool, easy",1.5,35,"Lane 2"\n2,2026-09-22,run,Run,5,30,',
);
assert.equal(csv[0].title, "Pool, easy");
assert.equal(csv[0].durationSeconds, 2100);
assert.equal(csv[1].discipline, "running");
assert.equal(validateImport(csv[0]), null);
assert.match(validateImport({ ...csv[0], distanceKm: -1 }), /distance/);
assert.match(
  validateImport({ ...events[0], kind: "expense", amount: 200 }),
  /race/,
);
assert.match(
  validateImport({
    ...events[0],
    kind: "expense",
    amount: 200,
    raceId: "11111111-1111-4111-8111-111111111111",
  }),
  /currency/,
);
assert.match(
  validateImport({
    ...events[0],
    kind: "calendar",
    time: "20:00",
    endTime: "19:00",
    endDate: events[0].date,
  }),
  /End time/,
);
assert.equal(sourceHash("one"), sourceHash("one"));
assert.deepEqual(
  trainingActuals([
    {
      exercises: [
        {
          exercise_library: { exercise_type: "cardio", cardio_type: "running" },
          cardio_logs: { distance_km: "5", source: "training" },
        },
        {
          exercise_library: [
            { exercise_type: "cardio", cardio_type: "cycling" },
          ],
          cardio_logs: [{ distance_km: 10, source: "commute" }],
        },
        { exercise_library: { exercise_type: "strength" } },
        { exercise_library: { exercise_type: "strength" } },
      ],
    },
  ]),
  { swim: 0, bike: 0, run: 5, cardio: 5, strength: 1 },
  "weekly totals handle object and array joins, exclude commuting, and count strength once",
);
process.env.LAPIS_CONNECTIONS_KEY = "00".repeat(32); // Test-only key, never saved to app configuration.
const encrypted = seal({ access_token: "test-only" }, "account:a:gmail");
assert.equal(unseal(encrypted, "account:a:gmail").access_token, "test-only");
assert.throws(
  () => unseal(encrypted, "account:b:gmail"),
  "token ciphertext is bound to its account and provider",
);
assert.throws(() => unseal(encrypted.slice(0, -3) + "xyz", "account:a:gmail"));
assert.equal(equalState("abc", "abc"), true);
assert.equal(equalState("abc", "abcd"), false);
assert.equal(equalState("abc", "abd"), false);
console.log(
  "Connected core: checks passed (sessions, calendar, preserved plans, imports, encryption).",
);

const { isSameOrigin } = require("../src/lib/request-origin.ts");
const originRequest = (origin, extra = {}) =>
  new Request("http://localhost:3100/api/imports/apply", {
    headers: {
      host: "lapis.example",
      "x-forwarded-proto": "https",
      ...(origin ? { origin } : {}),
      ...extra,
    },
  });
assert.equal(isSameOrigin(originRequest("https://lapis.example")), true);
assert.equal(isSameOrigin(originRequest("https://other.example")), false);
assert.equal(isSameOrigin(originRequest("http://lapis.example")), false);
assert.equal(isSameOrigin(originRequest(null)), false);
assert.equal(
  isSameOrigin(
    originRequest("https://other.example", {
      "x-forwarded-host": "other.example",
    }),
  ),
  false,
);
console.log(
  "Request origin: public host accepted; cross-site and missing origins rejected.",
);
