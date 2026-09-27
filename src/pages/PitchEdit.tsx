import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/layout/Layout";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import PageLoading from "@/components/PageLoading";
import PitchForm from "@/components/pitches/PitchForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { classifyLoadError } from "@/lib/problems";
import { isMissingSchemaError } from "@/lib/supabase-errors";
import {
  PITCH_DETAIL_COLUMNS,
  canManagePitch,
  friendlyPitchError,
  isPitchId,
  pitchToFormValues,
  toPitchPayload,
  type LinkedProblem,
  type PitchFormValues,
} from "@/lib/pitches";

type EditState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "not_found" }
  | { kind: "error" }
  | { kind: "forbidden" }
  | { kind: "ready"; initial: PitchFormValues; title: string };

const PitchEdit = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  // Keyed on the id, not the user object: a token refresh hands out a new
  // object, and reloading then would throw away the person's edits.
  const userId = user?.id ?? null;

  const [state, setState] = useState<EditState>({ kind: "loading" });
  const [reloadTick, setReloadTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useDocumentTitle(state.kind === "loading" ? null : "Edit pitch");

  useEffect(() => {
    if (authLoading) return;
    if (!isPitchId(id)) {
      setState({ kind: "not_found" });
      return;
    }
    if (!userId) return;
    let active = true;
    setState({ kind: "loading" });

    void (async () => {
      const [{ data: pitch, error }, moderator] = await Promise.all([
        supabase.from("pitches").select(PITCH_DETAIL_COLUMNS).eq("id", id).maybeSingle(),
        // A missing role function means no one is a moderator yet; the
        // founder can still edit their own pitch.
        supabase.rpc("is_moderator").then(({ data }) => data === true),
      ]);
      if (!active) return;
      if (error) {
        const failure = classifyLoadError(error);
        setState({ kind: failure === "missing" ? "missing" : failure === "not_found" ? "not_found" : "error" });
        return;
      }
      if (!pitch) {
        setState({ kind: "not_found" });
        return;
      }
      if (!canManagePitch(userId, pitch, moderator)) {
        setState({ kind: "forbidden" });
        return;
      }

      let problem: LinkedProblem | null = null;
      if (pitch.problem_id) {
        const { data: row } = await supabase
          .from("problems")
          .select("id, title")
          .eq("id", pitch.problem_id)
          .maybeSingle();
        if (!active) return;
        // Keep the link even when the title cannot be read, so saving the
        // form does not silently unlink the problem.
        problem = { id: pitch.problem_id, title: row?.title ?? "" };
      }
      setState({
        kind: "ready",
        initial: pitchToFormValues(pitch, problem),
        title: pitch.title,
      });
    })();

    return () => {
      active = false;
    };
  }, [id, userId, authLoading, reloadTick]);

  const submit = async (values: PitchFormValues) => {
    if (!id || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    const { data, error } = await supabase
      .from("pitches")
      .update(toPitchPayload(values))
      .eq("id", id)
      .select("id");

    submittingRef.current = false;
    setSubmitting(false);
    if (error) {
      if (isMissingSchemaError(error)) {
        setState({ kind: "missing" });
        return;
      }
      setSubmitError(
        friendlyPitchError(error, "Your changes could not be saved. Please try again."),
      );
      return;
    }
    // Row-level security turns a forbidden update into zero rows, not an error.
    if (!data || data.length === 0) {
      setSubmitError(
        "Your changes were not saved. The pitch may have been deleted, or you may no longer have permission to edit it.",
      );
      return;
    }
    toast.success("Your changes are saved.");
    navigate(`/pitches/${id}`);
  };

  if (authLoading || (state.kind === "loading" && user)) return <PageLoading />;

  if (!user) {
    return (
      <Layout>
        <section className="container max-w-md py-16 text-center">
          <h1 className="mb-3 font-heading text-2xl font-bold">Sign in to edit this pitch</h1>
          <Button asChild className="mt-3 min-h-11">
            <Link to={`/login?next=/pitches/${id ?? ""}/edit`}>Sign in</Link>
          </Button>
        </section>
      </Layout>
    );
  }

  if (state.kind === "missing") {
    return (
      <Layout>
        <section className="container py-16">
          <FeatureUnavailable feature="The Pitch Platform" headingLevel="h1" />
        </section>
      </Layout>
    );
  }

  if (state.kind !== "ready") {
    const heading =
      state.kind === "forbidden"
        ? "You cannot edit this pitch"
        : state.kind === "error"
          ? "This pitch could not be loaded"
          : "Pitch not found";
    const body =
      state.kind === "forbidden"
        ? "Only the person who shared a pitch, or a moderator, can edit it."
        : state.kind === "error"
          ? "Check your connection and try again."
          : "The link may be mistyped, or the pitch may have been deleted.";
    return (
      <Layout>
        <section className="container max-w-2xl py-16 text-center">
          <h1 className="mb-3 font-heading text-2xl font-bold">{heading}</h1>
          <p className="mb-6 text-muted-foreground">{body}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {state.kind === "error" && (
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

  return (
    <Layout>
      <section className="container max-w-2xl py-8">
        <Link
          to={`/pitches/${id}`}
          className="mb-6 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the pitch
        </Link>
        <h1 className="font-heading text-3xl font-bold text-foreground">Edit pitch</h1>
        <p className="mt-1 mb-8 text-muted-foreground [overflow-wrap:anywhere]">
          {state.title}
        </p>
        <PitchForm
          mode="edit"
          initialValues={state.initial}
          submitting={submitting}
          submitError={submitError}
          onSubmit={submit}
          onCancel={() => navigate(`/pitches/${id}`)}
        />
      </section>
    </Layout>
  );
};

export default PitchEdit;
