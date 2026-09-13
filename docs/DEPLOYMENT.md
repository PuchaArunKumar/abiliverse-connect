# Deploying Abilitiverse

Supabase project ref: `jfgewdekyfocqxzzwqgv`

Code on `main` deploys through Lovable. Database migrations do **not** deploy
themselves — they are files in `supabase/migrations/` until something applies
them. Applying them is the step below.

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
it is safe.

### Pending migrations

These four have not been applied to the live database yet:

| Migration | What it does |
| --- | --- |
| `20260807090000_user_roles_rbac.sql` | `user_roles`, `app_role` enum, `has_role()` / `is_admin()` / `is_moderator()` |
| `20260807090100_problem_repository.sql` | `problems` and its votes, bookmarks, comments, reports, revisions, plus full-text search |
| `20260807090200_public_catalog_read.sql` | Anonymous read on `jobs`, `courses`, `events` |
| `20260807090300_bootstrap_admin.sql` | Signup trigger grants only the baseline `volunteer` role; the first admin is granted by hand |

They are ordered by filename and must be applied in that order — the problem
repository's policies call `is_moderator()` from the first migration.

## After applying

1. **Regenerate types.** `src/integrations/supabase/types.ts` was hand-extended
   to match what these migrations produce. Once they are applied, replace it
   with real generated output:

   ```sh
   npm run db:types
   ```

   Then run `npx tsc --noEmit -p tsconfig.app.json`. A mismatch here means the
   hand-written types drifted from the schema.

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

3. **Smoke test** `/problems` while signed out — it should render the catalogue,
   not an empty state. Then sign in, publish a problem, and confirm the
   duplicate-detection panel appears when a similar title is typed.

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

Google sign-in goes through Lovable's auth broker and may only accept
Lovable-hosted origins; email/password sign-in does not depend on it.

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

`db push` has no down migrations. To reverse a schema change, write a new
migration that undoes it. For the problem repository specifically:

```sql
DROP TABLE IF EXISTS public.problem_revisions, public.problem_reports,
  public.problem_comments, public.problem_bookmarks, public.problem_votes,
  public.problems CASCADE;
DROP TYPE IF EXISTS public.problem_status, public.age_group,
  public.severity_level, public.disability_type;
```

Take a backup from the dashboard first — dropping `problems` cascades to every
vote, comment and revision attached to it.
