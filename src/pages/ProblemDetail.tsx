import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import ConfirmDialog from "@/components/problems/ConfirmDialog";
import MediaGallery from "@/components/problems/MediaGallery";
import ProblemDiscussion, {
  COMMENT_COLUMNS,
  type ProblemComment,
} from "@/components/problems/ProblemDiscussion";
import ReportProblemDialog from "@/components/problems/ReportProblemDialog";
import RevisionHistory from "@/components/problems/RevisionHistory";
import { removeAllProblemMedia } from "@/components/problems/media-upload";
import { useIsModerator } from "@/components/problems/useIsModerator";
import {
  ArrowBigUp,
  ArrowLeft,
  Bookmark,
  Pencil,
  RotateCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AGE_GROUP_LABELS,
  DISABILITY_TYPE_LABELS,
  FALLBACK_DISPLAY_NAME,
  PROBLEM_STATUS_LABELS,
  SEVERITY_LABELS,
  STATUS_VARIANTS,
  classifyLoadError,
  displayNameOr,
  formatDate,
  friendlyWriteError,
  isProblemId,
  wasEdited,
  type LoadFailure,
  type Problem,
} from "@/lib/problems";
import { PROBLEM_MEDIA_COLUMNS, type ProblemMedia } from "@/lib/media";
import { safeHref } from "@/lib/safe-url";
import { isMissingSchemaError } from "@/lib/supabase-errors";

const DETAIL_COLUMNS =
  "id, user_id, title, description, disability_types, category, country, age_groups, severity, status, existing_solutions, related_research, tags, image_urls, video_urls, document_urls, vote_count, comment_count, created_at, updated_at";

const LEGACY_LINK_LABELS = {
  image_urls: "Image",
  video_urls: "Video",
  document_urls: "Document",
} as const;

/** A user-supplied link: linked only when it is plainly http(s). */
const UserLink = ({ url }: { url: string }) => {
  const href = safeHref(url);
  const text = <span className="break-words [overflow-wrap:anywhere]">{url}</span>;
  return href ? (
    <a href={href} rel="noopener noreferrer ugc" className="text-primary underline underline-offset-2">
      {text}
    </a>
  ) : (
    text
  );
};

const ProblemDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  // Keyed on the id, not the User object: the object is replaced on every
  // token refresh and tab re-focus, which must not reload the page.
  const userId = user?.id ?? null;
  const navigate = useNavigate();
  const { isModerator } = useIsModerator(userId);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [comments, setComments] = useState<ProblemComment[]>([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [media, setMedia] = useState<ProblemMedia[]>([]);
  const [mediaError, setMediaError] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [voted, setVoted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [reported, setReported] = useState(false);
  const [votePending, setVotePending] = useState(false);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const votePendingRef = useRef(false);
  const bookmarkPendingRef = useRef(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingAfterLoad = useRef(false);

  const problemId = problem?.id ?? null;
  const authorId = problem?.user_id ?? null;

  // The problem and everything public about it. Nothing here depends on who is
  // signed in, so auth events never blank the page.
  useEffect(() => {
    if (!isProblemId(id)) {
      // A mistyped link: say "not found" without asking the database, which
      // would only answer with a raw "invalid input syntax for type uuid".
      setProblem(null);
      setFailure("not_found");
      return;
    }
    let cancelled = false;
    setFailure(null);
    // Keep the current problem on screen during a retry of the same one; the
    // skeleton is only for a different problem.
    setProblem((prev) => (prev?.id === id ? prev : null));

    (async () => {
      const { data, error } = await supabase
        .from("problems")
        .select(DETAIL_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setProblem(null);
        setFailure(error ? classifyLoadError(error) : "not_found");
        return;
      }

      const [commentResult, mediaResult] = await Promise.all([
        supabase
          .from("problem_comments")
          .select(COMMENT_COLUMNS)
          .eq("problem_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("problem_media")
          .select(PROBLEM_MEDIA_COLUMNS)
          .eq("problem_id", id)
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;

      setProblem(data as Problem);
      setComments((commentResult.data ?? []) as ProblemComment[]);
      setCommentsError(
        commentResult.error ? "The comments could not be loaded. Reload the page to try again." : null,
      );
      // Media is newer than problems; until its migration is applied there is
      // simply nothing attached, which is not worth a warning.
      setMedia(mediaResult.error ? [] : ((mediaResult.data ?? []) as ProblemMedia[]));
      setMediaError(Boolean(mediaResult.error) && !isMissingSchemaError(mediaResult.error));
    })();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // What this person has done here. Cleared on sign-out, so a signed-out
  // viewer never sees someone else's vote or bookmark still pressed.
  useEffect(() => {
    // Only runs when the person or the problem changes (not on token refresh),
    // so starting from "not voted" never flickers a pressed button.
    setVoted(false);
    setBookmarked(false);
    setReported(false);
    if (!userId || !problemId) return;
    let cancelled = false;
    (async () => {
      const [vote, bookmark, report] = await Promise.all([
        supabase
          .from("problem_votes")
          .select("problem_id")
          .eq("problem_id", problemId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("problem_bookmarks")
          .select("problem_id")
          .eq("problem_id", problemId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("problem_reports")
          .select("id")
          .eq("problem_id", problemId)
          .eq("user_id", userId)
          .limit(1),
      ]);
      if (cancelled) return;
      setVoted(Boolean(vote.data));
      setBookmarked(Boolean(bookmark.data));
      setReported(Boolean(report.data && report.data.length > 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, problemId]);

  // profiles are readable only to signed-in users; everyone else sees the
  // neutral fallback. Refetched as new commenters appear.
  const nameIdsKey = useMemo(
    () =>
      authorId
        ? Array.from(new Set([authorId, ...comments.map((c) => c.user_id)]))
            .sort()
            .join(",")
        : "",
    [authorId, comments],
  );

  useEffect(() => {
    if (!userId || !nameIdsKey) {
      setNames({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", nameIdsKey.split(","));
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[p.user_id] = displayNameOr(p.display_name);
      setNames(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, nameIdsKey]);

  // "Try again" replaces itself with a skeleton; once the outcome renders,
  // put focus on its heading rather than leaving it on the page body.
  useEffect(() => {
    if (!focusHeadingAfterLoad.current || (!problemId && !failure)) return;
    focusHeadingAfterLoad.current = false;
    headingRef.current?.focus();
  }, [problemId, failure]);

  useDocumentTitle(
    problem
      ? problem.title
      : failure === "not_found"
        ? "Problem not found"
        : failure === "missing"
          ? "Problem repository"
          : failure === "error"
            ? "Problem could not be loaded"
            : null,
  );

  const nameFor = (uid: string) => names[uid] ?? FALLBACK_DISPLAY_NAME;
  const isAuthor = Boolean(userId && problem && userId === problem.user_id);
  const canManage = Boolean(userId && (isAuthor || isModerator));

  const requireAuth = () => {
    toast.info("Sign in to do that.");
    navigate(`/login?next=${encodeURIComponent(`/problems/${id ?? ""}`)}`);
  };

  const toggleVote = async () => {
    if (authLoading) return;
    if (!user) return requireAuth();
    if (!problem || votePendingRef.current) return;
    votePendingRef.current = true;
    setVotePending(true);

    // Optimistic: the counter is kept by a trigger, so mirror it locally.
    // Every update is relative to the latest state, so a rollback undoes
    // exactly this change even if something else moved the count meanwhile.
    const next = !voted;
    const delta = next ? 1 : -1;
    setVoted(next);
    setProblem((p) => p && { ...p, vote_count: p.vote_count + delta });

    try {
      const { error } = next
        ? await supabase
            .from("problem_votes")
            .insert({ problem_id: problem.id, user_id: user.id })
        : await supabase
            .from("problem_votes")
            .delete()
            .eq("problem_id", problem.id)
            .eq("user_id", user.id);

      if (error) {
        setProblem((p) => p && { ...p, vote_count: Math.max(p.vote_count - delta, 0) });
        if (next && error.code === "23505") {
          // Already voted (in another tab, say): the loaded count includes it.
          setVoted(true);
        } else {
          setVoted(!next);
          toast.error(friendlyWriteError(error, "Your vote could not be saved. Please try again."));
        }
      }
    } finally {
      votePendingRef.current = false;
      setVotePending(false);
    }
  };

  const toggleBookmark = async () => {
    if (authLoading) return;
    if (!user) return requireAuth();
    if (!problem || bookmarkPendingRef.current) return;
    bookmarkPendingRef.current = true;
    setBookmarkPending(true);
    const next = !bookmarked;
    setBookmarked(next);

    try {
      const { error } = next
        ? await supabase
            .from("problem_bookmarks")
            .insert({ problem_id: problem.id, user_id: user.id })
        : await supabase
            .from("problem_bookmarks")
            .delete()
            .eq("problem_id", problem.id)
            .eq("user_id", user.id);

      if (error && !(next && error.code === "23505")) {
        setBookmarked(!next);
        toast.error(friendlyWriteError(error, "Your bookmark could not be saved. Please try again."));
      } else {
        toast.success(next ? "Saved to your bookmarks" : "Removed from bookmarks");
      }
    } finally {
      bookmarkPendingRef.current = false;
      setBookmarkPending(false);
    }
  };

  const deleteProblem = async (): Promise<string | null> => {
    if (!problem) return null;
    // Storage objects first: the row's cascade cannot reach Storage, so once
    // the row is gone nothing would know these files existed.
    const mediaProblem = await removeAllProblemMedia(problem.id);
    if (mediaProblem) return mediaProblem;
    const { data, error } = await supabase
      .from("problems")
      .delete()
      .eq("id", problem.id)
      .select("id");
    if (error) return friendlyWriteError(error, "The problem could not be deleted. Please try again.");
    // RLS turns a refused delete into "0 rows" rather than an error.
    if (!data || data.length === 0) return "You don't have permission to delete this problem.";
    return null;
  };

  if (failure === "missing") {
    return (
      <Layout>
        <section className="container py-16">
          <FeatureUnavailable feature="The problem repository" headingLevel="h1" />
        </section>
      </Layout>
    );
  }

  if (failure === "not_found") {
    return (
      <Layout>
        <section className="container max-w-2xl py-16 text-center">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mb-3 font-heading text-2xl font-bold focus:outline-none"
          >
            Problem not found
          </h1>
          <p className="mb-6 text-muted-foreground">
            The link may be mistyped, or the problem may have been removed.
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/problems">Back to all problems</Link>
          </Button>
        </section>
      </Layout>
    );
  }

  if (failure === "error") {
    return (
      <Layout>
        <section className="container max-w-2xl py-16 text-center">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mb-3 font-heading text-2xl font-bold focus:outline-none"
          >
            This problem could not be loaded
          </h1>
          <p role="alert" className="mb-6 text-muted-foreground">
            Something went wrong on our side or with the connection. Please try
            again.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              className="min-h-11"
              onClick={() => {
                focusHeadingAfterLoad.current = true;
                setReloadKey((k) => k + 1);
              }}
            >
              <RotateCw className="mr-1 h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/problems">Back to all problems</Link>
            </Button>
          </div>
        </section>
      </Layout>
    );
  }

  if (!problem) {
    return (
      <Layout>
        <section className="container max-w-3xl space-y-4 py-8" aria-busy="true">
          <p role="status" className="sr-only">
            Loading problem
          </p>
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-40 w-full" />
        </section>
      </Layout>
    );
  }

  const meta = [problem.category, problem.country].filter(Boolean).join(" · ");
  const research = problem.related_research ?? [];
  const legacyLinks = (Object.keys(LEGACY_LINK_LABELS) as (keyof typeof LEGACY_LINK_LABELS)[])
    .flatMap((key) => (problem[key] ?? []).map((url) => ({ label: LEGACY_LINK_LABELS[key], url })));
  const hasFiles = media.length > 0 || legacyLinks.length > 0 || mediaError;

  return (
    <Layout>
      <article className="container max-w-3xl py-8">
        <Link
          to="/problems"
          className="mb-6 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All problems
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="min-w-0 break-words font-heading text-3xl font-bold text-foreground focus:outline-none [overflow-wrap:anywhere]"
          >
            {problem.title}
          </h1>
          <Badge variant={STATUS_VARIANTS[problem.status]}>
            {PROBLEM_STATUS_LABELS[problem.status]}
          </Badge>
        </div>

        <p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
          Reported by {nameFor(problem.user_id)} on {formatDate(problem.created_at)}
          {meta && ` · ${meta}`}
          {problem.severity && ` · ${SEVERITY_LABELS[problem.severity]} severity`}
        </p>
        {wasEdited(problem.created_at, problem.updated_at) && (
          <p className="mt-1 text-sm text-muted-foreground">
            Last updated {formatDate(problem.updated_at)}
          </p>
        )}

        {(problem.disability_types.length > 0 ||
          problem.age_groups.length > 0 ||
          problem.tags.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {problem.disability_types.map((d) => (
              <Badge key={d} variant="secondary">
                {DISABILITY_TYPE_LABELS[d]}
              </Badge>
            ))}
            {problem.age_groups.map((a) => (
              <Badge key={a} variant="outline">
                {AGE_GROUP_LABELS[a]}
              </Badge>
            ))}
            {problem.tags.map((t) => (
              <Badge key={t} variant="outline" className="break-all">
                {t}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            onClick={toggleVote}
            variant={voted ? "default" : "outline"}
            className="min-h-11"
            aria-pressed={voted}
            aria-disabled={votePending || authLoading}
          >
            <ArrowBigUp className="mr-1 h-4 w-4" aria-hidden="true" />
            {voted ? "This affects me" : "This affects me too"} ({problem.vote_count})
          </Button>
          <Button
            onClick={toggleBookmark}
            variant="outline"
            className="min-h-11"
            aria-pressed={bookmarked}
            aria-disabled={bookmarkPending || authLoading}
          >
            <Bookmark
              className={`mr-1 h-4 w-4 ${bookmarked ? "fill-current" : ""}`}
              aria-hidden="true"
            />
            {bookmarked ? "Saved" : "Save"}
          </Button>

          {canManage && (
            <>
              <Button asChild variant="outline" className="min-h-11">
                <Link to={`/problems/${problem.id}/edit`}>
                  <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                  Edit
                </Link>
              </Button>
              <Button
                ref={deleteButtonRef}
                variant="outline"
                className="min-h-11 text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            </>
          )}

          {userId && !isAuthor && (
            <ReportProblemDialog
              problemId={problem.id}
              userId={userId}
              alreadyReported={reported}
              onReported={() => setReported(true)}
            />
          )}
        </div>

        <Separator className="my-8" />

        <div className="prose prose-slate max-w-none break-words dark:prose-invert [overflow-wrap:anywhere]">
          <h2 className="font-heading text-xl font-semibold">The problem</h2>
          <p className="whitespace-pre-wrap">{problem.description}</p>

          {problem.existing_solutions && (
            <>
              <h2 className="font-heading text-xl font-semibold">Existing solutions</h2>
              <p className="whitespace-pre-wrap">{problem.existing_solutions}</p>
            </>
          )}

          {research.length > 0 && (
            <>
              <h2 className="font-heading text-xl font-semibold">Related research</h2>
              <ul>
                {research.map((url) => (
                  <li key={url}>
                    <UserLink url={url} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {hasFiles && (
          <section aria-labelledby="files-heading" className="mt-8">
            <h2
              id="files-heading"
              className="mb-4 font-heading text-xl font-semibold text-foreground"
            >
              Photos, video and documents
            </h2>
            {mediaError && (
              <p className="mb-4 text-sm text-muted-foreground">
                The attached files could not be loaded. Reload the page to try again.
              </p>
            )}
            <MediaGallery media={media} />
            {legacyLinks.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm" role="list" aria-label="Linked files">
                {legacyLinks.map(({ label, url }) => (
                  <li key={`${label}-${url}`}>
                    {label}: <UserLink url={url} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {canManage && (
          <RevisionHistory problemId={problem.id} updatedAt={problem.updated_at} />
        )}

        <Separator className="my-8" />

        <ProblemDiscussion
          problemId={problem.id}
          commentCount={problem.comment_count}
          comments={comments}
          loadError={commentsError}
          currentUserId={userId}
          authLoading={authLoading}
          nameFor={nameFor}
          onAdded={(comment) => {
            setComments((prev) => [...prev, comment]);
            setProblem((p) => p && { ...p, comment_count: p.comment_count + 1 });
          }}
          onDeleted={(commentId) => {
            setComments((prev) => prev.filter((c) => c.id !== commentId));
            setProblem((p) => p && { ...p, comment_count: Math.max(p.comment_count - 1, 0) });
          }}
        />

        {canManage && (
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Delete this problem?"
            description={`“${problem.title}” will be permanently deleted, with its comments, votes and attached files. This cannot be undone.`}
            confirmLabel="Delete problem"
            busyLabel="Deleting..."
            cancelLabel="Keep problem"
            onConfirm={deleteProblem}
            onClosed={(confirmed) => {
              if (confirmed) {
                toast.success("Problem deleted.");
                // The problem list's page takes focus on arrival (Layout).
                navigate("/problems", { replace: true });
              } else {
                deleteButtonRef.current?.focus();
              }
            }}
          />
        )}
      </article>
    </Layout>
  );
};

export default ProblemDetail;
