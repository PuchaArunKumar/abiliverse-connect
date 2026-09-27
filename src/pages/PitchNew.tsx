import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { isMissingSchemaError } from "@/lib/supabase-errors";
import {
  friendlyPitchError,
  toPitchPayload,
  type PitchFormValues,
} from "@/lib/pitches";

const PitchNew = () => {
  useDocumentTitle("Submit a pitch");
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [unavailable, setUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // The form's own guard reads a prop that updates a render late; this one
  // stops a fast double press from publishing the pitch twice.
  const submittingRef = useRef(false);

  // Find out before someone writes a whole pitch that it cannot be saved yet.
  // Any other failure is left for the save itself to report.
  useEffect(() => {
    let active = true;
    void (async () => {
      const { error } = await supabase.from("pitches").select("id").limit(1);
      if (active && isMissingSchemaError(error)) setUnavailable(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const submit = async (values: PitchFormValues) => {
    if (!user || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    const { data, error } = await supabase
      .from("pitches")
      .insert({ ...toPitchPayload(values), user_id: user.id })
      .select("id")
      .single();

    submittingRef.current = false;
    setSubmitting(false);
    if (error || !data) {
      if (isMissingSchemaError(error)) {
        setUnavailable(true);
        return;
      }
      setSubmitError(
        friendlyPitchError(error, "Your pitch could not be published. Please try again."),
      );
      return;
    }
    toast.success("Your pitch is published.");
    navigate(`/pitches/${data.id}`);
  };

  // The route is protected, so these only show if it is mounted without the
  // guard; never flash a sign-in prompt while the session is still loading.
  if (authLoading) return <PageLoading />;

  if (!user) {
    return (
      <Layout>
        <section className="container max-w-md py-16 text-center">
          <h1 className="mb-3 font-heading text-2xl font-bold">
            Sign in to submit a pitch
          </h1>
          <p className="mb-6 text-muted-foreground">
            Sharing a pitch needs an account, so people who want to help can
            reach you.
          </p>
          <Button asChild className="min-h-11">
            <Link to="/login?next=/pitches/new">Sign in</Link>
          </Button>
        </section>
      </Layout>
    );
  }

  if (unavailable) {
    return (
      <Layout>
        <section className="container py-16">
          <FeatureUnavailable feature="The Pitch Platform" headingLevel="h1" />
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="container max-w-2xl py-8">
        <Link
          to="/pitches"
          className="mb-6 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All pitches
        </Link>
        <h1 className="font-heading text-3xl font-bold text-foreground">
          Submit a pitch
        </h1>
        <p className="mt-1 mb-8 text-muted-foreground">
          Share an assistive technology idea and say what would help it move
          forward. Your pitch is public, so anyone can read it without an
          account. Interest requests, including any contact details, are visible
          only to you and the sender.
        </p>
        <PitchForm
          mode="create"
          submitting={submitting}
          submitError={submitError}
          onSubmit={submit}
          onCancel={() => navigate("/pitches")}
        />
      </section>
    </Layout>
  );
};

export default PitchNew;
