import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/layout/Layout";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import ConfirmDialog from "@/components/pitches/ConfirmDialog";
import FeedbackSection from "@/components/pitches/FeedbackSection";
import InterestInbox from "@/components/pitches/InterestInbox";
import InterestPanel from "@/components/pitches/InterestPanel";
import { fetchDisplayNames } from "@/components/pitches/profile-names";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DISABILITY_TYPE_LABELS,
  classifyLoadError,
  formatDate,
  wasEdited,
} from "@/lib/problems";
import { safeHref } from "@/lib/safe-url";
import { isMissingSchemaError } from "@/lib/supabase-errors";
import {
  PITCH_DETAIL_COLUMNS,
  PITCH_NEED_LABELS,
  PITCH_STAGE_HINTS,
  PITCH_STAGE_LABELS,
  canManagePitch,
  displayNameOr,
  formatFunding,
  friendlyPitchError,
  isPitchId,
  pluralise,
  type LinkedProblem,
  type PitchDetailRow,
} from "@/lib/pitches";

type PageState = "loading" | "ready" | "missing" | "not_found" | "error";

/** A linked problem whose title could not be read keeps an empty title. */
type ProblemLink = LinkedProblem | null;

const PitchDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? null;

  const [state, setState] = useState<PageState>("loading");
  const [pitch, setPitch] = useState<PitchDetailRow | null>(null);
  const [problem, setProblem] = useState<ProblemLink>(null);
  const [founderName, setFounderName] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [supported, setSupported] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportStatus, setSupportStatus] = useState("");
  const [supportError, setSupportError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const supportBusyRef = useRef(false);
  // Counter re-reads can overlap (two quick writes); only the latest applies.
  const countsRequestRef = useRef(0);

  useDocumentTitle(
    state === "loading"
      ? null
      : state === "ready" && pitch
        ? pitch.title
        : state === "missing"
          ? "Pitch Platform"
          : state === "not_found"
            ? "Pitch not found"
            : "Pitch could not be loaded",
  );

  useEffect(() => {
    // Wait for the session, so the page neither loads twice nor shows
    // signed-out controls to someone who is signed in.
    if (authLoading) return;
    if (!isPitchId(id)) {
      setState("not_found");
      return;
    }
    let active = true;
    setState("loading");

    void (async () => {
      const { data, error } = await supabase
        .from("pitches")
        .select(PITCH_DETAIL_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        const failure = classifyLoadError(error);
        setState(failure === "missing" ? "missing" : failure === "not_found" ? "not_found" : "error");
        return;
      }
      if (!data) {
        setState("not_found");
        return;
      }

      const isFounder = userId === data.user_id;
      const [linked, names, moderator, support] = await Promise.all([
        data.problem_id
          ? supabase
              .from("problems")
              .select("id, title")
              .eq("id", data.problem_id)
              .maybeSingle()
              .then(({ data: row, error: problemError }): ProblemLink => {
                // Without the problems table there is no page to link to.
                if (isMissingSchemaError(problemError)) return null;
                if (problemError) return { id: data.problem_id as string, title: "" };
                return row ? { id: row.id, title: row.title } : null;
              })
          : Promise.resolve<ProblemLink>(null),
        userId ? fetchDisplayNames([data.user_id]) : Promise.resolve({} as Record<string, string>),
        userId
          ? supabase.rpc("is_moderator").then(({ data: flag }) => flag === true)
          : Promise.resolve(false),
        userId && !isFounder
          ? supabase
              .from("pitch_supports")
              .select("pitch_id")
              .eq("pitch_id", data.id)
              .eq("user_id", userId)
              .maybeSingle()
              .then(({ data: row }) => Boolean(row))
          : Promise.resolve(false),
      ]);
      if (!active) return;
      setPitch(data);
      setProblem(linked);
      setFounderName(names[data.user_id] ?? null);
      setIsModerator(moderator);
      setSupported(support);
      setSupportStatus("");
      setSupportError(null);
      setState("ready");
    })();

    return () => {
      active = false;
    };
  }, [id, userId, authLoading, reloadTick]);

  /** Re-reads the trigger-maintained counters after a write. */
  const refreshCounts = useCallback(async () => {
    if (!isPitchId(id)) return;
    const requestId = ++countsRequestRef.current;
    const { data } = await supabase
      .from("pitches")
      .select("support_count, feedback_count")
      .eq("id", id)
      .maybeSingle();
    if (!data || requestId !== countsRequestRef.current) return;
    setPitch((prev) =>
      prev && prev.id === id
        ? { ...prev, support_count: data.support_count, feedback_count: data.feedback_count }
        : prev,
    );
  }, [id]);

  const toggleSupport = async () => {
    if (!userId || !pitch || supportBusyRef.current) return;
    supportBusyRef.current = true;
    setSupportBusy(true);
    setSupportError(null);
    const next = !supported;
    const delta = next ? 1 : -1;
    // Show the change at once; the counter is re-read from the database below
    // either way, so a mismatch (another tab, a lost race) does not linger.
    setSupported(next);
    setPitch((prev) =>
      prev ? { ...prev, support_count: Math.max(0, prev.support_count + delta) } : prev,
    );

    const { error } = next
      ? await supabase.from("pitch_supports").insert({ pitch_id: pitch.id, user_id: userId })
      : await supabase
          .from("pitch_supports")
          .delete()
          .eq("pitch_id", pitch.id)
          .eq("user_id", userId);

    // 23505: already supported, e.g. from another tab. The outcome stands.
    if (error && error.code !== "23505") {
      setSupported(!next);
      setPitch((prev) =>
        prev ? { ...prev, support_count: Math.max(0, prev.support_count - delta) } : prev,
      );
      setSupportError(friendlyPitchError(error, "Your support could not be saved. Please try again."));
    } else {
      setSupportStatus(next ? "You back this pitch." : "You no longer back this pitch.");
    }
    await refreshCounts();
    supportBusyRef.current = false;
    setSupportBusy(false);
  };

  const deletePitch = async (): Promise<string | null> => {
    if (!pitch) return null;
    const { data, error } = await supabase
      .from("pitches")
      .delete()
      .eq("id", pitch.id)
      .select("id");
    if (error) return friendlyPitchError(error, "The pitch could not be deleted. Please try again.");
    if (!data || data.length === 0) {
      return "The pitch could not be deleted. You may no longer have permission to delete it.";
    }
    return null;
  };

  if (state === "loading") {
    return (
      <Layout>
        <section className="container max-w-3xl space-y-4 py-8" aria-busy="true">
          <p role="status" className="sr-only">
            Loading pitch
          </p>
          <div aria-hidden="true" className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        </section>
      </Layout>
    );
  }

  if (state === "missing") {
    return (
      <Layout>
        <section className="container py-16">
          <FeatureUnavailable feature="The Pitch Platform" headingLevel="h1" />
        </section>
      </Layout>
    );
  }

  if (state !== "ready" || !pitch) {
    const notFound = state === "not_found";
    return (
      <Layout>
        <section className="container max-w-2xl py-16 text-center">
          <h1 className="mb-3 font-heading text-2xl font-bold">
            {notFound ? "Pitch not found" : "This pitch could not be loaded"}
          </h1>
          <p className="mb-6 text-muted-foreground">
            {notFound
              ? "The link may be mistyped, or the founder may have deleted the pitch."
              : "Check your connection and try again."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {!notFound && (
              <Button className="min-h-11" onClick={() => setReloadTick((t) => t + 1)}>
                Try again
              </Button>
            )}
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/pitches">Back to all pitches</Link>
            </Button>
          </div>
        </section>
      </Layout>
    );
  }

  const isFounder = userId === pitch.user_id;
  const canManage = canManagePitch(userId, pitch, isModerator);
  const website = safeHref(pitch.website_url);
  const demo = safeHref(pitch.demo_url);
  const goal = pitch.needs.includes("funding") ? pitch.funding_goal : null;
  const founder = isFounder ? "you" : displayNameOr(founderName);

  return (
    <Layout>
      <article className="container max-w-3xl py-8">
        <Link
          to="/pitches"
          className="mb-6 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All pitches
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 font-heading text-3xl font-bold text-foreground [overflow-wrap:anywhere]">
            {pitch.title}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              <span className="sr-only">Stage: </span>
              {PITCH_STAGE_LABELS[pitch.stage]}
            </Badge>
            {!pitch.is_open && <Badge variant="outline">Closed to new interest</Badge>}
          </div>
        </div>

        <p className="mt-3 text-lg text-foreground [overflow-wrap:anywhere]">{pitch.tagline}</p>

        <p className="mt-2 text-sm text-muted-foreground">
          Shared by {founder} on {formatDate(pitch.created_at)}
          {wasEdited(pitch.created_at, pitch.updated_at) &&
            ` · Updated ${formatDate(pitch.updated_at)}`}
        </p>

        {canManage && (
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="outline" className="min-h-11">
              <Link to={`/pitches/${pitch.id}/edit`}>
                <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                Edit pitch
              </Link>
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="outline" className="min-h-11 text-destructive">
                  <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                  Delete pitch
                </Button>
              }
              title="Delete this pitch?"
              description="The pitch, its feedback, supporters and interest requests will be deleted for everyone. This cannot be undone."
              confirmLabel="Delete pitch"
              busyLabel="Deleting…"
              onConfirm={deletePitch}
              onDone={() => {
                toast.success("The pitch was deleted.");
                navigate("/pitches");
              }}
            />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p id="pitch-support-count" className="text-sm text-muted-foreground">
            <Heart className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
            {pluralise(pitch.support_count, "person backs", "people back")} this
          </p>
          {isFounder ? (
            <p className="text-sm text-muted-foreground">
              Who backs a pitch is private; you see the total.
            </p>
          ) : userId ? (
            <Button
              variant={supported ? "default" : "outline"}
              className="min-h-11"
              aria-pressed={supported}
              aria-disabled={supportBusy}
              aria-describedby="pitch-support-count"
              onClick={toggleSupport}
            >
              <Heart
                className={`mr-1 h-4 w-4 ${supported ? "fill-current" : ""}`}
                aria-hidden="true"
              />
              I&apos;d use or back this
            </Button>
          ) : (
            <Link
              to={`/login?next=/pitches/${pitch.id}`}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in to back this pitch
            </Link>
          )}
        </div>
        <p role="status" className="sr-only">
          {supportStatus}
        </p>
        <div role="alert">
          {supportError && (
            <p className="mt-2 text-sm font-medium text-destructive">{supportError}</p>
          )}
        </div>

        <Separator className="my-8" />

        <section aria-labelledby="pitch-about-heading" className="space-y-4">
          <h2
            id="pitch-about-heading"
            className="font-heading text-xl font-semibold text-foreground"
          >
            About this pitch
          </h2>
          <p className="whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
            {pitch.description}
          </p>

          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-[max-content_1fr]">
            <dt className="font-medium text-foreground">Stage</dt>
            <dd className="text-foreground">
              {PITCH_STAGE_LABELS[pitch.stage]}.{" "}
              <span className="text-muted-foreground">{PITCH_STAGE_HINTS[pitch.stage]}</span>
            </dd>

            {pitch.needs.length > 0 && (
              <>
                <dt className="font-medium text-foreground">Looking for</dt>
                <dd className="flex flex-wrap gap-2">
                  {pitch.needs.map((need) => (
                    <Badge key={need} variant="outline">
                      {PITCH_NEED_LABELS[need]}
                    </Badge>
                  ))}
                </dd>
              </>
            )}

            {goal !== null && (
              <>
                <dt className="font-medium text-foreground">Funding goal</dt>
                <dd className="text-foreground">
                  {formatFunding(goal, pitch.funding_currency)}.{" "}
                  <span className="text-muted-foreground">
                    Abilitiverse does not process payments; funders contact the
                    founder directly.
                  </span>
                </dd>
              </>
            )}

            {pitch.disability_types.length > 0 && (
              <>
                <dt className="font-medium text-foreground">Who it is for</dt>
                <dd className="flex flex-wrap gap-2">
                  {pitch.disability_types.map((d) => (
                    <Badge key={d} variant="secondary">
                      {DISABILITY_TYPE_LABELS[d]}
                    </Badge>
                  ))}
                </dd>
              </>
            )}

            {problem && (
              <>
                <dt className="font-medium text-foreground">Problem it answers</dt>
                <dd className="[overflow-wrap:anywhere]">
                  <Link
                    to={`/problems/${problem.id}`}
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    {problem.title || "View the linked problem"}
                  </Link>
                </dd>
              </>
            )}

            {website && (
              <>
                <dt className="font-medium text-foreground">Website</dt>
                <dd className="[overflow-wrap:anywhere]">
                  <a
                    href={website}
                    rel="noopener noreferrer nofollow ugc"
                    className="text-primary underline underline-offset-4"
                  >
                    {website}
                  </a>
                </dd>
              </>
            )}

            {demo && (
              <>
                <dt className="font-medium text-foreground">Demo or video</dt>
                <dd className="[overflow-wrap:anywhere]">
                  <a
                    href={demo}
                    rel="noopener noreferrer nofollow ugc"
                    className="text-primary underline underline-offset-4"
                  >
                    {demo}
                  </a>
                </dd>
              </>
            )}

            {pitch.tags.length > 0 && (
              <>
                <dt className="font-medium text-foreground">Tags</dt>
                <dd className="flex flex-wrap gap-2">
                  {pitch.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="[overflow-wrap:anywhere]">
                      {tag}
                    </Badge>
                  ))}
                </dd>
              </>
            )}
          </dl>
        </section>

        <Separator className="my-8" />

        {isFounder ? (
          <InterestInbox pitchId={pitch.id} isOpen={pitch.is_open} />
        ) : (
          <InterestPanel pitch={pitch} userId={userId} />
        )}

        <Separator className="my-8" />

        <FeedbackSection
          pitchId={pitch.id}
          userId={userId}
          isModerator={isModerator}
          onChanged={() => void refreshCounts()}
        />
      </article>
    </Layout>
  );
};

export default PitchDetail;
