# LAPIS UI integration

Branch: `feat/lapis-ui-redesign`

This change implements the approved dark LAPIS direction inside the existing Next.js app. It uses the existing Supabase records and routes; illustrative mockup workouts, dates, scores and goals are not seeded into anyone's account.

## What changed

- Shared system typography replaces the serif display font. Dark matte surfaces, blue actions, readable secondary text, responsive page spacing, focus outlines, larger form controls, safe-area navigation and reduced-motion support apply across the app. Pinch zoom is enabled again.
- Mobile navigation has Today, Training, Journey and Coach. Nutrition, Calendar, Profile and Settings remain available in the top toolbar and desktop sidebar. Nested routes retain the correct selected tab.
- Training combines the previous Gym/Train intermediate menus. The old `/gym/train` URL redirects to `/gym`. The home shows the current unfinished session, calendar/rotation slot or completed-today state using existing schedule logic, plus actual weekly counts and recent workouts.
- Today shows real training state, unblocked goal next actions, Journey preview, quick-log links and the existing suggestions setting. The race-day entry point remains available on the date of a saved race.
- Library, Progress and Settings use compact grouped destinations. Existing exercise, template, sleep, nutrition, weight, calendar, workout and settings forms retain their data operations while inheriting the shared design.
- Races have clearer action cards and dates. The existing race planner retains its calculations and editing controls, with numbered, accessible expandable phases.
- Journey adds a World view alongside the existing Goals manager. Destinations come from the user's saved goals and open the existing detail pages. The background is an optimized generated WebP; the links and labels are actual UI. The scene previews up to six destinations, and the list includes all active goals. This is a responsive scene, not a procedural 3D engine.
- A goal's optional World appearance (Summit, Basecamp, Trail) is independent of scope, rank and history. Automatic appearance derives from existing scope. Business goals can be summits too. Existing create/edit/archive/reactivate/delete flows remain in place.
- One workout can be linked to multiple goals. Goal details show recent linked sessions. Linking never duplicates workouts or automatically completes milestones. Deleting a goal removes its links, not the workouts.
- Coach exposes the existing daily suggestions and links to the existing goal coaching and training tools. It does not pretend to offer a new chat or voice system. Failed dismiss/complete writes keep the suggestion visible and show an error.

## Apply to the existing project

The patch was prepared against commit `b6c39f936e354eedebe13536af995ce7b7256674`.

1. Save or commit any local work before applying. Create a separate branch.
2. Run `git apply --check <path-to-lapis-ui-redesign.patch>` first, then `git apply <path-to-lapis-ui-redesign.patch>`. If the check reports conflicts, do not overwrite files; reconcile with the newer source.
3. Apply `supabase/migrations/088_add_goal_world_style.sql` through your normal Supabase migration process before releasing the UI. It adds a nullable appearance column and the workout-goal link table with ownership checks and row-level security. It does not seed goals or modify training records.
4. Use the project's existing environment variables, then run `npm ci`, `npx tsc --noEmit` and `npm run build`.
5. Review using your own account before deploying. Test a saved workout, nutrition logging, goal edits, archive/restore, a race plan and owner-only invite settings.

Without migration 088, the World view can still derive appearances from the existing goal scopes, but saving appearances and linking sessions require the new schema.

## Verification

- Production build and TypeScript compilation checked locally using placeholder Supabase configuration.
- Targeted ESLint checks cover the new views, shared navigation and new components/hooks.
- `scripts/verify-lapis-ui.cjs` runs the built app against an isolated mock Supabase server. It checks mobile page rendering, desktop Today, selected navigation on nested pages, quick-log expansion, World filtering, goal detail, appearance persistence, workout links, empty/error states and horizontal overflow. It never connects to a real database.
- Browser fixtures are test-only. They are not imported into the application.
- Authentication with a real account, live RLS enforcement and applying the SQL migration must be verified in the deployment environment. No live database or deployment was changed here.

To run the optional browser test, install Playwright locally (`npm install --no-save playwright`, then `npx playwright install chromium`). Build with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=local-ui-test-key`, then run `node scripts/verify-lapis-ui.cjs`. Do not deploy that test-configured build; rebuild with the real environment afterwards. Ports 3100 and 54321 must be free. Test screenshots go to the git-ignored `artifacts/ui-review/` directory.
