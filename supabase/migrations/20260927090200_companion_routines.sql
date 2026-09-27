-- Companion: personal routines broken into small steps, with reminders and a
-- record of what was done each day.
--
-- Built for people who benefit from external structure — cognitive and
-- learning disabilities, ADHD, brain injury, memory loss — and for the
-- caregivers who set routines up with them. Everything here is private to its
-- owner: no other user, and no anonymous visitor, can read a routine.

CREATE TABLE public.companion_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
  -- Ordered, short instructions. One step on screen at a time is easier to
  -- follow than a paragraph.
  steps text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(steps) <= 20
           AND char_length(public.immutable_array_to_string(steps, '')) <= 6000),
  -- Local wall-clock time in the user's own timezone; NULL means "any time".
  remind_at time,
  -- Days the routine runs, 0 = Sunday … 6 = Saturday (JavaScript's getDay()).
  days smallint[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}'
    CHECK (cardinality(days) BETWEEN 1 AND 7 AND days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Supabase's default privileges grant ALL on new public tables to anon and
-- authenticated. Revoke first so the grants below are the whole story.
REVOKE ALL ON public.companion_routines FROM anon, authenticated;
GRANT SELECT, DELETE ON public.companion_routines TO authenticated;
GRANT INSERT (user_id, title, notes, steps, remind_at, days, active)
  ON public.companion_routines TO authenticated;
GRANT UPDATE (title, notes, steps, remind_at, days, active)
  ON public.companion_routines TO authenticated;
GRANT ALL ON public.companion_routines TO service_role;
ALTER TABLE public.companion_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companion_routines_owner_read" ON public.companion_routines
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "companion_routines_owner_insert" ON public.companion_routines
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "companion_routines_owner_update" ON public.companion_routines
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "companion_routines_owner_delete" ON public.companion_routines
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_companion_routines_updated
  BEFORE UPDATE ON public.companion_routines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_companion_routines_user ON public.companion_routines (user_id, remind_at);

-- COMPLETIONS -----------------------------------------------------------
-- One row per routine per day it was done. `completed_on` is the user's local
-- date as the browser sees it, so "today" matches the person's own day rather
-- than the server's UTC one.
CREATE TABLE public.companion_completions (
  routine_id uuid NOT NULL REFERENCES public.companion_routines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (routine_id, completed_on)
);

REVOKE ALL ON public.companion_completions FROM anon, authenticated;
GRANT SELECT, DELETE ON public.companion_completions TO authenticated;
GRANT INSERT (routine_id, user_id, completed_on) ON public.companion_completions TO authenticated;
GRANT ALL ON public.companion_completions TO service_role;
ALTER TABLE public.companion_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companion_completions_owner_read" ON public.companion_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Only for your own routine, and only for a day near today: a week back covers
-- "I forgot to tick it off", and a day ahead covers timezones east of UTC.
CREATE POLICY "companion_completions_owner_insert" ON public.companion_completions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND completed_on BETWEEN current_date - 7 AND current_date + 1
    AND EXISTS (
      SELECT 1 FROM public.companion_routines r
      WHERE r.id = routine_id AND r.user_id = auth.uid()
    )
  );
CREATE POLICY "companion_completions_owner_delete" ON public.companion_completions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_companion_completions_user ON public.companion_completions (user_id, completed_on DESC);
