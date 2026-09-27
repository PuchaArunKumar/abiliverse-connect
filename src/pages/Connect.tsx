import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { isMissingSchemaError } from "@/lib/supabase-errors";
import { safeHref } from "@/lib/safe-url";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InlineLoading from "@/components/community/InlineLoading";
import LoadProblem from "@/components/community/LoadProblem";
import { displayName, initialsOf, plural } from "@/components/community/format";
import { useFocusRequest } from "@/components/community/useFocusRequest";

type Profile = Pick<Tables<"profiles">, "id" | "user_id" | "display_name" | "avatar_url" | "bio">;

const PROFILE_COLUMNS = "id, user_id, display_name, avatar_url, bio";
const LIST_HEADING_ID = "connect-list-heading";

type LoadState = "loading" | "ready" | "error" | "unavailable";

const Connect = () => {
  useDocumentTitle("Connect");
  const { user, loading: authLoading } = useAuth();
  // Keyed on the id, not the user object: the auth client hands out a new
  // object on every token refresh and whenever the tab regains focus, which
  // used to swap the whole directory for a spinner and lose the reader's place.
  const userId = user?.id ?? null;
  const requestFocus = useFocusRequest();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retrying, setRetrying] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (): Promise<boolean> => {
    const id = ++requestId.current;
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .order("created_at", { ascending: false });
    if (id !== requestId.current) return false;
    setRetrying(false);
    if (error) {
      setLoadState(isMissingSchemaError(error) ? "unavailable" : "error");
      return false;
    }
    setProfiles(data ?? []);
    setLoadState("ready");
    return true;
  }, []);

  useEffect(() => {
    // Profiles are readable only by signed-in members.
    if (!userId) return;
    void load();
  }, [userId, load]);

  const retry = () => {
    setRetrying(true);
    void load().then((ok) => {
      if (ok) requestFocus(LIST_HEADING_ID);
    });
  };

  const renderDirectory = () => {
    if (loadState === "unavailable") {
      return <FeatureUnavailable feature="The member directory" headingLevel="h2" />;
    }
    return (
      <>
        <h2
          id={LIST_HEADING_ID}
          tabIndex={-1}
          className="mb-1 text-center font-heading text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Members
        </h2>
        <p aria-live="polite" className="mb-6 text-center text-sm text-muted-foreground">
          {loadState === "ready" ? plural(profiles.length, "member", "members") : ""}
        </p>
        {loadState === "loading" ? (
          <InlineLoading label="Loading members…" className="py-12" />
        ) : loadState === "error" ? (
          <div className="mx-auto max-w-md">
            <LoadProblem
              message="We could not load the member directory. Check your connection and try again."
              onRetry={retry}
              retrying={retrying}
            />
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-center text-muted-foreground">No profiles yet. Be the first to join!</p>
        ) : (
          <ul className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {profiles.map((profile) => {
              const name = displayName(profile.display_name);
              const avatar = safeHref(profile.avatar_url);
              return (
                <li key={profile.id} className="min-w-0">
                  <Card className="h-full transition-shadow hover:shadow-md motion-reduce:transition-none">
                    <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                      <Avatar className="h-16 w-16">
                        {/* The name is right below, so the picture adds no
                            information for a screen reader. */}
                        {avatar ? <AvatarImage src={avatar} alt="" /> : null}
                        <AvatarFallback className="bg-secondary text-lg text-primary" aria-hidden="true">
                          {initialsOf(name)}
                        </AvatarFallback>
                      </Avatar>
                      <h3 className="max-w-full font-semibold text-foreground [overflow-wrap:anywhere]">
                        {name}
                      </h3>
                      {profile.bio && (
                        <p className="line-clamp-3 max-w-full text-sm text-muted-foreground [overflow-wrap:anywhere]">
                          {profile.bio}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  };

  return (
    <Layout>
      <section className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-primary">
            <Users className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mb-3 font-heading text-3xl font-bold text-foreground">Connect</h1>
          <p className="mb-10 text-muted-foreground">
            Discover developers, investors, mentors, and advocates in the assistive technology space.
          </p>
        </div>

        {authLoading ? (
          <InlineLoading label="Checking your sign-in…" className="py-12" />
        ) : !user ? (
          <div className="mx-auto max-w-md text-center">
            <p className="mb-4 text-muted-foreground">Sign in to see community profiles.</p>
            <Button asChild className="min-h-11">
              <Link to="/login?next=/connect">Sign in</Link>
            </Button>
          </div>
        ) : (
          renderDirectory()
        )}
      </section>
    </Layout>
  );
};

export default Connect;
