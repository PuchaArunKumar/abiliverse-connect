import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ProblemForm from "@/components/problems/ProblemForm";
import { removeProblemMedia, uploadPendingMedia } from "@/components/problems/media-upload";
import { useIsModerator } from "@/components/problems/useIsModerator";
import { ArrowLeft, RotateCw } from "lucide-react";
import { toast } from "sonner";
import {
  EMPTY_DRAFT,
  classifyLoadError,
  draftFromProblem,
  draftToPayload,
  friendlyWriteError,
  isProblemId,
  type LoadFailure,
  type Problem,
  type ProblemDraft,
} from "@/lib/problems";
import {
  PROBLEM_MEDIA_COLUMNS,
  type PendingMedia,
  type ProblemMedia,
} from "@/lib/media";
import { isMissingSchemaError } from "@/lib/supabase-errors";

const EDIT_COLUMNS =
  "id, user_id, title, description, disability_types, category, country, age_groups, severity, status, existing_solutions, related_research, tags, image_urls, video_urls, document_urls, vote_count, comment_count, created_at, updated_at";

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const LoadingState = () => (
  <Layout>
    <section className="container max-w-2xl space-y-4 py-8" aria-busy="true">
      <p role="status" className="sr-only">
        Loading
      </p>
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-64 w-full" />
    </section>
  </Layout>
);

/**
 * Editing a problem: open to its author and to moderators, the same people
 * the problems_update_own policy lets through. Only the author can attach new
 * files (problem_media_insert_author); either can remove them.
 */
const ProblemEdit = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const navigate = useNavigate();
  const { isModerator, checked: moderatorChecked } = useIsModerator(userId);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [draft, setDraft] = useState<ProblemDraft>(EMPTY_DRAFT);
  const [existing, setExisting] = useState<ProblemMedia[]>([]);
  const [mediaAvailable, setMediaAvailable] = useState(true);
  const [mediaNote, setMediaNote] = useState<string | undefined>();
  const [pending, setPending] = useState<PendingMedia[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    problem
      ? `Edit: ${problem.title}`
      : failure === "not_found"
        ? "Problem not found"
        : failure
          ? "Edit problem"
          : null,
  );

  useEffect(() => {
    if (!isProblemId(id)) {
      setProblem(null);
      setFailure("not_found");
      return;
    }
    let cancelled = false;
    setFailure(null);
    setProblem(null);

    (async () => {
      const [problemResult, mediaResult] = await Promise.all([
        supabase.from("problems").select(EDIT_COLUMNS).eq("id", id).maybeSingle(),
        supabase
          .from("problem_media")
          .select(PROBLEM_MEDIA_COLUMNS)
          .eq("problem_id", id)
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      const { data, error } = problemResult;
      if (error || !data) {
        setFailure(error ? classifyLoadError(error) : "not_found");
        return;
      }
      const loaded = data as Problem;
      setProblem(loaded);
      setDraft(draftFromProblem(loaded));
      setPending([]);
      setExisting(mediaResult.error ? [] : ((mediaResult.data ?? []) as ProblemMedia[]));
      // A missing table hides the uploader. Any other failure also hides it:
      // offering "add files" next to a list we could not read would mislead.
      setMediaAvailable(!mediaResult.error);
      setMediaNote(
        mediaResult.error && !isMissingSchemaError(mediaResult.error)
          ? "The attached files could not be loaded, so they can't be changed right now. Your other changes can still be saved; reload the page to try again."
          : undefined,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const isAuthor = Boolean(userId && problem && problem.user_id === userId);

  const save = async () => {
    if (submittingRef.current || !problem || !userId) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setProgress("Saving your changes...");

    try {
      const { data, error } = await supabase
        .from("problems")
        .update({ ...draftToPayload(draft), status: draft.status })
        .eq("id", problem.id)
        .select("id");

      if (error || !data || data.length === 0) {
        setSubmitError(
          error
            ? friendlyWriteError(error, "Your changes could not be saved. Please try again.")
            : // RLS turns a refused update into "0 rows" rather than an error.
              "Your changes could not be saved: you may no longer have permission to edit this problem, or it has been deleted.",
        );
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }

      let failedNames: string[] = [];
      if (pending.length > 0 && isAuthor) {
        const outcome = await uploadPendingMedia(userId, problem.id, pending, (done, total) =>
          setProgress(
            done < total ? `Uploading file ${done + 1} of ${total}...` : "Finishing...",
          ),
        );
        failedNames = outcome.failedNames;
        if (outcome.uploaded.length > 0) {
          setExisting((prev) => [...prev, ...outcome.uploaded]);
        }
        if (outcome.unavailable) setMediaAvailable(false);
        // Keep the failed files in the form, so trying again is one click.
        setPending((prev) => prev.filter((p) => outcome.failedIds.includes(p.id)));
      }

      if (failedNames.length > 0) {
        // Stay on the page: the changes are saved, but the files that did not
        // attach are still listed here to try again.
        toast.error(
          `Your changes are saved, but ${listNames(failedNames)} could not be attached. They are still listed below; save again to retry.`,
          { duration: 15000 },
        );
        return;
      }
      toast.success("Changes saved.");
      navigate(`/problems/${problem.id}`);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setProgress(undefined);
    }
  };

  const removeExisting = async (media: ProblemMedia): Promise<string | null> => {
    const problemText = await removeProblemMedia(media);
    if (!problemText) setExisting((prev) => prev.filter((m) => m.id !== media.id));
    return problemText;
  };

  // ProtectedRoute normally covers these; kept so the page is safe on its own.
  if (authLoading) return <LoadingState />;
  if (!user) {
    return (
      <Layout>
        <section className="container max-w-md py-16 text-center">
          <h1 className="mb-3 font-heading text-2xl font-bold">Sign in to edit this problem</h1>
          <Button asChild className="min-h-11">
            <Link to={`/login?next=${encodeURIComponent(`/problems/${id ?? ""}/edit`)}`}>
              Sign in
            </Link>
          </Button>
        </section>
      </Layout>
    );
  }

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
          <h1 className="mb-3 font-heading text-2xl font-bold">Problem not found</h1>
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
          <h1 className="mb-3 font-heading text-2xl font-bold">
            This problem could not be loaded
          </h1>
          <p role="alert" className="mb-6 text-muted-foreground">
            Something went wrong on our side or with the connection. Please try again.
          </p>
          <Button className="min-h-11" onClick={() => setReloadKey((k) => k + 1)}>
            <RotateCw className="mr-1 h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </section>
      </Layout>
    );
  }

  // Wait for the moderator check only when it decides anything.
  if (!problem || (!isAuthor && !moderatorChecked)) return <LoadingState />;

  if (!isAuthor && !isModerator) {
    return (
      <Layout>
        <section className="container max-w-2xl py-16 text-center">
          <h1 className="mb-3 font-heading text-2xl font-bold">
            You can't edit this problem
          </h1>
          <p className="mb-6 text-muted-foreground">
            Only the person who reported a problem, and moderators, can edit it.
            You can still comment on it or report it to a moderator.
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <Link to={`/problems/${problem.id}`}>Back to the problem</Link>
          </Button>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="container max-w-2xl py-8">
        <Link
          to={`/problems/${problem.id}`}
          className="mb-6 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the problem
        </Link>
        <h1 className="font-heading text-3xl font-bold text-foreground">Edit problem</h1>
        <p className="mt-1 break-words text-muted-foreground [overflow-wrap:anywhere]">
          {problem.title}
        </p>
        {!isAuthor && (
          <p className="mt-2 text-sm text-muted-foreground">
            You are editing as a moderator. The previous title and description
            are kept in the edit history.
          </p>
        )}

        <div ref={errorRef} tabIndex={-1} role="alert" className="focus:outline-none">
          {submitError && (
            <p className="mt-6 rounded-lg border border-destructive p-4 text-sm font-medium text-destructive">
              {submitError}
            </p>
          )}
        </div>

        <ProblemForm
          mode="edit"
          draft={draft}
          onDraftChange={setDraft}
          pending={pending}
          onPendingChange={setPending}
          media={{
            available: mediaAvailable,
            unavailableNote: mediaNote,
            existing,
            onRemoveExisting: removeExisting,
            canAdd: isAuthor,
            cannotAddNote: "Only the person who reported this problem can attach files.",
          }}
          submitting={submitting}
          progress={progress}
          submitLabel="Save changes"
          busyLabel="Saving..."
          onSubmit={() => void save()}
          onCancel={() => navigate(`/problems/${problem.id}`)}
        />
      </section>
    </Layout>
  );
};

export default ProblemEdit;
