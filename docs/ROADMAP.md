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

### 1. Problem repository — shipped

Structured problem reports with disability type, category, country, age group,
severity, tags and existing solutions. Voting, private bookmarks, comments,
moderation reports, and automatic version history. Weighted full-text search
over title, description and tags. Duplicate candidates surface live while a
report is being written.

Also here: role-based access control (`user_roles` + `has_role()`), and public
read access so the catalogue is reachable without an account.

### 2. Profile depth and identity

Attach the 16 roles to onboarding, add skills and accessibility focus areas as
structured fields, and build the public profile page. Everything downstream —
search ranking, collaborator matching, endorsements — depends on profiles
carrying structured data rather than three free-text fields.

### 3. Semantic duplicate detection

Enable `pgvector`, add an `embedding` column to `problems`, and backfill via an
edge function. Blend lexical rank with vector distance in `search_problems`.
The call site in the report form does not change — only the ranking behind it.

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
  `profiles` recurses infinitely. Check roles through `has_role()`, which is
  `SECURITY DEFINER`.
- **Counter and history triggers must be `SECURITY DEFINER`.** The voter is not
  the problem owner, so an owner-scoped `UPDATE` policy would otherwise reject
  the counter write.

## Known gaps

- `Pitches` and `Companion` are placeholder pages.
- No media upload yet: `image_urls`, `video_urls` and `document_urls` accept
  URLs but there is no Storage bucket or upload UI.
- Lint errors predating this work remain in `Feed.tsx`, `Opportunities.tsx` and
  `tailwind.config.ts`.
- The production bundle is ~690 kB; route-level code splitting is worth doing
  before launch.
