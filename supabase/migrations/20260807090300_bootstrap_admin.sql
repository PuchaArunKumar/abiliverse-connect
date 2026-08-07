-- Bootstrap administrator.
--
-- user_roles has no self-insert policy on purpose, so nobody can grant
-- themselves 'admin' through the API. That leaves a chicken-and-egg problem:
-- the first admin has to come from a migration. This grants it to a single
-- known address, and covers both orders of events — the account may already
-- exist, or it may be created later.

-- Case 1: the account already exists.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'abilitiverse@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Case 2: the account is created later. Extends the signup trigger from
-- 20260807090000 so the bootstrap address is promoted on sign-up.
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'volunteer')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF lower(NEW.email) = 'abilitiverse@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;

-- Once that account is signed in, further admins are granted through the
-- user_roles table under the existing "roles_admin_write" policy. Removing the
-- address from this function later does not revoke the role already granted.
