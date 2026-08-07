-- /jobs, /learn and /opportunities are public routes in the router, but these
-- tables only granted SELECT to `authenticated`. A logged-out visitor therefore
-- got an empty result set and the pages rendered "No jobs posted yet." rather
-- than the catalogue. Open reads to `anon` so the public surface works.
--
-- Writes are untouched and remain owner-scoped.

GRANT SELECT ON public.jobs TO anon;
GRANT SELECT ON public.courses TO anon;
GRANT SELECT ON public.events TO anon;

CREATE POLICY "jobs_read_anon" ON public.jobs
  FOR SELECT TO anon USING (true);

CREATE POLICY "courses_read_anon" ON public.courses
  FOR SELECT TO anon USING (true);

CREATE POLICY "events_read_anon" ON public.events
  FOR SELECT TO anon USING (true);

-- job_applications, posts, post_likes, post_comments and profiles are
-- deliberately excluded: applications are private to applicant and poster, and
-- the feed and member directory stay behind sign-in.
