-- Pitch platform: founders post assistive-technology ideas, the community backs
-- them and leaves feedback, and funders, mentors or collaborators register
-- interest privately with the founder.
--
-- Abilitiverse does not handle money. "Funding" here is an introduction: an
-- interest request carries a message and a way to reach the sender, and the
-- conversation continues off-platform.

CREATE TYPE public.pitch_stage AS ENUM ('idea', 'prototype', 'pilot', 'launched');

CREATE TYPE public.pitch_need AS ENUM (
  'funding', 'mentorship', 'cofounder', 'testers', 'partners', 'feedback'
);

CREATE TABLE public.pitches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 4 AND 120),
  tagline text NOT NULL CHECK (char_length(btrim(tagline)) BETWEEN 10 AND 200),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 50 AND 10000),
  -- The documented problem this pitch answers, when there is one. A pitch
  -- outlives the problem report it cites.
  problem_id uuid REFERENCES public.problems(id) ON DELETE SET NULL,
  stage public.pitch_stage NOT NULL DEFAULT 'idea',
  needs public.pitch_need[] NOT NULL DEFAULT '{}',
  disability_types public.disability_type[] NOT NULL DEFAULT '{}',
  funding_goal integer CHECK (funding_goal IS NULL OR funding_goal BETWEEN 1 AND 1000000000),
  funding_currency text NOT NULL DEFAULT 'USD' CHECK (funding_currency ~ '^[A-Z]{3}$'),
  -- Only http(s): these render as links, and a javascript: URL would run in
  -- the viewer's session.
  website_url text NOT NULL DEFAULT ''
    CHECK (website_url = '' OR (website_url ~* '^https?://[^\s]+$' AND char_length(website_url) <= 500)),
  demo_url text NOT NULL DEFAULT ''
    CHECK (demo_url = '' OR (demo_url ~* '^https?://[^\s]+$' AND char_length(demo_url) <= 500)),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 20),
  -- Closed once the founder is no longer looking for help; stays readable.
  is_open boolean NOT NULL DEFAULT true,
  -- Denormalised counters, written only by the SECURITY DEFINER triggers below.
  support_count integer NOT NULL DEFAULT 0,
  feedback_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(tagline, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, public.immutable_array_to_string(tags, ' ')), 'C')
  ) STORED
);

-- Column-level grants: the counters, owner and timestamps are not writable
-- through the API. A table-wide UPDATE grant would let a founder set their own
-- support_count, and the row policy cannot tell which columns changed.
-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated. Revoke first so the grants below are the whole story, and the
-- column lists actually restrict what the API can write.
REVOKE ALL ON public.pitches FROM anon, authenticated;
GRANT SELECT ON public.pitches TO anon, authenticated;
GRANT INSERT (user_id, title, tagline, description, problem_id, stage, needs,
              disability_types, funding_goal, funding_currency, website_url,
              demo_url, tags, is_open)
  ON public.pitches TO authenticated;
GRANT UPDATE (title, tagline, description, problem_id, stage, needs,
              disability_types, funding_goal, funding_currency, website_url,
              demo_url, tags, is_open)
  ON public.pitches TO authenticated;
GRANT DELETE ON public.pitches TO authenticated;
GRANT ALL ON public.pitches TO service_role;
ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;

-- Pitches are public so that funders and mentors can find them without an
-- account; everything that acts on a pitch requires one.
CREATE POLICY "pitches_read_all" ON public.pitches
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pitches_insert_own" ON public.pitches
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pitches_update_own_or_mod" ON public.pitches
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_moderator())
  WITH CHECK (auth.uid() = user_id OR public.is_moderator());
CREATE POLICY "pitches_delete_own_or_mod" ON public.pitches
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_moderator());

-- SUPPORT ---------------------------------------------------------------
-- "I would use or back this." Founders cannot support their own pitch.
CREATE TABLE public.pitch_supports (
  pitch_id uuid NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pitch_id, user_id)
);

REVOKE ALL ON public.pitch_supports FROM anon, authenticated;
GRANT SELECT, DELETE ON public.pitch_supports TO authenticated;
GRANT INSERT (pitch_id, user_id) ON public.pitch_supports TO authenticated;
GRANT ALL ON public.pitch_supports TO service_role;
ALTER TABLE public.pitch_supports ENABLE ROW LEVEL SECURITY;

-- Private to the supporter. Backing a tool for, say, blind users can say
-- something about the supporter's own disability; the public signal is
-- pitches.support_count, not who is behind it.
CREATE POLICY "pitch_supports_read_own" ON public.pitch_supports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pitch_supports_insert_own" ON public.pitch_supports
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "pitch_supports_delete_own" ON public.pitch_supports
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- FEEDBACK --------------------------------------------------------------
CREATE TABLE public.pitch_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id uuid NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'suggestion'
    CHECK (kind IN ('question', 'suggestion', 'concern', 'encouragement')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.pitch_feedback FROM anon, authenticated;
GRANT SELECT ON public.pitch_feedback TO anon;
GRANT SELECT, DELETE ON public.pitch_feedback TO authenticated;
GRANT INSERT (pitch_id, user_id, kind, body) ON public.pitch_feedback TO authenticated;
GRANT UPDATE (kind, body) ON public.pitch_feedback TO authenticated;
GRANT ALL ON public.pitch_feedback TO service_role;
ALTER TABLE public.pitch_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pitch_feedback_read_all" ON public.pitch_feedback
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pitch_feedback_insert_own" ON public.pitch_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pitch_feedback_update_own" ON public.pitch_feedback
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- The founder cannot delete criticism of their own pitch; moderators can
-- remove abuse.
CREATE POLICY "pitch_feedback_delete_own_or_mod" ON public.pitch_feedback
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_moderator());

-- INTEREST --------------------------------------------------------------
-- Private: visible only to the sender and the founder. This is how a funder
-- or mentor reaches a founder without either publishing contact details.
CREATE TABLE public.pitch_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id uuid NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offering public.pitch_need NOT NULL,
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 10 AND 2000),
  contact text NOT NULL CHECK (char_length(btrim(contact)) BETWEEN 3 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pitch_id, user_id)
);

REVOKE ALL ON public.pitch_interests FROM anon, authenticated;
GRANT SELECT, DELETE ON public.pitch_interests TO authenticated;
GRANT INSERT (pitch_id, user_id, offering, message, contact)
  ON public.pitch_interests TO authenticated;
GRANT ALL ON public.pitch_interests TO service_role;
ALTER TABLE public.pitch_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pitch_interests_read_sender_or_founder" ON public.pitch_interests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "pitch_interests_insert_own" ON public.pitch_interests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.pitches p
      WHERE p.id = pitch_id AND p.user_id <> auth.uid() AND p.is_open
    )
  );
-- Either side may withdraw or dismiss a request.
CREATE POLICY "pitch_interests_delete_sender_or_founder" ON public.pitch_interests
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pitches p WHERE p.id = pitch_id AND p.user_id = auth.uid()
    )
  );

-- TRIGGERS --------------------------------------------------------------
-- SECURITY DEFINER because the supporter or commenter is not the pitch owner,
-- and has no UPDATE grant on the counter columns anyway.

CREATE OR REPLACE FUNCTION public.sync_pitch_support_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pitches SET support_count = support_count + 1 WHERE id = NEW.pitch_id;
    RETURN NEW;
  ELSE
    UPDATE public.pitches SET support_count = GREATEST(support_count - 1, 0) WHERE id = OLD.pitch_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_pitch_feedback_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.pitches SET feedback_count = feedback_count + 1 WHERE id = NEW.pitch_id;
    RETURN NEW;
  ELSE
    UPDATE public.pitches SET feedback_count = GREATEST(feedback_count - 1, 0) WHERE id = OLD.pitch_id;
    RETURN OLD;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_pitch_support_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_pitch_feedback_count() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_pitch_supports_count
  AFTER INSERT OR DELETE ON public.pitch_supports
  FOR EACH ROW EXECUTE FUNCTION public.sync_pitch_support_count();

CREATE TRIGGER trg_pitch_feedback_count
  AFTER INSERT OR DELETE ON public.pitch_feedback
  FOR EACH ROW EXECUTE FUNCTION public.sync_pitch_feedback_count();

-- A new supporter is not an edit to the pitch.
CREATE TRIGGER trg_pitches_updated
  BEFORE UPDATE ON public.pitches
  FOR EACH ROW
  WHEN (OLD.support_count IS NOT DISTINCT FROM NEW.support_count
        AND OLD.feedback_count IS NOT DISTINCT FROM NEW.feedback_count)
  EXECUTE FUNCTION public.update_updated_at_column();

-- INDEXES ---------------------------------------------------------------
CREATE INDEX idx_pitches_search ON public.pitches USING GIN (search_vector);
CREATE INDEX idx_pitches_needs ON public.pitches USING GIN (needs);
CREATE INDEX idx_pitches_created ON public.pitches (created_at DESC);
CREATE INDEX idx_pitches_support ON public.pitches (support_count DESC);
CREATE INDEX idx_pitches_problem ON public.pitches (problem_id);
CREATE INDEX idx_pitch_feedback_pitch ON public.pitch_feedback (pitch_id, created_at);
CREATE INDEX idx_pitch_interests_pitch ON public.pitch_interests (pitch_id, created_at DESC);
