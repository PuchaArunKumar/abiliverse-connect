import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import FormAlert from "@/components/auth/FormAlert";
import { friendlyAuthError } from "@/components/auth/auth-errors";

interface Props {
  /** Runs after the code is accepted; the session is then aal2. */
  onVerified: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  /** h1 when the challenge is the whole page, lower when it sits in a section. */
  headingLevel?: "h1" | "h2" | "h3";
  title?: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  /** Draw its own card (standalone pages) or blend into the surrounding one. */
  framed?: boolean;
}

const TwoFactorChallenge = ({
  onVerified,
  onCancel,
  headingLevel = "h1",
  title = "Two-factor verification",
  description = "Enter the 6-digit code from your authenticator app.",
  submitLabel = "Verify and continue",
  cancelLabel = "Cancel",
  framed = true,
}: Props) => {
  const Heading = headingLevel;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [factorsLoaded, setFactorsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every failure so the same message twice is still announced
  // and focus still returns to the field.
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // State updates are async, so a fast double press could start two
  // challenges before `busy` re-renders; the ref closes that gap.
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (!active) return;
      setFactorsLoaded(true);
      if (listError) {
        setError(friendlyAuthError(listError, "Could not load your two-factor settings. Please try again."));
        return;
      }
      const verified = data?.totp?.[0];
      if (verified) {
        setFactorId(verified.id);
      } else {
        setError("There is no authenticator app set up on this account.");
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Put the person back where they can fix it, with the old code selected so
  // typing replaces it. Runs after the field is re-enabled.
  useEffect(() => {
    if (attempt > 0 && !busy) inputRef.current?.select();
  }, [attempt, busy]);

  const fail = (message: string) => {
    setError(message);
    setAttempt((n) => n + 1);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current || !factorId) return;
    const digits = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(digits)) {
      fail("Enter the 6-digit code from your authenticator app.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError || !challenge) {
        fail(friendlyAuthError(challengeError, "Could not start verification. Please try again."));
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: digits,
      });
      if (verifyError) {
        fail(friendlyAuthError(verifyError, "Could not verify that code. Please try again."));
        return;
      }
      await onVerified();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  };

  const disabled = busy || cancelling;
  const errorId = "totp-code-error";

  return (
    <div
      className={cn(
        "w-full space-y-6",
        framed && "max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8",
      )}
    >
      <div className={cn(framed && "text-center")}>
        {framed && <ShieldCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />}
        <Heading className={cn("text-xl font-semibold text-foreground", framed && "mt-4")}>{title}</Heading>
        <p id="totp-code-hint" className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4" noValidate>
        <FormAlert key={attempt} id={errorId} message={error} />
        <div>
          <label htmlFor="totp-code" className="mb-1 block text-sm font-medium text-foreground">
            Authentication code
          </label>
          <Input
            ref={inputRef}
            id="totp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            // Entering the code is the only thing to do on this step.
            autoFocus
            placeholder="123456"
            maxLength={9}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `totp-code-hint ${errorId}` : "totp-code-hint"}
            disabled={disabled || !factorId}
            className="min-h-11"
          />
        </div>
        <Button type="submit" className="min-h-12 w-full" disabled={disabled || !factorId}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{" "}
              Verifying…
            </>
          ) : !factorsLoaded ? (
            "Loading…"
          ) : (
            submitLabel
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-12 w-full"
          onClick={handleCancel}
          disabled={disabled}
        >
          {cancelLabel}
        </Button>
      </form>
    </div>
  );
};

export default TwoFactorChallenge;
