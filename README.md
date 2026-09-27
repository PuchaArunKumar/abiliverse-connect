# Abilitiverse

Abilitiverse is a community platform for the assistive technology ecosystem — connecting
developers, entrepreneurs, investors, mentors, and end users to accelerate innovation in
accessibility.

**Live site**: https://puchaarunkumar.github.io/abiliverse-connect/

**Lovable project**: https://lovable.dev/projects/f89616eb-fa24-4613-8fa4-f68d85fc755f

## Features

- **Problem repository** — structured reports of disability-related problems, with
  duplicate detection while you write, "this affects me too" votes, private bookmarks,
  discussion, moderation reports, edit history visible to the author, and photos, video
  and PDFs that each carry a text alternative
- **Pitch platform** — founders post assistive-technology ideas; members back them and
  leave feedback, and funders or mentors send private interest requests. No money
  changes hands on the platform
- **Companion** — private daily routines broken into small steps, a one-step-at-a-time
  guided mode, streaks, reminders while the page is open, and a calendar (.ics) download
  for reminders when it is not. Not an AI
- **Feed** — community posts with likes and comments
- **Jobs** — accessibility-friendly job listings; posters see the applications they receive
- **Learn** — curated courses tagged by level and topic
- **Opportunities** — events, opportunities, and mentorship/guidance listings
- **Connect** — member directory; members set their display name and bio under Profile
- **Accessibility panel** — text size, high contrast, reduced motion, underlined links and
  a dyslexia-friendly font, applied before first paint and remembered on the device
- **Security** — email/password sign-in (plus Google on Lovable hosting), password reset,
  and TOTP two-factor authentication enforced by the database, not just the interface

## Tech stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui (Radix primitives)
- React Router, with every page except the homepage loaded on demand
- Supabase (Postgres, Auth, Row Level Security, Edge Functions)
- Vitest + Testing Library + axe-core, and PGlite for database tests

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
| `npm run test:db` | Apply every migration to PGlite and run the database security tests |

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

Schema lives in `supabase/migrations/`. Every table has Row Level Security enabled; the
publishable key is public, so the policies are the only thing protecting data.

| Who | Can read | Can write |
| --- | --- | --- |
| Anyone, signed out | problems and their comments and media, pitches and their feedback, jobs, courses, events, homepage totals | newsletter sign-up and contact messages, through functions only |
| Signed-in members | the above, plus profiles, the feed, and the member directory | their own rows only; counters, timestamps and owners are set by the database |
| Only the member | their votes, bookmarks, pitch supports, sent interest requests, Companion routines, roles | — |
| Founders | interest requests on their own pitches | — |
| Problem authors and moderators | a problem's edit history, moderation reports | edits and deletions |

A member who has turned on two-factor authentication has only a signed-out visitor's
access until they enter the code.

`src/test/db/` applies every migration to an in-process Postgres (PGlite) and checks these
rules with real queries; `npm test` runs it. Ten migrations are not yet applied to the live
database — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

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
