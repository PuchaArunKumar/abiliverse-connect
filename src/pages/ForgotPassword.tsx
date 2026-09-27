import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accessibility, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import Layout from "@/components/layout/Layout";
import FormAlert from "@/components/auth/FormAlert";
import { friendlyAuthError } from "@/components/auth/auth-errors";
import { appUrl } from "@/lib/url";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const inFlight = useRef(false);

  useDocumentTitle("Reset your password");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    const address = email.trim();
    if (!address) {
      setError("Enter the email address you use to sign in.");
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: appUrl("/reset-password"),
      });
      if (resetError) {
        setError(friendlyAuthError(resetError, "Could not send the reset email. Please try again."));
        return;
      }
      setSentTo(address);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
          <div className="text-center">
            <Accessibility className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-semibold text-foreground">Reset your password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email address and we will send you a link to choose a new password.
            </p>
          </div>

          {sentTo ? (
            <div role="status" className="space-y-3 rounded-md border border-border bg-secondary/40 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <MailCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                Check your email
              </p>
              {/* The server answers the same way whether or not the address has
                  an account, so the message cannot promise that an email went out. */}
              <p className="text-muted-foreground [overflow-wrap:anywhere]">
                If an account uses {sentTo}, a reset link is on its way. It can take a few minutes;
                check your spam folder too.
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                onClick={() => setSentTo(null)}
              >
                Use a different email address
              </Button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4" noValidate>
              <FormAlert id="forgot-error" message={error} />
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "forgot-error" : undefined}
                  className="min-h-11"
                />
              </div>
              <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{" "}
                    Sending…
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          )}

          <Link
            to="/login"
            className="flex min-h-11 items-center justify-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to sign in
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default ForgotPassword;
