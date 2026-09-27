import { useCallback, useEffect, useRef, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import Layout from "@/components/layout/Layout";
import TwoFactorChallenge from "@/components/auth/TwoFactorChallenge";
import FormAlert from "@/components/auth/FormAlert";
import { friendlyAuthError, isInsufficientAal } from "@/components/auth/auth-errors";
import { cn } from "@/lib/utils";

interface Enrollment {
  factorId: string;
  qr: string;
  secret: string;
}

const Security = () => {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  // The factor waiting for a fresh code before the server will remove it.
  const [stepUpFor, setStepUpFor] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  // Each view swap removes the control that had focus; this says where it goes.
  const [focusSummary, setFocusSummary] = useState(false);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const inFlight = useRef(false);
  const loadRequest = useRef(0);

  useDocumentTitle("Account security");

  const loadFactors = useCallback(async () => {
    const id = ++loadRequest.current;
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (id !== loadRequest.current) return;
    setLoading(false);
    if (error) {
      setLoadError(friendlyAuthError(error, "Could not load your security settings. Please try again."));
      return;
    }
    setLoadError(null);
    setFactors(data?.all ?? []);
  }, []);

  useEffect(() => {
    // Bumping the shared counter on unmount drops an answer still in flight.
    const requests = loadRequest;
    void loadFactors();
    return () => {
      requests.current++;
    };
  }, [loadFactors]);

  useEffect(() => {
    if (!focusSummary || loading) return;
    summaryRef.current?.focus();
    setFocusSummary(false);
  }, [focusSummary, loading, factors, enrollment, stepUpFor]);

  /** Runs one request at a time; a second press while one is running is ignored. */
  const guarded = async (work: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const enroll = () =>
    supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator app (${new Date().toLocaleDateString()})`,
    });

  const startEnroll = () =>
    guarded(async () => {
      setSetupError(null);
      let result = await enroll();
      if (result.error) {
        // A setup that was abandoned (tab closed, code never entered) leaves an
        // unverified factor behind. The server refuses a second one with the
        // same name and limits how many can pile up, so clear those and retry.
        const { data: list } = await supabase.auth.mfa.listFactors();
        const stale = (list?.all ?? []).filter(
          (f) => f.factor_type === "totp" && f.status === "unverified",
        );
        if (stale.length > 0) {
          for (const f of stale) await supabase.auth.mfa.unenroll({ factorId: f.id });
          result = await enroll();
        }
      }
      const { data, error } = result;
      if (error || !data || data.type !== "totp") {
        setSetupError(friendlyAuthError(error, "Could not start setting up two-factor authentication. Please try again."));
        return;
      }
      setCode("");
      setFormError(null);
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    });

  const cancelEnroll = () =>
    guarded(async () => {
      if (enrollment) {
        // If this fails the unverified factor is harmless and is cleared the
        // next time setup starts.
        await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
      }
      setEnrollment(null);
      setCode("");
      setFormError(null);
      setFocusSummary(true);
      await loadFactors();
    });

  const confirmEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    const digits = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(digits)) {
      setFormError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    void guarded(async () => {
      setFormError(null);
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code: digits,
      });
      if (error) {
        setFormError(friendlyAuthError(error, "Could not verify that code. Please try again."));
        return;
      }
      toast.success("Two-factor authentication is on");
      setEnrollment(null);
      setCode("");
      setFocusSummary(true);
      await loadFactors();
    });
  };

  /** Resolves to an error sentence, or null once the factor is gone. */
  const unenroll = async (factorId: string): Promise<string | null> => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (!error) {
      toast.success("Two-factor authentication is off");
      setStepUpFor(null);
      setFocusSummary(true);
      await loadFactors();
      return null;
    }
    if (isInsufficientAal(error)) {
      // Removing a verified factor needs a session that has just proved it
      // holds that factor; ask for a code, then try again.
      setStepUpFor(factorId);
      return null;
    }
    return friendlyAuthError(error, "Could not turn off two-factor authentication. Please try again.");
  };

  const confirmRemoval = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // Keep the dialog open until the request settles, so a failure is reported
    // where the person is looking.
    event.preventDefault();
    const factorId = confirmingRemoval;
    if (!factorId) return;
    await guarded(async () => {
      setRemoveError(null);
      const failure = await unenroll(factorId);
      if (failure) {
        setRemoveError(failure);
        return;
      }
      setConfirmingRemoval(null);
    });
  };

  const verifiedFactors = factors.filter((f) => f.status === "verified");

  let body: React.ReactNode;
  if (loading) {
    body = (
      <p role="status" className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading your
        settings…
      </p>
    );
  } else if (loadError) {
    body = (
      <div className="mt-6 space-y-3">
        <FormAlert message={loadError} />
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => {
            setLoading(true);
            void loadFactors();
          }}
        >
          Try again
        </Button>
      </div>
    );
  } else if (stepUpFor) {
    body = (
      <div className="mt-6">
        <TwoFactorChallenge
          framed={false}
          headingLevel="h3"
          title="Confirm it's you"
          description="To turn off two-factor authentication, enter the current 6-digit code from your authenticator app."
          submitLabel="Verify and turn off"
          onVerified={async () => {
            const failure = await unenroll(stepUpFor);
            if (failure) toast.error(failure);
          }}
          onCancel={() => {
            setStepUpFor(null);
            setFocusSummary(true);
          }}
        />
      </div>
    );
  } else if (enrollment) {
    body = (
      <form onSubmit={confirmEnroll} className="mt-6 space-y-4" noValidate>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
          <li>Open your authenticator app and scan this QR code.</li>
          <li>Type the 6-digit code it shows to finish setting up.</li>
        </ol>
        <img
          src={enrollment.qr}
          alt="QR code for adding Abilitiverse to your authenticator app. If you cannot scan it, use the setup key below."
          className="h-48 w-48 rounded-lg border border-border bg-white p-2"
        />
        <p className="text-sm text-muted-foreground">
          Can&apos;t scan it? Enter this setup key in your app instead:{" "}
          <code className="break-all rounded bg-secondary px-2 py-1 font-mono text-foreground">
            {enrollment.secret}
          </code>
        </p>
        <FormAlert id="enroll-error" message={formError} />
        <div>
          <label htmlFor="enroll-code" className="mb-1 block text-sm font-medium text-foreground">
            Authentication code
          </label>
          <Input
            id="enroll-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={9}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            disabled={busy}
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? "enroll-error" : undefined}
            className="min-h-11"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" className="min-h-11 flex-1" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{" "}
                Working…
              </>
            ) : (
              "Turn on two-factor authentication"
            )}
          </Button>
          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={cancelEnroll} disabled={busy}>
            Cancel setup
          </Button>
        </div>
      </form>
    );
  } else if (verifiedFactors.length > 0) {
    body = (
      <div className="mt-6 space-y-3">
        <p ref={summaryRef} tabIndex={-1} className="text-sm text-foreground outline-none">
          Two-factor authentication is on. You will be asked for a code from your app each time you sign in.
        </p>
        <ul className="space-y-3">
          {verifiedFactors.map((factor) => (
            <li
              key={factor.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-foreground [overflow-wrap:anywhere]">
                <Smartphone className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {factor.friendly_name || "Authenticator app"}: active
              </span>
              <AlertDialog
                open={confirmingRemoval === factor.id}
                onOpenChange={(open) => {
                  if (busy) return;
                  setRemoveError(null);
                  setConfirmingRemoval(open ? factor.id : null);
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="min-h-11" disabled={busy}>
                    <ShieldOff className="mr-1 h-4 w-4" aria-hidden="true" /> Turn off
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Turn off two-factor authentication?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Signing in will need only your password again, so anyone who learns it can get into
                      your account. You can turn it back on at any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <FormAlert message={removeError} />
                  <AlertDialogFooter>
                    <AlertDialogCancel className="min-h-11" disabled={busy}>
                      Keep it on
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className={cn(buttonVariants({ variant: "destructive" }), "min-h-11")}
                      onClick={confirmRemoval}
                      disabled={busy}
                    >
                      {busy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{" "}
                          Turning off…
                        </>
                      ) : (
                        "Turn off"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      </div>
    );
  } else {
    body = (
      <div className="mt-6 space-y-3">
        <p ref={summaryRef} tabIndex={-1} className="text-sm text-foreground outline-none">
          Two-factor authentication is off.
        </p>
        <FormAlert id="setup-error" message={setupError} />
        <Button className="min-h-11" onClick={startEnroll} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{" "}
              Preparing…
            </>
          ) : (
            "Set up two-factor authentication"
          )}
        </Button>
      </div>
    );
  }

  return (
    <Layout>
      <div className="container max-w-2xl py-10">
        <h1 className="font-heading text-3xl font-bold text-foreground">Account security</h1>
        <p className="mt-2 text-muted-foreground">
          Add a second step when you sign in, so your account stays safe even if your password is stolen.
        </p>

        <section className="mt-8 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="twofa-heading">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="twofa-heading" className="text-lg font-semibold text-foreground">
                Two-factor authentication
              </h2>
              <p className="text-sm text-muted-foreground">
                Use an authenticator app such as Google Authenticator, Microsoft Authenticator, or 1Password.
              </p>
            </div>
          </div>
          {body}
        </section>
      </div>
    </Layout>
  );
};

export default Security;
