# Install the LAPIS update

Prepared for `llshdr/progress-os`, main commit `224a08c`, after the first LAPIS redesign and migration 088.

1. Extract the download. Copy `lapis-connected-world.patch` into:
   `C:\Users\lucce\OneDrive\Skrivbord\progress-os`

2. Open PowerShell in that folder. Check for local work first:

```powershell
cd "C:\Users\lucce\OneDrive\Skrivbord\progress-os"
git status --short
```

Save or commit any changed app files before continuing. Untracked downloaded `.patch` files are fine.

3. Create the update branch and check the patch:

```powershell
git switch main
git pull --ff-only
git switch -c lapis-connected-world
git apply --check .\lapis-connected-world.patch
```

No output from the last command means the check passed. Then run:

```powershell
git apply .\lapis-connected-world.patch
```

If any command reports an error, stop there and keep the output. Do not overwrite files or force the patch.

4. In the same Supabase project you used before, run each complete SQL file once, in this order:

- `089_connected_journey.sql`
- `090_reviewed_race_plans.sql`
- `091_connections_and_imports.sql`

They are in the download's `migrations` folder and in the app's `supabase/migrations` folder after applying the patch. These are copies of the same files: run each migration only once. Do not rerun 088. If you manage migrations with the Supabase CLI, use your existing migration workflow instead.

5. Keep your existing `.env.local`. Run:

```powershell
npm ci
npm run build
npm run dev
```

Open `http://localhost:3000`. Try World, your Ironman overview, a saved workout and a reviewed import. Check your phone too. Once reviewed, commit and push this new branch to get a Vercel preview through your existing GitHub connection.

**Email and other account connections:** the connection code is included, but each provider needs your app credentials and callback setup. File/CSV imports work without those credentials. Text extraction uses your existing Gemini key. Follow `docs/LAPIS-CONNECTED-WORLD.md` for setup and test details.

The update has been built and tested locally with isolated data. Your live database and deployment still need the application steps above.
