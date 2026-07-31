import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

interface Props {
  onVerified: () => void;
  onCancel: () => void;
}

const TwoFactorChallenge = ({ onVerified, onCancel }: Props) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (error) {
        toast.error(error.message);
        return;
      }
      const verified = data?.totp?.[0];
      if (verified) setFactorId(verified.id);
    });
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setLoading(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setLoading(false);
      toast.error(challengeError?.message ?? "Could not start verification");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onVerified();
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
      <div className="text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-foreground">Two-factor verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="totp-code" className="mb-1 block text-sm font-medium text-foreground">
            Authentication code
          </label>
          <Input
            id="totp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <Button type="submit" className="w-full min-h-12" disabled={loading || code.trim().length < 6}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
            </>
          ) : (
            "Verify and continue"
          )}
        </Button>
        <Button type="button" variant="outline" className="w-full min-h-12" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </form>
    </div>
  );
};

export default TwoFactorChallenge;