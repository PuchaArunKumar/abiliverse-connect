# Abilitiverse roadmap

The full vision — problem repository, benchmarking engine, solution registry,
research hub, dataset repository, knowledge graph, funding portal, admin
console — is a multi-year programme. This document sequences it so that every
milestone ships something usable rather than a layer nobody can see yet.

## Architecture decision: stay on Supabase

The vision document proposes Next.js + FastAPI + Celery + Redis + Neo4j +
Milvus + Kubernetes. We are not moving to that stack, because the current one
already covers those needs and a rewrite would discard working Row Level
Security policies and a complete multi-factor auth flow.

| Proposed | What we use instead |
| --- | --- |
| FastAPI service layer | Postgres + RLS, with edge functions for server-side logic |
| Redis + Celery | `pg_cron` and edge functions; revisit under real load |
| Elasticsearch | Postgres full-text search (`tsvector`, GIN) — already in place |
| Milvus / ChromaDB | `pgvector` in the same database, so vector and relational filters compose in one query |
| Neo4j | Recursive CTEs over Postgres; a graph database only once traversal depth demands it |
| S3 / MinIO | Supabase Storage |
| Raw WebSockets | Supabase Realtime |
| Clerk / Auth.js | Supabase Auth, already wired with TOTP two-factor |

The decisive point is `pgvector`: keeping embeddings beside the relational data
means "problems similar to this one, in India, affecting mobility, still open"
is one indexed query. Split across Postgres and a separate vector store, it
becomes two round trips and application-side joining.

Revisit this if sustained write throughput exceeds what one Postgres primary
handles, or if graph traversals routinely exceed three hops.

## Milestones

### 1. Problem repository — built; migrations pending

Structured problem reports with disability type, category, country, age group,
severity, tags and existing solutions. Voting, private bookmarks, comments,
moderation reports, and automatic version history. Weighted full-text search
over title, description and tags. Duplicate candidates surface live while a
report is being written.

Also here: role-based access control (`user_roles`, checked through
`is_admin()` / `is_moderator()`), public read access so the catalogue is
reachable without an account, editing and deletion by the author or a
moderator, and uploaded photos, video and PDFs with required text
alternatives.

The code is complete; it goes live when the pending migrations are applied
(see `DEPLOYMENT.md`). Until then the pages say the feature is being set up.

### 2. Profile depth and identity

Attach the 16 roles to onboarding, add skills and accessibility focus areas as
structured fields, and build the public profile page. Everything downstream —
search ranking, collaborator matching, endorsements — depends on profiles
carrying structured data rather than three free-text fields.

### 3. Semantic duplicate detection

Enable `pgvector`, add an `embedding` column to `problems`, and backfill via an
edge function. Blend lexical rank with vector distance in `search_problems`.
The call site in the report form does not change — only the ranking behind it.

### Pitch platform and Companion — built; migrations pending

Pitches with community support and feedback and private interest requests
from funders and mentors (introductions only; no payments). Companion: private
step-by-step routines, streaks, in-page reminders and a calendar export — a
structured tool rather than the AI assistant of milestone 8.

### 4. Solutions registry

Solutions linked to the problems they address: technology, repository, licence,
cost, accessibility rating, supported disabilities, demo media. This is what
turns the repository from a list of complaints into a benchmark.

### 5. Collaboration

Projects, membership with roles, milestones, tasks, and threaded discussion.
Realtime presence via Supabase Realtime.

### 6. Research and datasets

Papers with DOI/BibTeX/citations, and dataset upload through Supabase Storage
with metadata, licence and download statistics.

### 7. Knowledge graph

Materialise relationships already implied by the schema (problem ↔ solution ↔
project ↔ researcher ↔ dataset) and render an interactive view. Recursive CTEs
first; a dedicated graph store only if traversal depth demands it.

### 8. AI assistant

Retrieval-augmented answering over problems, solutions and research, built on
the embeddings from milestone 3 and served through the existing MCP layer in
`src/lib/mcp/`.

### 9. Funding portal, analytics, admin console

Funding discovery for NGOs and investors, impact dashboards, and the moderation
queue (the `problem_reports` table and `is_moderator()` already exist).

## Standing constraints

- **Accessibility is a release gate, not a milestone.** Every feature ships
  keyboard-navigable, screen-reader labelled, and WCAG 2.1 AA contrast-checked.
  This platform is judged by disabled users first.
- **RLS on every table, always.** The publishable key is public by design;
  policies are the only thing protecting data. Never put a service-role key in
  `.env`.
- **Roles never live on `profiles`.** A policy on `profiles` that reads
  `profiles` recurses infinitely. Policies check roles through `is_admin()` and
  `is_moderator()`, which are `SECURITY DEFINER`. `has_role()` is internal:
  the API roles cannot call it, so a policy that calls it directly fails for
  signed-in users.
- **Counter and history triggers must be `SECURITY DEFINER`.** The voter is not
  the problem owner, so an owner-scoped `UPDATE` policy would otherwise reject
  the counter write.
- **Revoke before granting.** Supabase grants `ALL` on every new `public`
  table to `anon` and `authenticated`. Start each table's grants with
  `REVOKE ALL ... FROM anon, authenticated`, and grant writable columns
  explicitly so counters, timestamps and owners stay database-controlled.
- **Every new table gets the two-factor policies** from
  `20260927090300_require_mfa_when_enrolled.sql`, and that migration's final
  check fails if one is missing.
- **Run `npm run test:db` after touching a migration**, and add a case to
  `src/test/db/rls.test.ts` for any new rule.

## Known gaps

- Ten migrations are written and tested but not yet applied to the live
  database (`DEPLOYMENT.md` lists them).
- There is no moderation queue UI yet: reports are stored in
  `problem_reports` and are readable by moderators, but reviewing them happens
  in the SQL editor until the admin console (milestone 9).
- Deleting a problem removes its media rows, but Storage objects orphaned by a
  cascade (for example when an account is deleted) are cleaned up by hand.
- Contact-form messages are stored in `contact_messages` and read from the SQL
  editor; nothing emails them on.
- Companion reminders fire only while the page is open; the calendar export
  covers the rest. Push notifications would need a service worker and a
  server-side scheduler.
