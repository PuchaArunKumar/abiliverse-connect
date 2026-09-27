-- Backing for two homepage sections that previously showed invented content:
-- a newsletter form that discarded the address it collected, and a stats block
-- with hard-coded numbers.

-- NEWSLETTER ------------------------------------------------------------
-- Addresses are stored trimmed and lower-cased, so the UNIQUE constraint
-- treats Alex@Example.com and alex@example.com as the same person.
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE
    CHECK (char_length(email) BETWEEN 3 AND 320
           AND email ~ '^[^@\s]+@[^@\s]+$'
           AND email = lower(btrim(email))),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated. Revoke first so the grants below are the whole story.
--
-- Nobody writes to the table directly; subscribing goes through
-- subscribe_to_newsletter() below. A direct INSERT answers a repeat address
-- with 409 "Key (email)=(...) already exists" and a new one with 201, so the
-- endpoint would tell anyone whether a given person is subscribed. It would
-- also accept a JSON array of thousands of other people's addresses in one
-- request. Reading and removing entries is for admins only: without that
-- asymmetry the list is a harvestable mailing list for any visitor holding
-- the publishable key, which is public by design.
REVOKE ALL ON public.newsletter_subscribers FROM anon, authenticated;
GRANT SELECT, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newsletter_read_admin" ON public.newsletter_subscribers
  FOR SELECT TO authenticated USING (public.is_admin());

-- So a request to be taken off the list can be honoured from the app.
CREATE POLICY "newsletter_delete_admin" ON public.newsletter_subscribers
  FOR DELETE TO authenticated USING (public.is_admin());

-- The only way in. It answers the same way whether or not the address was
-- already on the list, so it cannot be used to test someone's subscription,
-- and it takes one address per call. An address that does not look like one
-- is refused with check_violation (23514), which the form can explain.
--
-- Nothing is sent to anyone yet. Before the list is ever mailed it needs a
-- confirmation step (double opt-in) and an unsubscribe link, because anyone
-- can type anyone's address here.
CREATE OR REPLACE FUNCTION public.subscribe_to_newsletter(_email text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _address text := lower(btrim(coalesce(_email, '')));
BEGIN
  IF char_length(_address) NOT BETWEEN 3 AND 320
     OR _address !~ '^[^@\s]+@[^@\s]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.newsletter_subscribers (email)
  VALUES (_address)
  ON CONFLICT (email) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.subscribe_to_newsletter(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_to_newsletter(text) TO anon, authenticated;

-- PUBLIC STATS ----------------------------------------------------------
-- Aggregate counts for the homepage. SECURITY DEFINER so it can count
-- `profiles`, which anonymous visitors cannot read row-by-row — this returns
-- only totals, never rows, so no profile data is exposed.
--
-- Country is free text, so "India", "india" and " India" are one country
-- here. Spellings that differ in more than case and spacing ("IN", "Bharat")
-- still count separately; storing an ISO code would fix that for good.
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
    (SELECT count(DISTINCT lower(btrim(country)))
       FROM public.problems
      WHERE btrim(country) <> ''),
    (SELECT count(*) FROM public.events);
$$;

REVOKE ALL ON FUNCTION public.public_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated;
