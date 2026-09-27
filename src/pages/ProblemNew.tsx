import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmDialog from "@/components/problems/ConfirmDialog";
import ProblemForm from "@/components/problems/ProblemForm";
import { uploadPendingMedia } from "@/components/problems/media-upload";
import { toast } from "sonner";
import {
  EMPTY_DRAFT,
  draftStorageKey,
  draftToPayload,
  friendlyWriteError,
  isDraftEmpty,
  parseStoredDraft,
  type ProblemDraft,
} from "@/lib/problems";
import type { PendingMedia } from "@/lib/media";
import { isMissingSchemaError } from "@/lib/supabase-errors";

type Availability = "checking" | "ready" | "missing";

function readStoredDraft(key: string): ProblemDraft | null {
  try {
    return parseStoredDraft(sessionStorage.getItem(key));
  } catch {
    // Storage can be blocked entirely (privacy settings); the form still works.
    return null;
  }
}

function writeStoredDraft(key: string, draft: ProblemDraft | null) {
  try {
    if (!draft || isDraftEmpty(draft)) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Full or blocked storage only costs the safety net, not the form.
  }
}

/** A list of file names as a sentence: "a.png", "a.png and b.pdf", "a, b and c". */
function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const Intro = () => (
  <>
    <h1 className="font-heading text-3xl font-bold text-foreground">Report a problem</h1>
    <p className="mt-1 text-muted-foreground">
      Describe a disability-related challenge. Be specific about who it affects
      and what makes it hard — that is what lets someone build the right
      solution.
    </p>
  </>
);

/**
 * The form itself, mounted only once the account is known, so the saved draft
 * for that account can be read synchronously on first render.
 */
const NewProblemForm = ({
  userId,
  mediaAvailableInitially,
}: {
  userId: string;
  mediaAvailableInitially: boolean;
}) => {
  const navigate = useNavigate();
  const storageKey = draftStorageKey(userId);
  const [initial] = useState(() => readStoredDraft(storageKey));
  const [draft, setDraft] = useState<ProblemDraft>(() => initial ?? EMPTY_DRAFT);
  const [restored, setRestored] = useState(initial !== null);
  const [pending, setPending] = useState<PendingMedia[]>([]);
  const [mediaAvailable, setMediaAvailable] = useState(mediaAvailableInitially);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const submittingRef = useRef(false);
  const publishedRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const clearButtonRef = useRef<HTMLButtonElement>(null);

  // Keep the text in this tab's storage, so a reload or a detour does not cost
  // someone a long report. Files cannot be stored this way and are not kept.
  useEffect(() => {
    if (publishedRef.current) return;
    writeStoredDraft(storageKey, draft);
  }, [draft, storageKey]);

  const publish = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setProgress("Publishing your problem...");

    try {
      const { data, error } = await supabase
        .from("problems")
        .insert({ user_id: userId, ...draftToPayload(draft) })
        .select("id")
        .single();

      if (error || !data) {
        setSubmitError(
          isMissingSchemaError(error)
            ? "The problem repository is not switched on yet, so this could not be published. Your text is kept in this tab."
            : friendlyWriteError(error, "Your problem could not be published. Please try again."),
        );
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }

      // The problem exists now; whatever happens to the files, the draft is done.
      publishedRef.current = true;
      writeStoredDraft(storageKey, null);

      let failedNames: string[] = [];
      if (pending.length > 0) {
        const outcome = await uploadPendingMedia(userId, data.id, pending, (done, total) =>
          setProgress(
            done < total ? `Uploading file ${done + 1} of ${total}...` : "Finishing...",
          ),
        );
        failedNames = outcome.failedNames;
        if (outcome.unavailable) setMediaAvailable(false);
      }

      toast.success("Problem published. Thank you for contributing.");
      if (failedNames.length > 0) {
        toast.error(
          `${listNames(failedNames)} could not be attached. Your problem is published; you can add ${
            failedNames.length === 1 ? "it" : "them"
          } from its edit page.`,
          { duration: 15000 },
        );
      }
      navigate(`/problems/${data.id}`);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setProgress(undefined);
    }
  };

  return (
    <>
      {restored && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-sm text-foreground">
            We kept the report you started earlier in this tab. Files you chose
            then need to be chosen again.
          </p>
          <Button
            ref={clearButtonRef}
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setClearOpen(true)}
          >
            Start over
          </Button>
        </div>
      )}

      <div ref={errorRef} tabIndex={-1} role="alert" className="focus:outline-none">
        {submitError && (
          <p className="mt-6 rounded-lg border border-destructive p-4 text-sm font-medium text-destructive">
            {submitError}
          </p>
        )}
      </div>

      <ProblemForm
        key={formKey}
        mode="create"
        draft={draft}
        onDraftChange={setDraft}
        pending={pending}
        onPendingChange={setPending}
        media={{ available: mediaAvailable }}
        submitting={submitting}
        progress={progress}
        submitLabel="Publish problem"
        busyLabel="Publishing..."
        onSubmit={() => void publish()}
        onCancel={() => navigate("/problems")}
      />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Start over?"
        description="Everything typed in this form will be cleared. This cannot be undone."
        confirmLabel="Clear the form"
        busyLabel="Clearing..."
        cancelLabel="Keep my draft"
        onConfirm={async () => {
          setDraft(EMPTY_DRAFT);
          setPending([]);
          setSubmitError(null);
          setRestored(false);
          // A fresh form instance drops any error summary from the old draft.
          setFormKey((k) => k + 1);
          return null;
        }}
        onClosed={(confirmed) => {
          if (confirmed) document.getElementById("p-title")?.focus();
          else clearButtonRef.current?.focus();
        }}
      />
    </>
  );
};

const ProblemNew = () => {
  useDocumentTitle("Report a problem");
  const { user, loading: authLoading } = useAuth();
  const [availability, setAvailability] = useState<Availability>("checking");
  const [mediaAvailable, setMediaAvailable] = useState(true);

  // Find out up front whether the tables exist, rather than letting someone
  // write a whole report and only then learn it cannot be saved. A GET, not a
  // HEAD: a HEAD for a missing table comes back as an empty success.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [problems, media] = await Promise.all([
        supabase.from("problems").select("id").limit(1),
        supabase.from("problem_media").select("id").limit(1),
      ]);
      if (cancelled) return;
      setAvailability(isMissingSchemaError(problems.error) ? "missing" : "ready");
      setMediaAvailable(!isMissingSchemaError(media.error));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Neither a sign-in prompt nor the form until auth has settled: someone
  // who is signed in must never be told to sign in.
  if (authLoading || (user && availability === "checking")) {
    return (
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
  }

  if (!user) {
    return (
      <Layout>
        <section className="container max-w-md py-16 text-center">
          <h1 className="mb-3 font-heading text-2xl font-bold">Sign in to report a problem</h1>
          <p className="mb-6 text-muted-foreground">
            Documenting a problem requires an account so the community can follow
            up with you.
          </p>
          <Button asChild className="min-h-11">
            <Link to={`/login?next=${encodeURIComponent("/problems/new")}`}>Sign in</Link>
          </Button>
        </section>
      </Layout>
    );
  }

  if (availability === "missing") {
    return (
      <Layout>
        <section className="container py-16">
          <FeatureUnavailable feature="The problem repository" headingLevel="h1" />
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="container max-w-2xl py-8">
        <Intro />
        <NewProblemForm key={user.id} userId={user.id} mediaAvailableInitially={mediaAvailable} />
      </section>
    </Layout>
  );
};

export default ProblemNew;
