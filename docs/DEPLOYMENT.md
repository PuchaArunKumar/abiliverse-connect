# Deploying Abilitiverse

Supabase project ref: `jfgewdekyfocqxzzwqgv`

Code on `main` deploys to GitHub Pages (and can be published from Lovable).
Database migrations do **not** deploy themselves — they are files in
`supabase/migrations/` until something applies them. Applying them is the step
below. Until then, pages whose tables are missing say the feature is "being set
up" rather than failing.

## Apply migrations to the live database

The Supabase CLI ships as a dev dependency, so `npm install` is all the setup
there is.

```sh
# 1. Authenticate. Opens a browser and stores a token.
npx supabase login

# 2. Link this checkout to the hosted project (once per machine).
npm run db:link

# 3. Preview what will run. Always read this before step 4.
npx supabase db push --dry-run

# 4. Apply.
npm run db:push
```

In CI, replace step 1 with a `SUPABASE_ACCESS_TOKEN` environment variable from
a [personal access token](https://supabase.com/dashboard/account/tokens).

`db push` applies only migrations the remote has not recorded yet, so re-running
it is safe. `npx supabase migration list --linked` shows which ones those are.

If linking fails because the project is managed by Lovable Cloud rather than
your own Supabase account, apply the same files, in filename order, through
Lovable (ask it in the project chat to run the pending migrations in
`supabase/migrations/`) or by pasting each one into the SQL editor.

Before applying, run `npm run test:db`. It applies every migration, in order,
to an in-process Postgres (PGlite) with a Supabase shim and checks the row
level security rules with real queries — a migration that fails there will fail
on the hosted database too. `npm test` includes it, so CI runs it before every
deploy.

### Pending migrations

The live database has the first three migrations (profiles, the feed, jobs,
courses and events). These ten have not been applied yet:

| Migration | What it does |
| --- | --- |
| `20260807090000_user_roles_rbac.sql` | `user_roles`, `app_role` enum, `is_admin()` / `is_moderator()`. Roles are visible only to their holder and moderators, since several describe health or disability |
| `20260807090100_problem_repository.sql` | `problems` and its votes, bookmarks, comments, reports and revisions, full-text search, and `search_problems()` for duplicate detection. Votes and revision history are private; counters and timestamps are not writable through the API |
| `20260807090200_public_catalog_read.sql` | Anonymous read on `jobs`, `courses`, `events` |
| `20260807090300_bootstrap_admin.sql` | Signup trigger grants only the baseline `volunteer` role; the first admin is granted by hand |
| `20260807090400_newsletter_and_public_stats.sql` | `subscribe_to_newsletter()` (the list itself is admin-only) and `public_stats()` for the homepage |
| `20260927080000_harden_live_tables.sql` | Stops publishing email addresses as display names (and blanks existing ones), adds cascade foreign keys to `auth.users`, column-level grants so clients cannot forge timestamps or owners, http(s)-only link checks, and `send_contact_message()` for the contact form |
| `20260927090000_problem_media.sql` | `problem_media` and the public `problem-media` Storage bucket for problem photos, video and PDFs, with required text alternatives |
| `20260927090100_pitch_platform.sql` | `pitches`, private `pitch_supports`, `pitch_feedback`, and private founder-only `pitch_interests` |
| `20260927090200_companion_routines.sql` | `companion_routines` and `companion_completions`, private to their owner |
| `20260927090300_require_mfa_when_enrolled.sql` | Enforces two-factor authentication in the database: a member with an authenticator app who has not entered the code has only a signed-out visitor's access. Must run last |

They are ordered by filename and must be applied in that order: later files
call functions and reference tables from earlier ones, and the last one fails
on purpose if any table is missing its two-factor policies.

**Any new table added after these needs the same two-factor policies** as the
ones in `20260927090300_require_mfa_when_enrolled.sql`.

## After applying

1. **Regenerate types (optional).** `src/integrations/supabase/types.ts` is
   hand-maintained, and `src/test/db/types.test.ts` checks it against the
   migrated schema on every test run. Once the migrations are applied you can
   replace it with generated output:

   ```sh
   npm run db:types
   ```

   Then run `npx tsc --noEmit -p tsconfig.app.json` and `npm test`.

2. **Create the admin account.** Sign up at `/signup` with the account that
   should be admin, then grant the role from the Supabase SQL editor — the
   exact statements are in the comment at the end of
   `20260807090300_bootstrap_admin.sql`. Admin is never granted by email match
   on signup, because addresses are not verified. Until the first grant nobody
   holds the role, so no one can grant roles to anyone else.

   Verify:

   ```sql
   SELECT u.email, r.role
   FROM auth.users u
   JOIN public.user_roles r ON r.user_id = u.id
   WHERE r.role = 'admin';
   ```

3. **Check two project settings** in the Supabase dashboard:
   - Authentication → Providers → Email → *Confirm email*. The project
     currently auto-confirms, so any address can be registered by anyone. The
     app handles both modes.
   - Authentication → URL Configuration → Redirect URLs must include the
     GitHub Pages address (below), or confirmation and password-reset emails
     will not return to the site.

4. **Smoke test.** Signed out: `/problems` and `/pitches` render their
   catalogues, not "being set up". Signed in: publish a problem with a photo
   and its description, confirm the duplicate panel appears for a similar
   title, post a pitch, and add a Companion routine. With two-factor
   authentication turned on, sign in and confirm nothing members-only loads
   until the code is entered.

## Publishing the frontend

### GitHub Pages

Every push to `main` runs `.github/workflows/deploy-pages.yml`: it installs,
runs the tests, builds, and publishes to
https://puchaarunkumar.github.io/abiliverse-connect/. A failing test stops the
deploy. Re-run it by hand from Actions → Deploy to GitHub Pages → Run workflow.

Pages serves the site under `/abiliverse-connect/`, so the build passes
`--base`, and the router and auth redirects read it from
`import.meta.env.BASE_URL` (see `src/lib/url.ts`). Use `appUrl()` for any URL
that leaves the router — a hard-coded `/path` works locally and 404s on Pages.
Pages has no SPA rewrites, so the workflow copies `index.html` to `404.html`
to make deep links load.

For email confirmation and password-reset links to land on Pages, add the site
under Supabase → Authentication → URL Configuration → Redirect URLs:

```
https://puchaarunkumar.github.io/abiliverse-connect/**
```

Google sign-in goes through Lovable's auth broker at the root-relative path
`/~oauth/initiate`, which exists only on Lovable hosting. The app therefore
shows the Google button only on the root build (base `/`); the GitHub Pages
build hides it and offers email and password sign-in.

Pull requests to `main` run the same install, test and build steps without
deploying.

### Lovable

Lovable → Share → Publish. Custom domains live under Project → Settings →
Domains. This build uses base `/`, so the same code serves both.

## Do not build the MCP function on Windows

The Lovable MCP Vite plugin miscompiles on Windows: running `npm run build`
there rewrites `supabase/functions/mcp/index.ts` with an absolute local
filesystem path as an npm import specifier, which breaks the deployed edge
function.

If `git status` shows that file modified after a Windows build, discard it:

```sh
git restore supabase/functions/mcp/index.ts
```

Build on Linux or in CI when that function genuinely needs regenerating.

## Rollback

`db push` has no down migrations. **Take a backup before applying** (Dashboard →
Database → Backups). To undo a schema change, restore that backup or write a
new migration that reverses it.

Hand-written `DROP` scripts are fragile here: `search_problems()`,
`public_stats()`, `pitches.problem_id`, the storage policies and the
two-factor policies all depend on the problem repository, so dropping its
tables in the wrong order fails part-way. If you do write one, test it first
with `npm run test:db` by adding it as a temporary last migration.
