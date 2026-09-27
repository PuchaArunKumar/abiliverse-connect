import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Accessibility, Loader2 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import FormAlert from "@/components/auth/FormAlert";

/** The host of a URL, or null when it cannot be parsed. */
function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

const StatusLine = ({ children }: { children: React.ReactNode }) => (
  <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
    <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
    {children}
  </p>
);

const OAuthConsent = () => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decideError, setDecideError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const inFlight = useRef(false);
  const userId = user?.id ?? null;

  useDocumentTitle("Connect an app");

  useEffect(() => {
    // Nothing is requested until the person is fully signed in: someone who
    // still owes a two-factor code must not be able to grant access.
    if (!userId) return;
    if (!authorizationId) {
      setLoadError("This link is missing its authorization request. Start the connection again from the app.");
      return;
    }
    let active = true;
    setDetails(null);
    setLoadError(null);
    (async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error || !data) {
        setLoadError(
          "This authorization request could not be loaded. It may have expired; start the connection again from the app.",
        );
        return;
      }
      if (!("authorization_id" in data)) {
        // Already approved earlier: the server hands back the app's return
        // address straight away.
        setLeaving(true);
        window.location.assign(data.redirect_url);
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, userId]);

  const decide = async (approve: boolean) => {
    if (inFlight.current || !details) return;
    inFlight.current = true;
    setBusy(approve ? "approve" : "deny");
    setDecideError(null);
    // skipBrowserRedirect: the SDK would otherwise navigate by itself, before
    // this page could report a missing or failed answer.
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(details.authorization_id, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(details.authorization_id, { skipBrowserRedirect: true });
    if (error || !data?.redirect_url) {
      inFlight.current = false;
      setBusy(null);
      setDecideError(
        approve
          ? "Could not complete the connection. Please try again."
          : "Could not cancel the connection. Please try again, or close this page.",
      );
      return;
    }
    setLeaving(true);
    window.location.assign(data.redirect_url);
  };

  if (!authLoading && !user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const clientName = details?.client.name?.trim() || "An app";
  const clientHost = hostOf(details?.client.uri);
  const redirectHost = hostOf(details?.redirect_uri);
  const scopes = details ? details.scope.split(/\s+/).filter(Boolean) : [];

  let content: React.ReactNode;
  if (authLoading) {
    content = <StatusLine>Checking your sign-in…</StatusLine>;
  } else if (loadError) {
    content = <FormAlert message={loadError} />;
  } else if (leaving) {
    content = <StatusLine>Taking you back to the app…</StatusLine>;
  } else if (!details) {
    content = <StatusLine>Loading the authorization request…</StatusLine>;
  } else {
    content = (
      <>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground [overflow-wrap:anywhere]">{clientName}</span> wants to use
          Abilitiverse tools on your behalf. It can do only what your own account is allowed to do.
        </p>

        {/* An app chooses its own name, so the name proves nothing. Where the
            code is sent is the one detail it cannot fake. */}
        <div className="space-y-1 rounded-md border border-border bg-secondary/40 p-3 text-sm">
          <p className="font-medium text-foreground">
            You will be sent back to{" "}
            <span className="[overflow-wrap:anywhere]">{redirectHost ?? "an address that could not be read"}</span>
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">{details.redirect_uri}</p>
          <p className="text-muted-foreground">
            Only continue if you started this from {clientName} and you recognise this address.
          </p>
        </div>

        <dl className="space-y-2 text-sm">
          {clientHost && (
            <div>
              <dt className="font-medium text-foreground">App website (as the app describes itself)</dt>
              <dd className="text-muted-foreground [overflow-wrap:anywhere]">{clientHost}</dd>
            </div>
          )}
          {details.user.email && (
            <div>
              <dt className="font-medium text-foreground">Signed in as</dt>
              <dd className="text-muted-foreground [overflow-wrap:anywhere]">{details.user.email}</dd>
            </div>
          )}
          {scopes.length > 0 && (
            <div>
              <dt className="font-medium text-foreground">Requested access</dt>
              <dd>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {scopes.map((s) => (
                    <li key={s} className="[overflow-wrap:anywhere]">
                      {s}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>

        <FormAlert message={decideError} />

        <div className="flex flex-col gap-2">
          <Button onClick={() => decide(true)} disabled={busy !== null} className="min-h-11 w-full">
            {busy === "approve" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{" "}
                Approving…
              </>
            ) : (
              "Approve"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => decide(false)}
            disabled={busy !== null}
            className="min-h-11 w-full"
          >
            {busy === "deny" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{" "}
                Cancelling…
              </>
            ) : (
              "Cancel connection"
            )}
          </Button>
        </div>
      </>
    );
  }

  return (
    <Layout>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 font-heading text-2xl font-bold text-foreground">
              <Accessibility className="h-8 w-8 text-primary" aria-hidden="true" />
              Abilitiverse
            </p>
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground [overflow-wrap:anywhere]">
            {details ? `Connect ${clientName} to Abilitiverse?` : "Connect an app to Abilitiverse"}
          </h1>
          {content}
        </div>
      </div>
    </Layout>
  );
};

export default OAuthConsent;
