-- Disability Problem Repository: the structured record of problems the platform
-- exists to document, benchmark, and de-duplicate.

CREATE TYPE public.disability_type AS ENUM (
  'visual', 'hearing', 'mobility', 'cognitive', 'speech', 'neurological',
  'chronic_illness', 'mental_health', 'multiple', 'other'
);

CREATE TYPE public.severity_level AS ENUM ('mild', 'moderate', 'severe', 'profound');

CREATE TYPE public.age_group AS ENUM (
  'infant', 'child', 'adolescent', 'adult', 'older_adult', 'all_ages'
);

CREATE TYPE public.problem_status AS ENUM ('open', 'in_progress', 'solved', 'archived');

-- array_to_string is STABLE, not IMMUTABLE, because it goes through the element
-- type's output function. A generated column requires an immutable expression,
-- so calling it directly fails with "generation expression is not immutable".
-- text[] -> text is genuinely immutable, so wrapping it is safe.
CREATE OR REPLACE FUNCTION public.immutable_array_to_string(_arr text[], _sep text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT array_to_string(coalesce(_arr, '{}'), _sep);
$$;

CREATE TABLE public.problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 8 AND 200),
  description text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 20000),
  disability_types public.disability_type[] NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT '' CHECK (char_length(category) <= 100),
  country text NOT NULL DEFAULT '' CHECK (char_length(country) <= 100),
  age_groups public.age_group[] NOT NULL DEFAULT '{}',
  severity public.severity_level,
  status public.problem_status NOT NULL DEFAULT 'open',
  existing_solutions text NOT NULL DEFAULT '' CHECK (char_length(existing_solutions) <= 10000),
  related_research text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  image_urls text[] NOT NULL DEFAULT '{}',
  video_urls text[] NOT NULL DEFAULT '{}',
  document_urls text[] NOT NULL DEFAULT '{}',
  -- Denormalised counters kept current by triggers below; reading them avoids
  -- an aggregate per row when listing problems.
  vote_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Weighted lexical index. This is the substrate the duplicate-detection and
  -- semantic-search work builds on; a pgvector embedding column joins it later.
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, public.immutable_array_to_string(tags, ' ')), 'C') ||
    setweight(to_tsvector('english'::regconfig, coalesce(category, '')), 'C')
  ) STORED
);

GRANT SELECT ON public.problems TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problems TO authenticated;
GRANT ALL ON public.problems TO service_role;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;

-- Problems are the public record of the platform: readable without an account.
CREATE POLICY "problems_read_all" ON public.problems
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "problems_insert_own" ON public.problems
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "problems_update_own" ON public.problems
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_moderator())
  WITH CHECK (auth.uid() = user_id OR public.is_moderator());
CREATE POLICY "problems_delete_own" ON public.problems
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_moderator());

-- VOTES -----------------------------------------------------------------
-- Upvote only. A problem describes someone's lived experience; "this affects
-- me too" is a useful signal, a downvote is not.
CREATE TABLE public.problem_votes (
  problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (problem_id, user_id)
);

GRANT SELECT ON public.problem_votes TO anon;
GRANT SELECT, INSERT, DELETE ON public.problem_votes TO authenticated;
GRANT ALL ON public.problem_votes TO service_role;
ALTER TABLE public.problem_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "problem_votes_read_all" ON public.problem_votes
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "problem_votes_insert_own" ON public.problem_votes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "problem_votes_delete_own" ON public.problem_votes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- BOOKMARKS -------------------------------------------------------------
CREATE TABLE public.problem_bookmarks (
  problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (problem_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.problem_bookmarks TO authenticated;
GRANT ALL ON public.problem_bookmarks TO service_role;
ALTER TABLE public.problem_bookmarks ENABLE ROW LEVEL SECURITY;

-- Unlike votes, a bookmark is private to the user who made it.
CREATE POLICY "problem_bookmarks_read_own" ON public.problem_bookmarks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "problem_bookmarks_insert_own" ON public.problem_bookmarks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "problem_bookmarks_delete_own" ON public.problem_bookmarks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- COMMENTS --------------------------------------------------------------
CREATE TABLE public.problem_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.problem_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_comments TO authenticated;
GRANT ALL ON public.problem_comments TO service_role;
ALTER TABLE public.problem_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "problem_comments_read_all" ON public.problem_comments
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "problem_comments_insert_own" ON public.problem_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "problem_comments_update_own" ON public.problem_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "problem_comments_delete_own" ON public.problem_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_moderator());

-- MODERATION REPORTS ----------------------------------------------------
CREATE TABLE public.problem_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (problem_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.problem_reports TO authenticated;
GRANT ALL ON public.problem_reports TO service_role;
ALTER TABLE public.problem_reports ENABLE ROW LEVEL SECURITY;

-- A reporter sees only their own report; moderators see the queue.
CREATE POLICY "problem_reports_read_own_or_mod" ON public.problem_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_moderator());
CREATE POLICY "problem_reports_insert_own" ON public.problem_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "problem_reports_resolve_mod" ON public.problem_reports
  FOR UPDATE TO authenticated USING (public.is_moderator()) WITH CHECK (public.is_moderator());

-- VERSION HISTORY -------------------------------------------------------
CREATE TABLE public.problem_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  editor_id uuid,
  title text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.problem_revisions TO anon, authenticated;
GRANT ALL ON public.problem_revisions TO service_role;
ALTER TABLE public.problem_revisions ENABLE ROW LEVEL SECURITY;

-- Insert happens only through the trigger below, which is SECURITY DEFINER.
CREATE POLICY "problem_revisions_read_all" ON public.problem_revisions
  FOR SELECT TO anon, authenticated USING (true);

-- TRIGGERS --------------------------------------------------------------
-- Counter and revision triggers must be SECURITY DEFINER: the voter or
-- commenter is not the problem owner, so the owner-scoped UPDATE policy on
-- `problems` would otherwise reject the counter write.

CREATE OR REPLACE FUNCTION public.sync_problem_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.problems SET vote_count = vote_count + 1 WHERE id = NEW.problem_id;
    RETURN NEW;
  ELSE
    UPDATE public.problems SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.problem_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_problem_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.problems SET comment_count = comment_count + 1 WHERE id = NEW.problem_id;
    RETURN NEW;
  ELSE
    UPDATE public.problems SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.problem_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.snapshot_problem_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description THEN
    -- Store the pre-edit text, so the history reads as "what it used to say".
    INSERT INTO public.problem_revisions (problem_id, editor_id, title, description)
    VALUES (OLD.id, auth.uid(), OLD.title, OLD.description);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_problem_vote_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_problem_comment_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snapshot_problem_revision() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_problem_votes_count
  AFTER INSERT OR DELETE ON public.problem_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_problem_vote_count();

CREATE TRIGGER trg_problem_comments_count
  AFTER INSERT OR DELETE ON public.problem_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_problem_comment_count();

CREATE TRIGGER trg_problems_revision
  BEFORE UPDATE ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_problem_revision();

-- Skipped when only a counter moved: a vote or comment is not an edit, and
-- bumping updated_at on every vote would make "recently updated" meaningless.
CREATE TRIGGER trg_problems_updated
  BEFORE UPDATE ON public.problems
  FOR EACH ROW
  WHEN (OLD.vote_count IS NOT DISTINCT FROM NEW.vote_count
        AND OLD.comment_count IS NOT DISTINCT FROM NEW.comment_count)
  EXECUTE FUNCTION public.update_updated_at_column();

-- INDEXES ---------------------------------------------------------------
CREATE INDEX idx_problems_search ON public.problems USING GIN (search_vector);
CREATE INDEX idx_problems_tags ON public.problems USING GIN (tags);
CREATE INDEX idx_problems_disability_types ON public.problems USING GIN (disability_types);
CREATE INDEX idx_problems_created ON public.problems (created_at DESC);
CREATE INDEX idx_problems_votes ON public.problems (vote_count DESC);
CREATE INDEX idx_problems_status ON public.problems (status);
CREATE INDEX idx_problems_country ON public.problems (country);
CREATE INDEX idx_problem_comments_problem ON public.problem_comments (problem_id, created_at);
CREATE INDEX idx_problem_revisions_problem ON public.problem_revisions (problem_id, created_at DESC);

-- SEARCH ----------------------------------------------------------------
-- Ranked lexical search. The duplicate-detection engine calls this first to
-- surface near-matches at submission time.
CREATE OR REPLACE FUNCTION public.search_problems(_query text, _limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  vote_count integer,
  status public.problem_status,
  created_at timestamptz,
  rank real
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.title, p.description, p.vote_count, p.status, p.created_at,
         ts_rank(p.search_vector, websearch_to_tsquery('english', _query)) AS rank
  FROM public.problems p
  WHERE p.search_vector @@ websearch_to_tsquery('english', _query)
  ORDER BY rank DESC, p.vote_count DESC
  LIMIT LEAST(GREATEST(_limit, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.search_problems(text, integer) TO anon, authenticated;
