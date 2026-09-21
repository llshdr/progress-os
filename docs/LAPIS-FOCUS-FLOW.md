# LAPIS — focus and flow

Incremental update to the Living World version at `b405068790a5848de612570c6cf6ba4395de6302`.

## Product changes

- Today prioritizes training, concrete goal steps and quick logging. The World preview is removed.
- Training uses the same full session hero as Today, including the dumbbell artwork and Session complete state. A completed strength session never hides an unfinished swim, bike or run.
- Goals is the primary navigation destination. World remains available inside it. Training, Plan and the training hero no longer advertise World.
- Profile and World show one personal Level using the existing XP calculation. Old public rank tiers, rank history and rank-based ordering are removed from the UI. No private XP or activity is added to public profiles. Existing database rank fields/history are retained for compatibility, not relabeled as levels or erased.
- Race cards and details share a clearer race identity, countdown and discipline distances. Overview puts the selected week's sessions beside volume and preparation. The date stays in the URL, and Budget is reachable from every race tab. Upcoming and past races have separate list views; a past date is not described as a completed finish without a result.
- World and staircase screens receive limited refinements: a clearer next milestone, keyboard/hover labels and useful return navigation. Artwork and goal completion semantics remain intact.

## Navigation and loading

Return context is stored on each browser history entry, preserving the caller, query parameters and native back/forward behavior. Direct entry uses a known in-app fallback. Creation pages replace themselves with the saved item, avoiding a return to a form that would create another record. Editing a goal or milestone and completing a workout returns to the caller.

Owner-scoped, in-memory resources deduplicate simultaneous readers and reuse fresh data for 60 seconds. Mutations invalidate cached data; focus revalidates stale resources and reconnect revalidates immediately. Logout clears cached data, and late responses cannot restore old-account content. Nothing is persisted to local storage by this cache. Failed refreshes retain the last resource data and expose an error.

Identity and progression are no longer fetched on every route change. Today and Training share their daily sessions, recent history and goals. Race analyses run in parallel and are cached for return visits. Relevant saves, including schedule and template changes, quick goals, habits, disruptions and workout-goal links, invalidate the shared data. The old rank-only client analysis/writes have been removed from race and records pages.

## Database and release

No new migration, package installation or environment variable is introduced. The previous update's migrations through `092_living_world.sql` are still required. Existing training plans, goal ownership rules, reviewed imports and completion RPCs are unchanged.

Apply the incremental patch with `git apply --check` first. Stop if the check fails; reconcile against newer local changes instead of overwriting. Build with the project's existing environment. Review the app using your own account before deploying.

## Verification

- TypeScript and production build using isolated mock Supabase configuration.
- Targeted ESLint on the new/shared client resource, navigation, progress, training and race components.
- `node scripts/test-focus-flow.cjs`: concurrent readers, a late response after mutation, failure/retry, logout isolation and local return URLs.
- `node scripts/test-connected-core.cjs`: session construction/linking, plan preservation, imports and request-origin guards.
- `scripts/verify-connected-ui.cjs` and its flow helpers: responsive rendering at 320, 390 and 1440 px, navigation origins, URL date/tab and scroll retention, back/forward, reload/direct entry, one visible Level, goal and milestone operations, Plan-to-journal, flag persistence, imports, plan review, session start/resume/completion and failed draft recovery.
- The warm Today → Training → Today flow makes zero repeated browser Supabase requests in the isolated test. This checks request reuse, not a claim about real-world connection speed.

The browser harness uses a local mock server. Its synthetic data and screenshots are test fixtures, not a live account. Live network latency, physical iPhone/Safari behavior and production Supabase remain deployment checks. No live database or deployment was changed.

For focused navigation checks, run the existing browser harness with `LAPIS_UI_SKIP_LAYOUT=1 LAPIS_UI_FLOW_ONLY=1`. For all layout checks use its default 390, 1440 and 320 px widths. Do not deploy a build produced with the harness's local test environment variables.
