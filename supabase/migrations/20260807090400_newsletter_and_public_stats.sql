-- Backing for two homepage sections that previously showed invented content:
-- a newsletter form that discarded the address it collected, and a stats block
-- with hard-coded numbers.

-- NEWSLETTER ------------------------------------------------------------
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE
    CHECK (char_length(email) BETWEEN 3 AND 320 AND position('@' in email) > 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT SELECT ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone may subscribe, but nobody may read the list back. Without this
-- asymmetry the subscriber list is a harvestable mailing list for any visitor
-- holding the publishable key, which is public by design.
CREATE POLICY "newsletter_insert_public" ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "newsletter_read_admin" ON public.newsletter_subscribers
  FOR SELECT TO authenticated USING (public.is_admin());

-- PUBLIC STATS ----------------------------------------------------------
-- Aggregate counts for the homepage. SECURITY DEFINER so it can count
-- `profiles`, which anonymous visitors cannot read row-by-row — this returns
-- only totals, never rows, so no profile data is exposed.
CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS TABLE (
  members bigint,
  problems bigint,
  countries bigint,
  opportunities bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.problems),
    (SELECT count(DISTINCT country) FROM public.problems WHERE country <> ''),
    (SELECT count(*) FROM public.events);
$$;

REVOKE ALL ON FUNCTION public.public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated;
