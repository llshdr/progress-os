# LAPIS — a connected, personal World

Incremental update to the connected-world code at `66622f4`. Apply this on top of that update, with migrations 088–091 already installed. No production service or live database was changed while preparing it.

## Experience

- Today restores **Your training**, including the photographic dumbbell and **Session complete** state. Start, resume, view and link an already logged session still use the existing daily-session model. A swim and a strength session remain separate.
- **Plan** starts with a week strip and a readable day: events, goal steps, training and habits. Give a goal's next action a date directly from its ascent. Marking that step complete adds one journal check-in; undo removes that check-in only. The previous timeline, recurring events, habit editing and travel tools remain at `/plan/calendar`.
- **World and Goals share Journey**. There is no old target-icon Goals header. Goal cards and mountain markers open the same destination. Focus now, Horizon, Paused and Reached remain available.
- Each goal has its own high-resolution **ascent**, live profile marker, milestone route, journal and linked race/session access. Alpine summit, highland trail and mountain settlement are independent landscape assets. Goal editing, dependencies, AI ideas, milestone generation, archive and deletion remain accessible through Edit destination.
- **Your World settings** choose a country flag, scenery and mountain order. New goals create destinations; archived goals leave the active chain. The system is not tied to four particular goals.
- Completing a goal plants its flag and opens a celebration. The chosen flag and first completion time are saved. Reopening and completing again does not accumulate rewards or replace that flag. A LAPIS flag is available without choosing a country. Flags are local SVGs and work on Windows without flag emoji support.

## Progress rules

Personal World XP is derived from owned records on the server. There is no client balance to increment, and it is separate from public profile rank.

| Recorded action | World XP |
| --- | ---: |
| A day with completed training | 40 per day |
| A nutrition day | 10 per day |
| A sleep log | 10 per day |
| A habit log | 5 each, capped at 20 per day |
| Goal check-ins | 10 per goal/day, capped at 30 per day |
| A currently completed milestone | 50 |
| A currently completed goal | 150 |

Each level takes 300 XP. Light and foreground growth change as levels rise. Rest days do not subtract progress. Extra workout volume, food amounts or multiple logs of the same daily routine do not earn extra XP. Undoing/deleting a source removes its contribution; archiving a goal/milestone removes that completion contribution while retaining its records. Deleting a calendar entry preserves an already saved journal check-in; undo its completion first to remove that check-in as well.

A mountain's ascent follows its own completed milestones, reserving the final summit for explicit goal completion. Training/check-ins support the route without pretending to measure the percentage of an Ironman, Olympic selection or business outcome achieved. Existing completed records contribute to World XP. Old goals are not assigned fabricated completion dates; their flag uses the current choice until a completion is explicitly recorded with the new schema.

## Database

Run `supabase/migrations/092_living_world.sql` once after 091 through the project's normal migration workflow. It adds flag preferences, achievement snapshots, calendar-to-goal links, planned-step completion and owner-scoped RPCs. It does not seed goals or rewrite workout/nutrition records.

- `world_summary(timezone)` derives XP, recent contributions and linked-session/check-in counts under existing row-level security.
- `set_goal_step_done(entry, done, timezone)` locks the owned calendar row and writes/removes its check-in atomically. Repeated completion requests do not duplicate it. Future steps cannot be completed through this RPC.
- `arrange_world(ids)` validates the complete set of owned, non-archived destinations and saves their order together.
- Ownership triggers reject calendar/check-in links to another user's goal. Functions use security invoker; they do not bypass existing RLS.
- `summit_country = 'ZZ'` represents a snapshotted LAPIS flag. NULL represents a legacy completion without a snapshot.

No new environment variables or production dependencies are required. Without 092, World progress/settings and planned-step completion report errors; apply the migration before testing this update.

## Artwork

Five generated assets live in `public/images/world/`. The ascent scenes are 1024 × 1536, the transparent mountain layer is 1024 × 1536, and the training art is 1536 × 1024. WebP compression keeps the combined artwork around 2 MB. Art direction and generation prompts are recorded in `LAPIS-WORLD-ARTWORK.json`. Progress markers, controls and flags are live interface elements, not baked into those images.

Country SVGs are from `country-flag-icons` under its MIT license, included at `public/images/flags/LICENSE.txt`. Labels and ordering are fixed in source to avoid server/browser locale-data differences during hydration.

## Validation

Production build and TypeScript checking use isolated placeholder Supabase configuration. Targeted ESLint covers the new/rewritten World, Plan, ascent, settings, goal forms and shared components. Existing lint problems in older nutrition/sleep/calendar code are outside this update's lint gate.

`scripts/test-connected-core.cjs` also verifies world levels, archived milestones and the requirement to explicitly complete a summit. `scripts/test-living-world-db.cjs` applies the actual migration to an isolated PostgreSQL fixture with owner RLS: duplicate caps, retry/undo, foreign-owner rejection, future-date rejection, timestamps, country and LAPIS flag snapshots, reopening and arrangement.

The browser harness uses a mock Supabase server and synthetic data, never a real account. `scripts/verify-connected-ui.cjs` includes `verify-living-world-flows.cjs`: phone/desktop rendering, CSS dimensions, overflow, hydration, ascent progress and undo, goal-to-Plan-to-journal flow, habit logging, flag settings, completion/reopening, ordering, scenery, new destinations, detailed calendar access and the completed training hero. Existing import/OAuth guards, race-plan review, session start/resume and failed-set recovery checks remain.

Optional local commands:

```sh
node scripts/test-connected-core.cjs
# Requires test-only @electric-sql/pglite, or LAPIS_PGLITE_MODULE pointing to it:
node scripts/test-living-world-db.cjs
```

For browser tests, install Playwright locally and Chromium, build with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=local-ui-test-key`, then run `node scripts/verify-connected-ui.cjs`. Ports 3100 and 54321 must be free. `LAPIS_UI_DEV=1` uses Turbopack development mode; `LAPIS_UI_DEV=webpack` uses webpack. Screenshots go to git-ignored `artifacts/connected-review/`. Rebuild with your real environment before any deployment.

Real-account behavior, live migration application and a physical phone still need review in the user's environment. Automated viewport checks are not a claim of testing on a physical iPhone or Windows machine.
