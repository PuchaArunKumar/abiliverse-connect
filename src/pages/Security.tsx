import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import Layout from "@/components/layout/Layout";

interface Factor {
  id: string;
  friendly_name?: string;
  status: string;
}

const Security = () => {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const loadFactors = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFactors((data?.all ?? []) as Factor[]);
  }, []);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  const startEnroll = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toLocaleDateString()}`,
    });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not start setup");
      return;
    }
    setPendingFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  };

  const cancelEnroll = async () => {
    if (pendingFactorId) await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
    setEnrolling(false);
    setQr(null);
    setSecret(null);
    setPendingFactorId(null);
    setCode("");
    loadFactors();
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFactorId) return;
    setBusy(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: pendingFactorId,
    });
    if (challengeError || !challenge) {
      setBusy(false);
      toast.error(challengeError?.message ?? "Could not verify code");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: pendingFactorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor authentication is now active");
    setEnrolling(false);
    setQr(null);
    setSecret(null);
    setPendingFactorId(null);
    setCode("");
    loadFactors();
  };

  const removeFactor = async (factorId: string) => {
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor authentication removed");
    loadFactors();
  };

  const verifiedFactors = factors.filter((f) => f.status === "verified");

  return (
    <Layout>
      <div className="container max-w-2xl py-10">
        <h1 className="font-heading text-3xl font-bold text-foreground">Account security</h1>
        <p className="mt-2 text-muted-foreground">
          Add a second step when you sign in, so your account stays safe even if your password is stolen.
        </p>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6" aria-labelledby="twofa-heading">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-6 w-6 text-primary" aria-hidden="true" />
            <div>
              <h2 id="twofa-heading" className="text-lg font-semibold text-foreground">
                Two-factor authentication
              </h2>
              <p className="text-sm text-muted-foreground">
                Use an authenticator app such as Google Authenticator, Authy, or 1Password.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your settings...
            </div>
          ) : enrolling ? (
            <form onSubmit={confirmEnroll} className="mt-6 space-y-4">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
                <li>Open your authenticator app and scan this code.</li>
                <li>Type the 6-digit code it shows to finish setup.</li>
              </ol>
              {qr && (
                <img
                  src={qr}
                  alt="QR code for setting up two-factor authentication in your authenticator app"
                  className="h-48 w-48 rounded-lg border border-border bg-background p-2"
                />
              )}
              {secret && (
                <p className="text-sm text-muted-foreground">
                  Can&apos;t scan? Enter this key manually:{" "}
                  <code className="rounded bg-secondary px-2 py-1 font-mono text-foreground">{secret}</code>
                </p>
              )}
              <div>
                <label htmlFor="enroll-code" className="mb-1 block text-sm font-medium text-foreground">
                  Authentication code
                </label>
                <Input
                  id="enroll-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  disabled={busy}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="min-h-12 flex-1" disabled={busy || code.trim().length < 6}>
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                    </>
                  ) : (
                    "Turn on two-factor"
                  )}
                </Button>
                <Button type="button" variant="outline" className="min-h-12 flex-1" onClick={cancelEnroll} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : verifiedFactors.length > 0 ? (
            <div className="mt-6 space-y-3">
              {verifiedFactors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <Smartphone className="h-4 w-4 text-primary" aria-hidden="true" />
                    {factor.friendly_name || "Authenticator app"} — active
                  </span>
                  <Button
                    variant="outline"
                    className="min-h-12"
                    onClick={() => removeFactor(factor.id)}
                    disabled={busy}
                  >
                    <ShieldOff className="mr-1 h-4 w-4" aria-hidden="true" /> Turn off
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Button className="mt-6 min-h-12" onClick={startEnroll} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparing...
                </>
              ) : (
                "Set up two-factor authentication"
              )}
            </Button>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default Security;