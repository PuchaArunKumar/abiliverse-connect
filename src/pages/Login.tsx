import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Accessibility, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import TwoFactorChallenge from "@/components/auth/TwoFactorChallenge";
import FormAlert from "@/components/auth/FormAlert";
import { friendlyAuthError } from "@/components/auth/auth-errors";
import { appUrl, safeNext } from "@/lib/url";

// Google sign-in goes through Lovable's OAuth broker at the root-relative path
// /~oauth/initiate, which only exists on Lovable hosting. A sub-path build
// (GitHub Pages) would send people to a 404 outside the site, so the button is
// offered only on the root build.
const GOOGLE_SIGN_IN_AVAILABLE = import.meta.env.BASE_URL === "/";

const Login = () => {
  const { user, loading: authLoading, mfaRequired, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusEmail, setFocusEmail] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  // Set when the sign-in happened on this page, so arriving here already
  // signed in redirects quietly instead of announcing a sign-in.
  const signedInHere = useRef(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  useDocumentTitle(mfaRequired ? "Two-factor verification" : "Sign in");

  // One exit for every route in: password, a verified 2FA code, a Google
  // popup, or opening /login while already signed in. The context flips
  // `user` only once the session is fully authenticated, so navigating here
  // (rather than straight after the API call) cannot race ProtectedRoute.
  useEffect(() => {
    if (authLoading || !user) return;
    if (signedInHere.current) toast.success("Signed in successfully");
    navigate(next, { replace: true });
  }, [authLoading, user, next, navigate]);

  // After cancelling the code prompt, the form comes back; start it at the
  // email field rather than leaving focus on the removed Cancel button.
  useEffect(() => {
    if (focusEmail && emailRef.current) {
      emailRef.current.focus();
      setFocusEmail(false);
    }
  }, [focusEmail, mfaRequired, authLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(friendlyAuthError(signInError, "Could not sign you in. Please try again."));
      return;
    }
    // The auth context now decides: straight in, or the code prompt.
    signedInHere.current = true;
  };

  const handleCancel2fa = async () => {
    const { error: signOutError } = await signOut();
    if (signOutError) {
      toast.error(signOutError.message);
    }
    setPassword("");
    setFocusEmail(true);
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: appUrl(next),
    });
    // A full-page redirect is on its way; leave the buttons disabled.
    if ("redirected" in result && result.redirected) return;
    setSubmitting(false);
    if (result.error) {
      setError(friendlyAuthError(result.error, "Could not start Google sign-in. Please try again."));
      return;
    }
    signedInHere.current = true;
  };

  if (authLoading || user) {
    return (
      <Layout>
        <div
          role="status"
          className="flex min-h-[70vh] items-center justify-center gap-2 px-4 text-muted-foreground"
        >
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {user ? "Signed in. Taking you back…" : "Checking your sign-in…"}
        </div>
      </Layout>
    );
  }

  if (mfaRequired) {
    return (
      <Layout>
        <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
          <TwoFactorChallenge
            onVerified={() => {
              signedInHere.current = true;
            }}
            onCancel={handleCancel2fa}
            cancelLabel="Cancel and sign out"
          />
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
            <h1 className="mt-4 text-xl font-semibold text-foreground">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <FormAlert id="login-error" message={error} />
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">Email</label>
              <Input
                ref={emailRef}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
                aria-describedby={error ? "login-error" : undefined}
                className="min-h-11"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">Password</label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
                aria-describedby={error ? "login-error" : undefined}
                className="min-h-11"
              />
            </div>
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{" "}
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {GOOGLE_SIGN_IN_AVAILABLE && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <span className="w-full border-t border-border" />
                </div>
                <p className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                onClick={handleGoogleLogin}
                disabled={submitting}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </Button>
            </>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              to={next === "/" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`}
              className="font-medium text-primary hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Login;
