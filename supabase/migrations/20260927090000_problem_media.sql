-- Media attached to problem reports: photos, short videos and PDFs that show a
-- barrier rather than only describe it.
--
-- Files live in the public `problem-media` Storage bucket under
-- <uploader id>/<problem id>/<file>. Each file also gets a row here carrying
-- its text alternative. On an accessibility platform an image without alt text,
-- or a video nobody has described, is itself a barrier, so the description is
-- required for images and video. PDFs carry their own text.
--
-- Deleting a problem cascades to these rows but not to the Storage objects:
-- Supabase does not allow deleting from storage.objects in SQL, only through
-- the Storage API. The client removes the object before the row; files
-- orphaned by a cascade are cleaned up from the dashboard.

CREATE TYPE public.media_kind AS ENUM ('image', 'video', 'document');

CREATE TABLE public.problem_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.media_kind NOT NULL,
  storage_path text NOT NULL UNIQUE CHECK (char_length(storage_path) BETWEEN 3 AND 500),
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The kind must agree with the file type. SVG is deliberately absent: it can
  -- carry script, and these files are served to anyone.
  CONSTRAINT problem_media_kind_mime CHECK (
    (kind = 'image' AND mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif'))
    OR (kind = 'video' AND mime_type IN ('video/mp4', 'video/webm'))
    OR (kind = 'document' AND mime_type = 'application/pdf')
  ),
  CONSTRAINT problem_media_described CHECK (
    kind = 'document' OR char_length(btrim(description)) >= 1
  )
);

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated. Revoke first so the grants below are the whole story, and the
-- column lists actually restrict what the API can write.
REVOKE ALL ON public.problem_media FROM anon, authenticated;
GRANT SELECT ON public.problem_media TO anon, authenticated;
GRANT DELETE ON public.problem_media TO authenticated;
-- id and created_at belong to the database.
GRANT INSERT (problem_id, user_id, kind, storage_path, file_name, mime_type,
              size_bytes, description)
  ON public.problem_media TO authenticated;
-- Only the description can change after upload; the file itself is replaced by
-- deleting and re-adding, so path, type and size stay true to the object.
GRANT UPDATE (description) ON public.problem_media TO authenticated;
GRANT ALL ON public.problem_media TO service_role;
ALTER TABLE public.problem_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "problem_media_read_all" ON public.problem_media
  FOR SELECT TO anon, authenticated USING (true);

-- Only the problem's author attaches media, and only files from their own
-- folder for this problem, so nobody can point a row at someone else's upload.
CREATE POLICY "problem_media_insert_author" ON public.problem_media
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND split_part(storage_path, '/', 1) = auth.uid()::text
    AND split_part(storage_path, '/', 2) = problem_id::text
    AND EXISTS (
      SELECT 1 FROM public.problems p
      WHERE p.id = problem_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "problem_media_update_own" ON public.problem_media
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "problem_media_delete_own_or_mod" ON public.problem_media
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_moderator());

CREATE INDEX idx_problem_media_problem ON public.problem_media (problem_id, created_at);

-- A cap per problem keeps one report from becoming free file hosting.
CREATE OR REPLACE FUNCTION public.enforce_problem_media_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.problem_media WHERE problem_id = NEW.problem_id) >= 20 THEN
    RAISE EXCEPTION 'A problem can have at most 20 attached files'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_problem_media_limit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_problem_media_limit
  BEFORE INSERT ON public.problem_media
  FOR EACH ROW EXECUTE FUNCTION public.enforce_problem_media_limit();

-- STORAGE ---------------------------------------------------------------
-- Public bucket: problems are readable without an account, so their media are
-- too. The size and type limits are enforced by Storage itself, not only by
-- the upload form.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'problem-media',
  'problem-media',
  true,
  26214400,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Uploads go only into <own id>/<a problem the uploader wrote>/. Checking the
-- top-level folder alone would let any member store any number of files in a
-- public bucket under their own id, attached to nothing: free file hosting.
-- The row trigger above caps files per problem, but only once a row exists.
CREATE POLICY "problem_media_objects_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'problem-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.problems p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.user_id = auth.uid()
    )
  );

-- The Storage API needs SELECT as well as DELETE to remove an object. Public
-- URLs do not go through these policies, so this does not limit viewing.
CREATE POLICY "problem_media_objects_select_own_or_mod" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'problem-media'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_moderator())
  );

CREATE POLICY "problem_media_objects_delete_own_or_mod" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'problem-media'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_moderator())
  );
