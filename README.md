# Abilitiverse

Abilitiverse is a community platform for the assistive technology ecosystem — connecting
developers, entrepreneurs, investors, mentors, and end users to accelerate innovation in
accessibility.

**Live site**: https://puchaarunkumar.github.io/abiliverse-connect/

**Lovable project**: https://lovable.dev/projects/f89616eb-fa24-4613-8fa4-f68d85fc755f

## Features

- **Feed** — community posts with likes and comments
- **Jobs** — accessibility-friendly job listings with easy apply
- **Learn** — curated courses tagged by level and topic
- **Opportunities** — events, opportunities, and mentorship/guidance listings
- **Connect** — member directory and profiles
- **Accessibility panel** — user-adjustable font size, contrast, and motion preferences,
  persisted locally
- **Security** — email/password and Google sign-in, TOTP two-factor authentication,
  password reset

## Tech stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui (Radix primitives)
- React Router, TanStack Query, React Hook Form + Zod
- Supabase (Postgres, Auth, Row Level Security, Edge Functions)
- Vitest + Testing Library

## Getting started

Requires Node.js and npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)).

```sh
git clone https://github.com/PuchaArunKumar/abiliverse-connect.git
cd abiliverse-connect
npm install
npm run dev
```

The dev server runs on http://localhost:8080.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

## Environment

`.env` holds the Supabase connection values. These are `VITE_`-prefixed, so they are
embedded in the client bundle and are public by design:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Data access is protected by Row Level Security policies, not by hiding these values.
Never put a Supabase service-role key or any other secret in this file — anything here
ships to the browser.

## Database

Schema lives in `supabase/migrations/`. Every table has Row Level Security enabled with
policies scoped to the `authenticated` role, and write access restricted to the owning
user via `auth.uid() = user_id`.

Tables: `profiles`, `posts`, `post_likes`, `post_comments`, `jobs`, `job_applications`,
`courses`, `events`.

## MCP server

`src/lib/mcp/` defines an MCP server (`abilitiverse-mcp`) exposing `get_my_profile` and
`update_my_profile`. It is bundled to the `supabase/functions/mcp` edge function by the
Lovable Vite plugin — edit the sources under `src/lib/mcp/`, not the generated function.

## Deploying

Pushing to `main` deploys to [GitHub Pages](https://puchaarunkumar.github.io/abiliverse-connect/)
via GitHub Actions. The site can also be published from the
[Lovable project](https://lovable.dev/projects/f89616eb-fa24-4613-8fa4-f68d85fc755f) with
Share → Publish. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for both, and for applying
database migrations.
