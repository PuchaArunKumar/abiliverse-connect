import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Accessibility } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { appUrl, basePath } from "@/lib/url";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthClient = { name?: string; client_name?: string; redirect_uri?: string; redirect_uris?: string[] };
type OAuthDetails = {
  client?: OAuthClient;
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult<T> = { data: T | null; error: { message: string } | null };
const oauthApi = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<OAuthResult<OAuthDetails>>;
    approveAuthorization: (id: string) => Promise<OAuthResult<{ redirect_url?: string; redirect_to?: string }>>;
    denyAuthorization: (id: string) => Promise<OAuthResult<{ redirect_url?: string; redirect_to?: string }>>;
  };
}).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname.slice(basePath.length) + window.location.search;
        window.location.href = appUrl("/login?next=" + encodeURIComponent(next));
        return;
      }
      const { data, error } = await oauthApi.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { data, error } = approve
      ? await oauthApi.approveAuthorization(authorizationId)
      : await oauthApi.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  };

  const clientName = details?.client?.client_name ?? details?.client?.name ?? "an external app";
  const redirectUri =
    details?.client?.redirect_uri ?? details?.client?.redirect_uris?.[0] ?? null;
  const scopes =
    details?.scopes ??
    (details?.scope ? details.scope.split(/\s+/).filter(Boolean) : []);

  return (
    <Layout>
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 font-heading text-2xl font-bold text-foreground">
              <Accessibility className="h-8 w-8 text-primary" />
              Abilitiverse
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Could not load this authorization request: {error}
            </div>
          )}

          {!error && !details && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!error && details && (
            <>
              <div>
                <h1 className="font-heading text-xl font-semibold text-foreground">
                  Connect {clientName} to Abilitiverse
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {clientName} will be able to call Abilitiverse tools while you are signed in.
                  This does not bypass Abilitiverse permissions or backend policies.
                </p>
              </div>

              {redirectUri && (
                <div className="rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground break-all">
                  Redirects to: {redirectUri}
                </div>
              )}

              {scopes.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-medium text-foreground">Requested access</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {scopes.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button onClick={() => decide(true)} disabled={busy} className="w-full">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => decide(false)}
                  disabled={busy}
                  className="w-full"
                >
                  Cancel connection
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default OAuthConsent;