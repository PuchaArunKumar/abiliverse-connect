-- Bootstrap administrator.
--
-- user_roles has no self-insert policy on purpose, so nobody can grant
-- themselves 'admin' through the API. That leaves the question of where the
-- first admin comes from.
--
-- It is deliberately NOT granted by matching an email address on signup.
-- This project has mailer_autoconfirm enabled, so addresses are never
-- verified: anyone could register abilitiverse@gmail.com without owning it and
-- be handed admin by the trigger. Keying a privilege grant on an unverified
-- claim is a privilege-escalation path, not a convenience.
--
-- Instead the first admin is granted by hand, from the SQL editor, which
-- requires Supabase project access that only the owner has.

-- Keep the signup trigger doing exactly one thing: give every new account the
-- baseline role. No privilege decisions here.
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
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- GRANTING THE FIRST ADMIN
--
-- 1. Sign up normally in the app with the account that should be admin.
-- 2. Confirm the account is the one you expect:
--
--      SELECT id, email, created_at FROM auth.users
--      WHERE lower(email) = lower('you@example.com');
--
-- 3. Grant it, in the Supabase SQL editor:
--
--      INSERT INTO public.user_roles (user_id, role)
--      SELECT id, 'admin' FROM auth.users
--      WHERE lower(email) = lower('you@example.com')
--      ON CONFLICT (user_id, role) DO NOTHING;
--
-- After that, further admins are granted in-app under "roles_admin_write".
--
-- Turning on email confirmation in Supabase (Authentication -> Providers ->
-- Email -> Confirm email) is worth doing regardless: without it, any address
-- can be registered by anyone, which affects far more than this grant.
-- ---------------------------------------------------------------------------
