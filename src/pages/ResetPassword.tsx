import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Accessibility, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get("type") === "recovery") {
      setValidSession(true);
    }
    // Also listen for auth state
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setValidSession(true);
      }
    });
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully!");
      navigate("/login");
    }
  };

  if (!validSession) {
    return (
      <Layout>
        <div className="flex min-h-[70vh] items-center justify-center">
          <p className="text-muted-foreground">Invalid or expired reset link.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="text-center">
            <Accessibility className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-4 text-xl font-semibold text-foreground">Set New Password</h1>
          </div>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">New Password</label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-foreground">Confirm Password</label>
              <Input id="confirm" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</> : "Update Password"}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
