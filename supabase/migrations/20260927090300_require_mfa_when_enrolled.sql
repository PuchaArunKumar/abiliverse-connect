-- Two-factor authentication that the database actually enforces.
--
-- Signing in with a password gives a session at assurance level aal1; using
-- the authenticator app as well raises it to aal2. Until now the app asked for
-- the code, but every policy checked only who the user was. Someone holding a
-- member's password could skip the app, ask Supabase Auth for a token
-- directly, and read and write everything that member can. Nothing in the
-- project settings closes that; only row level security can.
--
-- The rule: a member who has turned on two-factor authentication has, at
-- aal1, exactly the powers of a signed-out visitor. Members who have not
-- turned it on are unaffected. The app treats such a session as signed out
-- until the code is entered, so the database and the interface agree.
--
-- This file runs last on purpose: it covers every table the earlier
-- migrations create, and fails if one was missed (see the check at the end).
-- A migration that adds a table after this one must add the same policies.

-- True when the session may act as its user: either it has passed the second
-- factor, or the user has no verified factor to pass. Anonymous callers have
-- no factors, so it is true for them; the policies below only apply to the
-- authenticated role anyway.
--
-- SECURITY DEFINER because auth.mfa_factors is not readable by the API roles,
-- so a policy that queried it directly would fail with "permission denied".
-- It only ever answers about the caller's own session.
CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      OR NOT EXISTS (
        SELECT 1
        FROM auth.mfa_factors f
        WHERE f.user_id = auth.uid()
          AND f.status = 'verified'
      );
$$;

REVOKE ALL ON FUNCTION public.mfa_satisfied() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_satisfied() TO anon, authenticated, service_role;

-- ROLES -----------------------------------------------------------------
-- Admin and moderator powers are the ones most worth a stolen password, so a
-- role counts only once the second factor has been used. At aal1 these return
-- false, and every policy built on them falls back to what a member without
-- the role may do (and the restrictive policies below narrow that further).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mfa_satisfied()
     AND EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = _user_id AND role = _role
     );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mfa_satisfied()
     AND public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.mfa_satisfied()
     AND (public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'moderator'));
$$;

-- CREATE OR REPLACE keeps the grants from 20260807090000; restated so this
-- file stands on its own. has_role() stays internal.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_moderator() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO anon, authenticated;

-- CONTACT MESSAGES ------------------------------------------------------
-- Visitors can write in too, so an aal1 session still may. What it must not
-- do is have the message filed under the account: "please turn off two-factor
-- on my account", arriving from the account itself, is exactly what someone
-- with only the password would send.
ALTER TABLE public.contact_messages
  ALTER COLUMN user_id SET DEFAULT (CASE WHEN public.mfa_satisfied() THEN auth.uid() END);

-- TABLES ----------------------------------------------------------------
-- A restrictive policy is ANDed with the others instead of adding a way in,
-- so these narrow what each existing policy allows without restating it.
-- (SELECT public.mfa_satisfied()) is evaluated once per statement, not per row.
--
-- Tables a visitor cannot read get one policy for every command, reads
-- included. Tables a visitor can read (the public record and catalogue) are
-- left readable and get one policy per kind of write.
DO $$
DECLARE
  _member_only text[] := ARRAY[
    'profiles', 'posts', 'post_likes', 'post_comments', 'job_applications',
    'user_roles',
    'problem_votes', 'problem_bookmarks', 'problem_reports', 'problem_revisions',
    'newsletter_subscribers', 'contact_messages',
    'pitch_supports', 'pitch_interests',
    'companion_routines', 'companion_completions'
  ];
  _public_read text[] := ARRAY[
    'jobs', 'courses', 'events',
    'problems', 'problem_comments', 'problem_media',
    'pitches', 'pitch_feedback'
  ];
  _table text;
  _command text;
BEGIN
  FOREACH _table IN ARRAY _member_only LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT public.mfa_satisfied())) '
      'WITH CHECK ((SELECT public.mfa_satisfied()))',
      'mfa_required', _table
    );
  END LOOP;

  FOREACH _table IN ARRAY _public_read LOOP
    FOREACH _command IN ARRAY ARRAY['insert', 'update', 'delete'] LOOP
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s',
        'mfa_required_' || _command,
        _table,
        upper(_command),
        CASE _command
          WHEN 'insert' THEN 'WITH CHECK ((SELECT public.mfa_satisfied()))'
          WHEN 'update' THEN 'USING ((SELECT public.mfa_satisfied())) '
                             'WITH CHECK ((SELECT public.mfa_satisfied()))'
          ELSE 'USING ((SELECT public.mfa_satisfied()))'
        END
      );
    END LOOP;
  END LOOP;
END;
$$;

-- STORAGE ---------------------------------------------------------------
-- storage.objects holds every bucket, so the rule is scoped to this one and
-- leaves the others as they are. It covers reads as well as writes: a
-- visitor cannot list the bucket through the API either (public URLs do not
-- go through policies, so viewing is unaffected).
CREATE POLICY "problem_media_objects_mfa_required" ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id <> 'problem-media' OR (SELECT public.mfa_satisfied()))
  WITH CHECK (bucket_id <> 'problem-media' OR (SELECT public.mfa_satisfied()));

-- COVERAGE CHECK --------------------------------------------------------
-- The promise above is "exactly what a visitor sees", so this refuses to
-- finish if any public table has no MFA policy, or if a table is filed under
-- the wrong list: one a visitor can read that got a read-blocking policy, or
-- one a visitor cannot read whose reads were left open.
DO $$
DECLARE
  _uncovered text;
  _misfiled text;
BEGIN
  SELECT string_agg(t.tablename, ', ' ORDER BY t.tablename)
  INTO _uncovered
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = t.tablename
        AND p.policyname IN ('mfa_required', 'mfa_required_insert')
    );
  IF _uncovered IS NOT NULL THEN
    RAISE EXCEPTION 'Tables without an MFA policy: %', _uncovered;
  END IF;

  SELECT string_agg(t.tablename, ', ' ORDER BY t.tablename)
  INTO _misfiled
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND (
      has_table_privilege('anon', format('public.%I', t.tablename), 'SELECT')
      AND EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = t.tablename
          AND p.permissive = 'PERMISSIVE'
          AND p.cmd IN ('SELECT', 'ALL')
          AND p.roles && ARRAY['anon', 'public']::name[]
      )
    ) = EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = t.tablename
        AND p.policyname = 'mfa_required'
    );
  IF _misfiled IS NOT NULL THEN
    RAISE EXCEPTION 'MFA policy does not match what a visitor can read on: %', _misfiled;
  END IF;
END;
$$;
