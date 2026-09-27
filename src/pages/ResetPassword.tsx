import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Accessibility, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import TwoFactorChallenge from "@/components/auth/TwoFactorChallenge";
import FormAlert from "@/components/auth/FormAlert";
import { friendlyAuthError, isInsufficientAal } from "@/components/auth/auth-errors";
import { clearRecoverySession, isRecoverySession, markRecoverySession } from "@/lib/recovery";

const MIN_PASSWORD_LENGTH = 6;

type Status = "checking" | "invalid" | "stepUp" | "ready";

/** Supabase puts link failures (expired, already used) in the hash or query. */
function linkErrorFromUrl(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const code = hash.get("error_code") ?? query.get("error_code");
  const description = hash.get("error_description") ?? query.get("error_description");
  if (!code && !description) return null;
  return code === "otp_expired"
    ? "This reset link has expired or has already been used."
    : "This reset link did not work.";
}

const ResetPassword = () => {
  const { loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError] = useState(linkErrorFromUrl);
  const [status, setStatus] = useState<Status>(linkError ? "invalid" : "checking");
  const inFlight = useRef(false);
  // Remembered across a step-up so the person does not have to type the new
  // password again after entering their code.
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);
  // The SDK consumes the link (and clears the hash) before this lazily loaded
  // page may have mounted, so the recovery session is recognised by the
  // marker src/lib/recovery.ts took at startup. The event is a backstop for
  // when session storage is unavailable.
  const sawRecovery = useRef(false);

  useDocumentTitle(
    status === "stepUp" ? "Confirm it's you" : status === "invalid" ? "Reset link not valid" : "Choose a new password",
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        sawRecovery.current = true;
        markRecoverySession(session?.access_token);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // The auth context stops loading only after the SDK has processed the link
  // in the URL, so by then the recovery session (if any) is in place.
  useEffect(() => {
    if (authLoading || status !== "checking") return;
    let active = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (active) setStatus("invalid");
        return;
      }
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;
      const fromRecoveryLink = sawRecovery.current || isRecoverySession(session.access_token);
      if (!fromRecoveryLink) {
        setStatus("invalid");
        return;
      }
      // Someone with two-factor authentication must enter a code before the
      // server will accept a new password (it answers "insufficient_aal").
      setStatus(data?.nextLevel === "aal2" && data?.currentLevel !== "aal2" ? "stepUp" : "ready");
    })();
    return () => {
      active = false;
    };
  }, [authLoading, status]);

  const updatePassword = async (newPassword: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        if (isInsufficientAal(updateError)) {
          setPendingPassword(newPassword);
          setStatus("stepUp");
          return;
        }
        setError(friendlyAuthError(updateError, "Could not change your password. Please try again."));
        return;
      }
      setPendingPassword(null);
      // The link has done its job; this session is now an ordinary one.
      clearRecoverySession();
      toast.success("Your password has been changed. You are signed in.");
      navigate("/", { replace: true });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Your new password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    void updatePassword(password);
  };

  const handleVerified = async () => {
    setStatus("ready");
    if (pendingPassword) await updatePassword(pendingPassword);
  };

  const handleCancelStepUp = async () => {
    // Only this device's recovery session, not the account's other devices.
    const { error: signOutError } = await signOut("local");
    if (signOutError) toast.error(signOutError.message);
    navigate("/login", { replace: true });
  };

  if (status === "checking") {
    return (
      <Layout>
        <div
          role="status"
          className="flex min-h-[70vh] items-center justify-center gap-2 px-4 text-muted-foreground"
        >
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Checking your reset link…
        </div>
      </Layout>
    );
  }

  if (status === "invalid") {
    return (
      <Layout>
        <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center shadow-lg sm:p-8">
            <h1 className="text-xl font-semibold text-foreground">This reset link is not valid</h1>
            <p className="text-sm text-muted-foreground">
              {linkError ?? "The link may have expired or been used already."} Reset links work once,
              for a limited time. You can ask for a new one.
            </p>
            <Button asChild className="min-h-11 w-full">
              <Link to="/forgot-password">Send a new reset link</Link>
            </Button>
            <Link to="/login" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  if (status === "stepUp") {
    return (
      <Layout>
        <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
          <TwoFactorChallenge
            title="Confirm it's you"
            description="Your account uses two-factor authentication. Enter the 6-digit code from your authenticator app before choosing a new password."
            submitLabel={pendingPassword ? "Verify and change password" : "Verify and continue"}
            cancelLabel="Cancel and sign out"
            onVerified={handleVerified}
            onCancel={handleCancelStepUp}
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
            <Accessibility className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-semibold text-foreground">Choose a new password</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <FormAlert id="reset-error" message={error} />
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
                New password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                disabled={submitting}
                aria-describedby={error ? "password-hint reset-error" : "password-hint"}
                className="min-h-11"
              />
              <p id="password-hint" className="mt-1 text-sm text-muted-foreground">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-foreground">
                Confirm new password
              </label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={submitting}
                aria-describedby={error ? "reset-error" : undefined}
                className="min-h-11"
              />
            </div>
            <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{" "}
                  Changing password…
                </>
              ) : (
                "Change password"
              )}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
