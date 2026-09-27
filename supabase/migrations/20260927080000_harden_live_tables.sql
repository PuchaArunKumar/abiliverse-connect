-- Hardening for the tables that are already live (the first three
-- migrations). Those files have been applied, so they are corrected here
-- rather than edited: changing an applied migration changes nothing on the
-- database it already ran against.

-- DISPLAY NAMES ---------------------------------------------------------
-- The signup trigger fell back to the email address when no name was given,
-- and every email/password signup gives none. profiles is readable by every
-- signed-in member, and signup is open and auto-confirmed, so anyone could
-- register and list every member's address from the directory or the feed.
-- A member with no name now shows as "Community member" until they choose
-- one; an address is never a safe default.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text := coalesce(
    nullif(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(NEW.raw_user_meta_data->>'name'), ''),
    ''
  );
BEGIN
  -- Some providers put the address in the name field too.
  IF lower(_name) = lower(btrim(coalesce(NEW.email, ''))) THEN
    _name := '';
  END IF;

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, _name);
  RETURN NEW;
END;
$$;

-- CREATE OR REPLACE keeps the existing privileges; restated so this file
-- stands on its own.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Take the addresses back out of the names already published.
UPDATE public.profiles p
SET display_name = ''
FROM auth.users u
WHERE u.id = p.user_id
  AND lower(btrim(p.display_name)) = lower(btrim(u.email));

-- OWNERSHIP -------------------------------------------------------------
-- profiles cascades from auth.users but these did not, so deleting an
-- account left its posts, comments, likes, listings and job applications
-- (cover notes included) behind, bylined "Community member", with nobody
-- able to remove them through the API.
--
-- NOT VALID: rows may already exist whose author is gone, and validating would
-- fail on them. The constraint still checks every new row, and the cascade
-- applies to every account deleted from now on. Once the orphans are cleared,
-- VALIDATE CONSTRAINT can run without blocking writes.
ALTER TABLE public.posts
  ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.post_likes
  ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.events
  ADD CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;

-- Without these, each account deletion scans every one of these tables.
CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts (user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user ON public.post_comments (user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON public.jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_user ON public.job_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_courses_user ON public.courses (user_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON public.events (user_id);

-- WHAT THE API MAY WRITE ------------------------------------------------
-- These tables were granted table-wide INSERT and UPDATE, and Supabase's
-- default privileges had already granted anon ALL on them. The row policies
-- only check whose row it is, so an author could send created_at: 2999-01-01
-- and pin a post, job, course or event to the top of every list for good, or
-- move a comment or application to another post or job.
--
-- Column grants settle it: id and the timestamps belong to the database,
-- user_id is set once on insert, and a comment or application keeps the post
-- or job it was written for. The REVOKE comes first because a column grant
-- adds nothing while a table-wide grant is still in place. SELECT goes back to
-- anon only where 20260807090200 made the catalogue public.
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT (user_id, display_name, avatar_url, bio) ON public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, bio) ON public.profiles TO authenticated;

REVOKE ALL ON public.posts FROM anon, authenticated;
GRANT SELECT, DELETE ON public.posts TO authenticated;
GRANT INSERT (user_id, body) ON public.posts TO authenticated;
GRANT UPDATE (body) ON public.posts TO authenticated;

REVOKE ALL ON public.post_likes FROM anon, authenticated;
GRANT SELECT, DELETE ON public.post_likes TO authenticated;
GRANT INSERT (post_id, user_id) ON public.post_likes TO authenticated;

REVOKE ALL ON public.post_comments FROM anon, authenticated;
GRANT SELECT, DELETE ON public.post_comments TO authenticated;
GRANT INSERT (post_id, user_id, body) ON public.post_comments TO authenticated;
GRANT UPDATE (body) ON public.post_comments TO authenticated;

REVOKE ALL ON public.jobs FROM anon, authenticated;
GRANT SELECT ON public.jobs TO anon, authenticated;
GRANT DELETE ON public.jobs TO authenticated;
GRANT INSERT (user_id, title, company, location, description, accessibility_tags,
              apply_url, remote)
  ON public.jobs TO authenticated;
GRANT UPDATE (title, company, location, description, accessibility_tags,
              apply_url, remote)
  ON public.jobs TO authenticated;

-- An application is withdrawn and sent again rather than edited; there has
-- never been an UPDATE policy for it.
REVOKE ALL ON public.job_applications FROM anon, authenticated;
GRANT SELECT, DELETE ON public.job_applications TO authenticated;
GRANT INSERT (job_id, user_id, cover_note) ON public.job_applications TO authenticated;

REVOKE ALL ON public.courses FROM anon, authenticated;
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT DELETE ON public.courses TO authenticated;
GRANT INSERT (user_id, title, description, provider, url, level, tags)
  ON public.courses TO authenticated;
GRANT UPDATE (title, description, provider, url, level, tags)
  ON public.courses TO authenticated;

REVOKE ALL ON public.events FROM anon, authenticated;
GRANT SELECT ON public.events TO anon, authenticated;
GRANT DELETE ON public.events TO authenticated;
GRANT INSERT (user_id, kind, title, description, starts_at, location, link)
  ON public.events TO authenticated;
GRANT UPDATE (kind, title, description, starts_at, location, link)
  ON public.events TO authenticated;

-- MODERATION ------------------------------------------------------------
-- Deletion was owner-only, so spam from an account that is still active
-- could only be removed from the dashboard. Moderators already remove problem
-- comments; the same applies to the feed and the catalogue.
CREATE POLICY "posts_delete_mod" ON public.posts
  FOR DELETE TO authenticated USING (public.is_moderator());
CREATE POLICY "comments_delete_mod" ON public.post_comments
  FOR DELETE TO authenticated USING (public.is_moderator());
CREATE POLICY "jobs_delete_mod" ON public.jobs
  FOR DELETE TO authenticated USING (public.is_moderator());
CREATE POLICY "courses_delete_mod" ON public.courses
  FOR DELETE TO authenticated USING (public.is_moderator());
CREATE POLICY "events_delete_mod" ON public.events
  FOR DELETE TO authenticated USING (public.is_moderator());

-- LINKS -----------------------------------------------------------------
-- These render as links. Only http(s) or nothing: a javascript: or data: URL
-- would run in the session of whoever clicks it. The pages check too, but the
-- database is the one place every writer passes through.
--
-- NOT VALID so an existing bad value does not stop the migration; it is
-- checked again, and refused, the next time its row is written.
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_apply_url_http CHECK (
    apply_url = ''
    OR (apply_url ~* '^https?://[^\s]+$' AND char_length(apply_url) <= 2048)
  ) NOT VALID;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_url_http CHECK (
    url = ''
    OR (url ~* '^https?://[^\s]+$' AND char_length(url) <= 2048)
  ) NOT VALID;
ALTER TABLE public.events
  ADD CONSTRAINT events_link_http CHECK (
    link = ''
    OR (link ~* '^https?://[^\s]+$' AND char_length(link) <= 2048)
  ) NOT VALID;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_url_http CHECK (
    avatar_url = ''
    OR (avatar_url ~* '^https?://[^\s]+$' AND char_length(avatar_url) <= 2048)
  ) NOT VALID;

-- CONTACT ---------------------------------------------------------------
-- Messages from the contact page. They carry a name and an address and are
-- often about someone's own access needs, so nobody reads them back through
-- the API except an admin, and nobody writes them except through
-- send_contact_message() below, which checks what it stores.
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The sender's account when they were signed in, for context in a reply.
  -- Deleting the account deletes what it sent.
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  email text NOT NULL
    CHECK (char_length(email) BETWEEN 3 AND 320 AND email ~ '^[^@\s]+@[^@\s]+$'),
  topic text NOT NULL DEFAULT '' CHECK (char_length(topic) <= 100),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.contact_messages FROM anon, authenticated;
GRANT SELECT, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_messages_read_admin" ON public.contact_messages
  FOR SELECT TO authenticated USING (public.is_admin());
-- Once a message has been dealt with there is no reason to keep someone's
-- details around.
CREATE POLICY "contact_messages_delete_admin" ON public.contact_messages
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE INDEX idx_contact_messages_created ON public.contact_messages (created_at DESC);

-- Anyone may write in, signed in or not. Each field is trimmed and checked
-- here rather than trusted from the form, and a bad value is refused with
-- check_violation (23514) and a sentence the page can show as it is. user_id
-- is not a parameter: it comes from the column default, so nobody can send a
-- message in another member's name.
CREATE OR REPLACE FUNCTION public.send_contact_message(
  _name text,
  _email text,
  _topic text,
  _message text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean_name text := btrim(coalesce(_name, ''));
  _clean_email text := btrim(coalesce(_email, ''));
  _clean_topic text := btrim(coalesce(_topic, ''));
  _clean_message text := btrim(coalesce(_message, ''));
BEGIN
  IF char_length(_clean_name) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Enter your name, up to 200 characters.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(_clean_email) NOT BETWEEN 3 AND 320
     OR _clean_email !~ '^[^@\s]+@[^@\s]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(_clean_topic) > 100 THEN
    RAISE EXCEPTION 'Keep the topic to 100 characters or fewer.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(_clean_message) NOT BETWEEN 10 AND 5000 THEN
    RAISE EXCEPTION 'Write a message between 10 and 5000 characters.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.contact_messages (name, email, topic, message)
  VALUES (_clean_name, _clean_email, _clean_topic, _clean_message);
END;
$$;

REVOKE ALL ON FUNCTION public.send_contact_message(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_contact_message(text, text, text, text)
  TO anon, authenticated;
