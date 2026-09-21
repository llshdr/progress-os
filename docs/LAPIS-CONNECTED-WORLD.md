# LAPIS: connected World, training and planning

Built against main commit `224a08c`. This update follows the original LAPIS redesign and migration 088. It does not seed goals, rewrite completed training, apply a live migration, or deploy the app.

## What changes

- Four primary destinations: Today, Training, Plan and Journey. Nutrition, Coach, search and your profile photo remain directly accessible. Desktop gets a sidebar; phone gets a floating bottom bar. Nested training pages retain their selected navigation. Back links use recent in-app history with a safe fallback.
- Today, Plan and race overview use the same daily-session model. Swimming and strength on the same day stay separate. Gym templates attach to the strength session instead of appearing twice. A completed unrelated workout does not silently complete a race session. Starting a planned session can resume an active workout, link an existing session, or create one with a retry-safe key.
- Journey is an interactive landscape generated from saved goals. Summits, trails and base camps have stable positions; goal edits, additions and archives update the world. Focus now, Horizon, Paused and Reached filters keep the world usable as priorities change. A desktop detail panel becomes a phone sheet. Real milestones and next actions provide the route; there is no invented progress percentage or fixed requirement to keep four goals.
- Ironman and other races open to an overview: phase, selected week, discipline totals, sessions, linked goal and next preparation task. Pin a main race for Today and Plan. Totals are completed training during the displayed week, not proof that a particular race session was completed. Commuting is excluded from training-distance totals.
- Generating a race plan creates a preview. You compare future weeks and apply explicitly. Past/current weeks preserve targets, schedules and progression indices. Applying an expired preview, a preview across a new training week, or one based on a changed race/plan is rejected. Manual template edits explain which weeks use them.
- Set and cardio forms keep a recoverable draft on the current device, scoped to the account and exercise. Failed saves leave entered values available. Strength logging uses a stable set ID so retrying does not add a duplicate. Rest start time is retained. Drafts expire after 30 days and are cleared on sign-out; they are not cross-device synchronization.
- Profile starts with recorded achievements and shows the uploaded avatar in navigation. Nutrition opens with today's logging before trends. Important settings forms expose save/load failures.
- Connections & imports supports calendar files, workout CSV, selected email text, Gmail, Google Calendar, Outlook mail, Outlook Calendar and Strava. Preview, edit, choose the destination and import. Imported source receipts make repeated saves idempotent. Import is atomic per item; a mixed batch reports each result and can safely be retried.

## Apply to the existing project

Save/commit local work. Use a new branch from the latest main containing the first redesign. Do not reapply migration 088.

```powershell
cd "C:\Users\lucce\OneDrive\Skrivbord\progress-os"
git status --short
git switch main
git pull --ff-only
git switch -c lapis-connected-world
git apply --check .\lapis-connected-world.patch
git apply .\lapis-connected-world.patch
```

Run the apply command only if the check succeeds. If the check reports conflicts, reconcile with newer code; do not overwrite files.

Apply these migrations in order through the project's existing Supabase migration process, before running the new UI:

1. `089_connected_journey.sql`: goal attention/positions, race-goal and session links, main race, session-start RPC.
2. `090_reviewed_race_plans.sql`: owner-scoped plan previews and transactional apply.
3. `091_connections_and_imports.sql`: encrypted connection storage, import receipts and reviewed import RPC.

For a project maintained through the Supabase SQL Editor, run each complete file once in that order. For a CLI-managed project, use its normal migration workflow. These migrations are not designed to be rerun manually after success.

Use the existing real `.env.local`, then:

```powershell
npm ci
npx tsc --noEmit
npm run build
npm run dev
```

Check your own account on a phone and computer before publishing. The migration adds columns/tables and ownership checks; it does not create goals or alter past workout contents. Rollback should be a reviewed migration, not dropping tables containing newly imported data.

## Optional provider setup

The core app, calendar-file imports, manual items and workout CSV work without provider credentials. Email-text extraction needs the existing `GEMINI_API_KEY`. Connected providers remain unavailable until configured; the UI does not pretend they are connected.

Set these server environment variables locally and in the deployment environment:

| Variable                                         | Value                                                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `APP_URL`                                        | Exact app origin, such as `https://your-app.vercel.app`; localhost is allowed for development |
| `LAPIS_CONNECTIONS_KEY`                          | A random 32-byte key as 64 hexadecimal characters                                             |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`       | Your Google OAuth web application                                                             |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Your Microsoft OAuth application                                                              |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`       | Your Strava application                                                                       |

Generate the encryption key once:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep it in server environment configuration, never in git or a `NEXT_PUBLIC_` variable. Keep the same key across restarts. Changing it makes existing tokens unreadable, so users must disconnect and reconnect. Preview deployments should either use their own configured callback origin or leave connections disabled.

Register these exact redirect URLs, replacing the origin:

| Provider         | Callback path                                | Requested permissions           |
| ---------------- | -------------------------------------------- | ------------------------------- |
| Gmail            | `/api/connections/gmail/callback`            | `gmail.readonly`                |
| Google Calendar  | `/api/connections/google_calendar/callback`  | `calendar.events.readonly`      |
| Outlook mail     | `/api/connections/outlook/callback`          | `offline_access Mail.Read`      |
| Outlook Calendar | `/api/connections/outlook_calendar/callback` | `offline_access Calendars.Read` |
| Strava           | `/api/connections/strava/callback`           | `activity:read_all`             |

Enable the Gmail and Calendar APIs for Google, configure the consent screen and add intended test users while testing. Microsoft configuration must permit the account types you want to support, including personal Outlook accounts if applicable. Strava requires its callback domain to match the app host. Provider account limits, consent review and verification requirements remain separate from this implementation.

Official setup references: [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [Microsoft authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [Strava authentication](https://developers.strava.com/docs/authentication/).

## How connections behave

- Connections fetch on request. They do not send email, modify external calendars, or continuously synchronize.
- Mail shows a small recent list. Only the message the user chooses is retrieved for review. Choosing AI extraction sends that selected text to the configured Gemini service; the UI states this before extraction.
- Calendar connections fetch upcoming events; Strava fetches recent workouts. The review screen shows what will be saved. Missing/ambiguous dates require correction, and expenses require an explicit race and confirmation that the amount uses its budget currency.
- OAuth uses expiring, user-bound state, an HttpOnly cookie and PKCE where supported. Provider tokens are encrypted with AES-256-GCM and tied to the user/provider. Tokens remain on the server. Database tables and RPCs enforce ownership with RLS and invoker privileges.
- Disconnect removes LAPIS's stored credentials. To revoke the provider's grant as well, remove LAPIS in the provider's account settings. Previously imported records remain.
- Calendar file recurrence imports the first occurrence with a warning; it does not promise a full recurrence-series sync. Canceled ICS events are omitted. CSV imports require a date, discipline, distance and duration. Imported workouts without a supplied start time use a synthetic timestamp and explicitly note that the start time is unspecified.
- Reimporting the same source item does not update an existing record. Edit that record in LAPIS. If an imported record is deleted, its receipt still prevents silently recreating it on the next repeated import.

## Verification

Production compilation and TypeScript checking passed with isolated placeholder configuration. Targeted ESLint checks passed for the new shared components, APIs, hooks, World and connection/import code. Core logic and PostgreSQL migration checks passed. The browser suite verifies primary screens at 320, 390 and 1440 pixels, plus navigation, destination editing, imports, OAuth request guards, reviewed plan application, session start/resume, failed-save recovery, empty/error states, hydration errors and dialog bounds.

No test contacts a live Supabase database. Tests require an isolated local configuration.

```sh
node scripts/test-connected-core.cjs
```

This covers shared sessions, calendar consistency, actual totals, preserving current/past weeks, date/timezone parsing, imports and encryption/account binding.

The SQL test needs PGlite installed locally as a test-only dependency (or `LAPIS_PGLITE_MODULE` pointing to a temporary installation):

```sh
npm install --no-save @electric-sql/pglite
node scripts/test-connected-db.cjs
```

It applies the actual migrations 088–091 to a minimal PostgreSQL fixture and exercises owner isolation, session retries, preview concurrency, encrypted-row ownership, all four import types and duplicate prevention. It does not replace verification against a copy of the full production schema.

For browser checks, install Playwright as a test-only dependency and its Chromium browser:

```sh
npm install --no-save playwright
npx playwright install chromium
```

Build with **test-only** `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=local-ui-test-key`, then run:

```sh
node scripts/verify-connected-ui.cjs
```

Ports 3100 and 54321 must be free. The script uses mock Supabase responses and produces git-ignored screenshots in `artifacts/connected-review/`. `LAPIS_CHROMIUM_PATH` can select an already installed Chromium. `LAPIS_UI_DEV=1` selects a development server for diagnosis.

Never deploy the test-configured build. Rebuild with the real environment after testing. Real account authentication, provider consent/refresh, mobile Safari behavior and live database policies require checks in the deployment environment. No external-provider integration has been verified with real credentials here.
