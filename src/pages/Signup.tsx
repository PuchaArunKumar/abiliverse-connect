import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Accessibility, Loader2, MailCheck } from "lucide-react";
import Layout from "@/components/layout/Layout";
import FormAlert from "@/components/auth/FormAlert";
import { friendlyAuthError } from "@/components/auth/auth-errors";
import { appUrl, safeNext } from "@/lib/url";

const MIN_PASSWORD_LENGTH = 6;

const Signup = () => {
  const { user, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmailFor, setCheckEmailFor] = useState<string | null>(null);
  const signedUpHere = useRef(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const loginHref = next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  useDocumentTitle("Create an account");

  // When the project confirms addresses automatically, signUp returns a live
  // session. Wait for the auth context to accept it, then continue to `next`.
  useEffect(() => {
    if (authLoading || !user) return;
    if (signedUpHere.current) toast.success("Welcome to Abilitiverse. Your account is ready.");
    navigate(next, { replace: true });
  }, [authLoading, user, next, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    setSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      // The signup trigger copies full_name into the public profile. Without
      // it the profile has no name at all; the email address is never used.
      options: {
        emailRedirectTo: appUrl(next),
        data: displayName.trim() ? { full_name: displayName.trim().slice(0, 120) } : {},
      },
    });
    setSubmitting(false);
    if (signUpError) {
      // "User already registered" would confirm to anyone that an address
      // has an account here, so it gets the same wording as other failures.
      setError(
        signUpError.code === "user_already_exists"
          ? "Could not create the account. If you already have one, sign in or reset your password."
          : friendlyAuthError(signUpError, "Could not create the account. Please try again."),
      );
      return;
    }
    if (data.session) {
      signedUpHere.current = true;
      return;
    }
    setCheckEmailFor(email);
    setPassword("");
    setConfirmPassword("");
  };

  if (authLoading || user) {
    return (
      <Layout>
        <div
          role="status"
          className="flex min-h-[70vh] items-center justify-center gap-2 px-4 text-muted-foreground"
        >
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {user ? "Signed in. Taking you on…" : "Checking your sign-in…"}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
          <div className="text-center">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-2 font-heading text-2xl font-bold text-foreground"
            >
              <Accessibility className="h-8 w-8 text-primary" aria-hidden="true" />
              Abilitiverse
            </Link>
            <h1 className="mt-4 text-xl font-semibold text-foreground">Create an account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Join the Abilitiverse community</p>
          </div>

          {checkEmailFor ? (
            <div role="status" className="space-y-3 rounded-md border border-border bg-secondary/40 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <MailCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                Check your email
              </p>
              <p className="text-muted-foreground [overflow-wrap:anywhere]">
                We sent a confirmation link to {checkEmailFor}. Open it to finish creating your
                account. If it does not arrive in a few minutes, check your spam folder.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4" noValidate>
              <FormAlert id="signup-error" message={error} />
              <div>
                <label htmlFor="display-name" className="mb-1 block text-sm font-medium text-foreground">
                  Display name <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id="display-name"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={120}
                  disabled={submitting}
                  aria-describedby="display-name-hint"
                  className="min-h-11"
                />
                <p id="display-name-hint" className="mt-1 text-sm text-muted-foreground">
                  Shown to other members. Your email address is never shown.
                </p>
              </div>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">Email</label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  className="min-h-11"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">Password</label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  disabled={submitting}
                  aria-describedby="password-hint"
                  className="min-h-11"
                />
                <p id="password-hint" className="mt-1 text-sm text-muted-foreground">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-foreground">
                  Confirm password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={submitting}
                  className="min-h-11"
                />
              </div>
              <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{" "}
                    Creating account…
                  </>
                ) : (
                  "Sign up"
                )}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to={loginHref} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Signup;
