import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { isMissingSchemaError } from "@/lib/supabase-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Briefcase, CheckCircle2, Loader2, MapPin, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import ConfirmDeleteDialog from "@/components/community/ConfirmDeleteDialog";
import ExternalLinkButton from "@/components/community/ExternalLinkButton";
import Field from "@/components/community/Field";
import InlineLoading from "@/components/community/InlineLoading";
import LoadProblem from "@/components/community/LoadProblem";
import { friendlyError, isDuplicateError } from "@/components/community/errors";
import { displayName, formatShortDate, plural } from "@/components/community/format";
import { elementOrFallback, neighbourId } from "@/components/community/list";
import { useFocusRequest } from "@/components/community/useFocusRequest";
import { usePendingSet } from "@/components/community/usePendingSet";
import {
  JOB_FIELDS,
  LIMITS,
  coverNoteError,
  firstErrorField,
  validateJob,
  type FieldErrors,
  type JobField,
  type JobForm,
} from "@/components/community/validation";

type Job = Pick<
  Tables<"jobs">,
  | "id"
  | "user_id"
  | "title"
  | "company"
  | "location"
  | "description"
  | "accessibility_tags"
  | "apply_url"
  | "remote"
  | "created_at"
>;

const JOB_COLUMNS =
  "id, user_id, title, company, location, description, accessibility_tags, apply_url, remote, created_at";

interface Application {
  id: string;
  user_id: string;
  cover_note: string;
  created_at: string;
  name: string;
}

type Panel =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: Application[] };

const EMPTY_FORM: JobForm = {
  title: "",
  company: "",
  location: "",
  description: "",
  apply_url: "",
  tags: "",
  remote: false,
};

const FIELD_IDS: Record<JobField, string> = {
  title: "job-title",
  company: "job-company",
  location: "job-location",
  description: "job-description",
  apply_url: "job-apply-url",
  tags: "job-tags",
};

const LIST_HEADING_ID = "jobs-list-heading";
const itemId = (id: string) => `job-${id}`;
const applyButtonId = (id: string) => `job-${id}-apply`;
const appliedId = (id: string) => `job-${id}-applied`;
const noteId = (id: string) => `job-${id}-note`;
const panelId = (id: string) => `job-${id}-applications`;

type LoadState = "loading" | "ready" | "error" | "unavailable";

type DeleteTarget = { kind: "job"; job: Job } | { kind: "application"; job: Job };

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

const Jobs = () => {
  useDocumentTitle("Jobs");
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const requestFocus = useFocusRequest();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retrying, setRetrying] = useState(false);
  const [applied, setApplied] = useState<ReadonlySet<string>>(() => new Set());
  // Application counts for the viewer's own listings; other people's are
  // not readable.
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});

  const [openPost, setOpenPost] = useState(false);
  const [form, setForm] = useState<JobForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors<JobField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Easy apply. Notes are kept per job, so a note written for one employer
  // never turns up in the form for another.
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({});
  const [applyErrors, setApplyErrors] = useState<Record<string, string>>({});
  const applying = usePendingSet();

  // The poster's view of applications, one disclosure per own listing.
  const [panels, setPanels] = useState<Record<string, Panel>>({});
  const panelRequests = useRef<Record<string, number>>({});

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const focusAfterDelete = useRef<string | null>(null);

  // Only the newest request may write to state (see Opportunities).
  const requestId = useRef(0);

  const load = useCallback(async (): Promise<boolean> => {
    const id = ++requestId.current;
    const { data, error } = await supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .order("created_at", { ascending: false });
    if (id !== requestId.current) return false;
    if (error) {
      setRetrying(false);
      setLoadState(isMissingSchemaError(error) ? "unavailable" : "error");
      return false;
    }

    let appliedIds = new Set<string>();
    let counts: Record<string, number> = {};
    if (userId) {
      const [mine, own] = await Promise.all([
        supabase.from("job_applications").select("job_id").eq("user_id", userId),
        // Counted by the database: the poster may read every application to
        // their own jobs, and nobody needs the rows just to show a number.
        supabase.from("jobs").select("id, job_applications(count)").eq("user_id", userId),
      ]);
      if (id !== requestId.current) return false;
      appliedIds = new Set((mine.data ?? []).map((a) => a.job_id));
      counts = Object.fromEntries(
        (own.data ?? []).map((j) => [j.id, j.job_applications[0]?.count ?? 0]),
      );
    }

    setJobs(data ?? []);
    setApplied(appliedIds);
    setAppCounts(counts);
    setRetrying(false);
    setLoadState("ready");
    return true;
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const retry = () => {
    setRetrying(true);
    void load().then((ok) => {
      if (ok) requestFocus(LIST_HEADING_ID);
    });
  };

  // ------------------------------------------------------------ post a job

  const updateForm = <K extends keyof JobForm>(key: K, value: JobForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submitJob = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || savingRef.current) return;
    const { values, errors: found } = validateJob(form);
    setErrors(found);
    setFormError(null);
    const first = firstErrorField(JOB_FIELDS, found);
    if (first) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    const { data, error } = await supabase
      .from("jobs")
      .insert({ user_id: user.id, ...values })
      .select(JOB_COLUMNS)
      .single();
    savingRef.current = false;
    setSaving(false);
    if (error) {
      setFormError(friendlyError(error, "The job could not be posted. Please try again."));
      return;
    }
    setJobs((prev) => [data, ...prev]);
    setAppCounts((prev) => ({ ...prev, [data.id]: 0 }));
    setForm(EMPTY_FORM);
    setErrors({});
    setOpenPost(false);
    toast.success("Job posted");
  };

  // ------------------------------------------------------------ easy apply

  const startApplying = (jobId: string) => {
    setApplyingId(jobId);
    requestFocus(noteId(jobId));
  };

  const cancelApplying = (jobId: string) => {
    setApplyingId((current) => (current === jobId ? null : current));
    setNoteErrors((prev) => without(prev, jobId));
    setApplyErrors((prev) => without(prev, jobId));
    requestFocus(applyButtonId(jobId));
  };

  const submitApplication = async (event: React.FormEvent, job: Job) => {
    event.preventDefault();
    if (!user) return;
    const note = (notes[job.id] ?? "").trim();
    const noteError = coverNoteError(note);
    if (noteError) {
      setNoteErrors((prev) => ({ ...prev, [job.id]: noteError }));
      document.getElementById(noteId(job.id))?.focus();
      return;
    }
    if (!applying.start(job.id)) return;
    setNoteErrors((prev) => without(prev, job.id));
    setApplyErrors((prev) => without(prev, job.id));

    const { error } = await supabase
      .from("job_applications")
      .insert({ job_id: job.id, user_id: user.id, cover_note: note });
    applying.finish(job.id);

    // A unique violation means an application is already on file (from
    // another tab, say): the outcome the person wanted, not a failure.
    const alreadyApplied = isDuplicateError(error);
    if (error && !alreadyApplied) {
      setApplyErrors((prev) => ({
        ...prev,
        [job.id]: friendlyError(error, "Your application could not be sent. Please try again."),
      }));
      return;
    }
    setApplied((prev) => new Set(prev).add(job.id));
    setApplyingId((current) => (current === job.id ? null : current));
    setNotes((prev) => without(prev, job.id));
    requestFocus(appliedId(job.id));
    toast.success(
      alreadyApplied
        ? "You had already applied for this job."
        : "Application sent. The poster can read it on this page.",
    );
  };

  // ---------------------------------------------------- poster's view

  const toggleApplications = async (job: Job) => {
    const request = (panelRequests.current[job.id] ?? 0) + 1;
    panelRequests.current[job.id] = request;
    if (panels[job.id]) {
      // Closing also retires any request still in flight for this panel.
      setPanels((prev) => without(prev, job.id));
      return;
    }
    setPanels((prev) => ({ ...prev, [job.id]: { status: "loading" } }));

    const fail = (message: string) =>
      setPanels((prev) => ({ ...prev, [job.id]: { status: "error", message } }));

    const { data, error } = await supabase
      .from("job_applications")
      .select("id, user_id, cover_note, created_at")
      .eq("job_id", job.id)
      .order("created_at", { ascending: true });
    if (panelRequests.current[job.id] !== request) return;
    if (error) {
      fail(friendlyError(error, "The applications could not be loaded. Close this and try again."));
      return;
    }

    const ids = Array.from(new Set((data ?? []).map((a) => a.user_id)));
    const names = new Map<string, string | null>();
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      if (panelRequests.current[job.id] !== request) return;
      (profiles ?? []).forEach((p) => names.set(p.user_id, p.display_name));
    }

    const items: Application[] = (data ?? []).map((a) => ({
      id: a.id,
      user_id: a.user_id,
      cover_note: a.cover_note ?? "",
      created_at: a.created_at,
      name: displayName(names.get(a.user_id)),
    }));
    setPanels((prev) => ({ ...prev, [job.id]: { status: "ready", items } }));
    setAppCounts((prev) => ({ ...prev, [job.id]: items.length }));
  };

  // ---------------------------------------------------------------- delete

  const confirmDelete = async (): Promise<string | null> => {
    const target = deleteTarget;
    if (!target || !user) return null;

    if (target.kind === "application") {
      const { error } = await supabase
        .from("job_applications")
        .delete()
        .eq("job_id", target.job.id)
        .eq("user_id", user.id);
      if (error) {
        return friendlyError(error, "Your application could not be withdrawn. Please try again.");
      }
      setApplied((prev) => {
        const next = new Set(prev);
        next.delete(target.job.id);
        return next;
      });
      focusAfterDelete.current = applyButtonId(target.job.id);
      toast.success("Application withdrawn");
      return null;
    }

    const { error } = await supabase.from("jobs").delete().eq("id", target.job.id);
    if (error) {
      return friendlyError(error, "The job could not be deleted. Please try again.");
    }
    const next = neighbourId(
      jobs.map((j) => j.id),
      target.job.id,
    );
    focusAfterDelete.current = next ? itemId(next) : null;
    setJobs((prev) => prev.filter((j) => j.id !== target.job.id));
    setPanels((prev) => without(prev, target.job.id));
    toast.success("Job deleted");
    return null;
  };

  const deleteCopy = (() => {
    if (!deleteTarget) {
      return { title: "Delete this job?", description: "", confirm: "Delete job" };
    }
    const { job } = deleteTarget;
    if (deleteTarget.kind === "application") {
      return {
        title: `Withdraw your application for "${job.title}"?`,
        description:
          "Your note will be deleted and the poster will no longer see it. You can apply again later.",
        confirm: "Withdraw application",
      };
    }
    const count = appCounts[job.id];
    return {
      title: `Delete "${job.title}"?`,
      description:
        count && count > 0
          ? `The listing and ${plural(count, "application", "applications")} to it will be removed for everyone. This cannot be undone.`
          : "The listing and any applications to it will be removed for everyone. This cannot be undone.",
      confirm: "Delete job",
    };
  })();

  // ---------------------------------------------------------------- render

  const renderApplyArea = (j: Job) => {
    if (!user) return null;

    if (applied.has(j.id)) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <p
            id={appliedId(j.id)}
            tabIndex={-1}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            You applied
          </p>
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              setDeleteTarget({ kind: "application", job: j });
              setDeleteOpen(true);
            }}
          >
            Withdraw application
            <span className="sr-only"> for {j.title}</span>
          </Button>
        </div>
      );
    }

    if (applyingId === j.id) {
      const busy = applying.pending.has(j.id);
      return (
        <form
          onSubmit={(e) => void submitApplication(e, j)}
          noValidate
          className="w-full space-y-3 rounded-lg border border-border p-4"
          aria-labelledby={`${noteId(j.id)}-legend`}
        >
          <p id={`${noteId(j.id)}-legend`} className="font-medium">
            Apply for {j.title}
          </p>
          <Field
            id={noteId(j.id)}
            label="Note to the poster (optional)"
            hint={`The poster sees this note and your display name. Include how they can reach you, such as an email address or phone number. Up to ${LIMITS.coverNote.max.toLocaleString("en")} characters.`}
            error={noteErrors[j.id]}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={4}
                value={notes[j.id] ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNotes((prev) => ({ ...prev, [j.id]: value }));
                }}
              />
            )}
          </Field>
          <div aria-live="assertive">
            {applyErrors[j.id] && (
              <p className="text-sm font-medium text-destructive dark:text-red-300">
                {applyErrors[j.id]}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" aria-disabled={busy || undefined} className="min-h-11">
              {busy ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Sending…
                </>
              ) : (
                "Send application"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!busy) cancelApplying(j.id);
              }}
              aria-disabled={busy || undefined}
              className="min-h-11"
            >
              Cancel
            </Button>
          </div>
        </form>
      );
    }

    return (
      <Button id={applyButtonId(j.id)} onClick={() => startApplying(j.id)} className="min-h-11">
        Easy apply
        <span className="sr-only"> for {j.title}</span>
      </Button>
    );
  };

  const renderApplications = (j: Job) => {
    const panel = panels[j.id];
    const count = appCounts[j.id];
    return (
      <div className="w-full">
        <Button
          variant="outline"
          className="min-h-11"
          aria-expanded={panel !== undefined}
          aria-controls={panelId(j.id)}
          onClick={() => void toggleApplications(j)}
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          {count === undefined ? "Applications" : `Applications (${count.toLocaleString("en")})`}
          <span className="sr-only"> for {j.title}</span>
        </Button>
        {panel && (
          <div id={panelId(j.id)} className="mt-3 rounded-lg border border-border p-4">
            <h4 className="font-medium">Applications for {j.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Only you can see these. Each applicant sees only their own.
            </p>
            {panel.status === "loading" ? (
              <InlineLoading label="Loading applications…" className="py-4" />
            ) : panel.status === "error" ? (
              <p role="alert" className="mt-3 text-sm font-medium text-destructive dark:text-red-300">
                {panel.message}
              </p>
            ) : panel.items.length === 0 ? (
              <p className="mt-3 text-sm" role="status">
                No applications yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-3" role="list">
                {panel.items.map((a) => (
                  <li key={a.id} className="rounded-md bg-muted px-3 py-2">
                    <p className="text-sm font-medium [overflow-wrap:anywhere]">
                      {a.name}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · applied <time dateTime={a.created_at}>{formatShortDate(a.created_at)}</time>
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                      {a.cover_note.trim() || (
                        <span className="text-muted-foreground">No note included.</span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <section className="container max-w-4xl py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold">Jobs & Opportunities</h1>
            <p className="text-muted-foreground">
              Accessibility-friendly roles from inclusive employers.
            </p>
          </div>
          {user ? (
            <Dialog
              open={openPost}
              onOpenChange={(next) => {
                if (savingRef.current) return;
                setOpenPost(next);
                if (next) setFormError(null);
              }}
            >
              <DialogTrigger asChild>
                <Button className="min-h-11">
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Post a job
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Post a job</DialogTitle>
                  <DialogDescription>
                    The listing appears on this page for others to see. Applications
                    made here are visible only to you, under the listing.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submitJob} noValidate className="space-y-4">
                  <Field
                    id={FIELD_IDS.title}
                    label="Job title"
                    hint={`${LIMITS.jobTitle.min} to ${LIMITS.jobTitle.max} characters.`}
                    error={errors.title}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        required
                        maxLength={LIMITS.jobTitle.max}
                        value={form.title}
                        onChange={(e) => updateForm("title", e.target.value)}
                        className="min-h-11"
                      />
                    )}
                  </Field>
                  <Field id={FIELD_IDS.company} label="Company" error={errors.company}>
                    {(control) => (
                      <Input
                        {...control}
                        required
                        autoComplete="organization"
                        maxLength={LIMITS.jobCompany.max}
                        value={form.company}
                        onChange={(e) => updateForm("company", e.target.value)}
                        className="min-h-11"
                      />
                    )}
                  </Field>
                  <Field id={FIELD_IDS.location} label="Location (optional)" error={errors.location}>
                    {(control) => (
                      <Input
                        {...control}
                        maxLength={LIMITS.shortText.max}
                        value={form.location}
                        onChange={(e) => updateForm("location", e.target.value)}
                        className="min-h-11"
                      />
                    )}
                  </Field>
                  <Field
                    id={FIELD_IDS.description}
                    label="Description"
                    hint={`Up to ${LIMITS.jobDescription.max.toLocaleString("en")} characters.`}
                    error={errors.description}
                  >
                    {(control) => (
                      <Textarea
                        {...control}
                        required
                        rows={4}
                        value={form.description}
                        onChange={(e) => updateForm("description", e.target.value)}
                      />
                    )}
                  </Field>
                  <Field
                    id={FIELD_IDS.apply_url}
                    label="Link to apply elsewhere (optional)"
                    hint="A full web address, starting with https://"
                    error={errors.apply_url}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        placeholder="https://"
                        value={form.apply_url}
                        onChange={(e) => updateForm("apply_url", e.target.value)}
                        className="min-h-11"
                      />
                    )}
                  </Field>
                  <Field
                    id={FIELD_IDS.tags}
                    label="Accessibility tags (optional)"
                    hint={`Separate tags with commas, for example: screen-reader friendly, step-free access. Up to ${LIMITS.tagCount} tags.`}
                    error={errors.tags}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        value={form.tags}
                        onChange={(e) => updateForm("tags", e.target.value)}
                        className="min-h-11"
                      />
                    )}
                  </Field>
                  <div className="flex min-h-11 items-center gap-3">
                    <Switch
                      id="job-remote"
                      checked={form.remote}
                      onCheckedChange={(v) => updateForm("remote", v)}
                    />
                    <Label htmlFor="job-remote">Remote</Label>
                  </div>
                  <div aria-live="assertive">
                    {formError && (
                      <p className="text-sm font-medium text-destructive dark:text-red-300">
                        {formError}
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      aria-disabled={saving || undefined}
                      className="min-h-11"
                    >
                      {saving ? (
                        <>
                          <Loader2
                            className="h-4 w-4 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                          Posting…
                        </>
                      ) : (
                        "Post job"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            !authLoading && (
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/login?next=/jobs">Sign in to post or apply</Link>
              </Button>
            )
          )}
        </div>

        {loadState === "unavailable" ? (
          <FeatureUnavailable feature="Jobs" headingLevel="h2" />
        ) : (
          <>
            <h2
              id={LIST_HEADING_ID}
              tabIndex={-1}
              className="mb-1 font-heading text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Listings
            </h2>
            <p aria-live="polite" className="mb-4 text-sm text-muted-foreground">
              {loadState === "ready" ? plural(jobs.length, "job", "jobs") : ""}
            </p>

            {loadState === "loading" ? (
              <InlineLoading label="Loading jobs…" />
            ) : loadState === "error" ? (
              <LoadProblem
                message="We could not load the jobs. Check your connection and try again."
                onRetry={retry}
                retrying={retrying}
              />
            ) : jobs.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">No jobs posted yet.</p>
            ) : (
              <ul className="space-y-4" role="list">
                {jobs.map((j) => {
                  const isOwner = userId === j.user_id;
                  return (
                    <li key={j.id}>
                      <article
                        id={itemId(j.id)}
                        tabIndex={-1}
                        aria-labelledby={`${itemId(j.id)}-title`}
                        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Card>
                          <CardHeader>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <CardTitle
                                  id={`${itemId(j.id)}-title`}
                                  className="flex items-start gap-2 text-xl leading-snug [overflow-wrap:anywhere]"
                                >
                                  <Briefcase
                                    className="mt-1 h-5 w-5 shrink-0 text-primary"
                                    aria-hidden="true"
                                  />
                                  <span className="min-w-0">{j.title}</span>
                                </CardTitle>
                                <p className="mt-1 text-muted-foreground [overflow-wrap:anywhere]">
                                  {j.company}
                                </p>
                                {(j.location || j.remote) && (
                                  <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                                    {j.location && (
                                      <>
                                        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                                        <span className="sr-only">Location: </span>
                                        {j.location}
                                      </>
                                    )}
                                    {j.remote && (
                                      <Badge variant="secondary" className="ml-1">
                                        Remote
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              {isOwner && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Delete "${j.title}"`}
                                  onClick={() => {
                                    setDeleteTarget({ kind: "job", job: j });
                                    setDeleteOpen(true);
                                  }}
                                  className="min-h-11 min-w-11 shrink-0"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                              {j.description}
                            </p>
                            {j.accessibility_tags.length > 0 && (
                              <ul
                                className="mt-3 flex flex-wrap gap-2"
                                aria-label="Accessibility tags"
                              >
                                {j.accessibility_tags.map((t) => (
                                  <li key={t} className="max-w-full">
                                    <Badge
                                      variant="outline"
                                      className="max-w-full [overflow-wrap:anywhere]"
                                    >
                                      {t}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                              {j.apply_url && (
                                <ExternalLinkButton href={j.apply_url}>
                                  Apply on the employer's site
                                  <span className="sr-only"> for {j.title}</span>
                                </ExternalLinkButton>
                              )}
                              {isOwner ? renderApplications(j) : renderApplyArea(j)}
                            </div>
                          </CardContent>
                        </Card>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={deleteCopy.title}
          description={deleteCopy.description}
          confirmLabel={deleteCopy.confirm}
          busyLabel={deleteTarget?.kind === "application" ? "Withdrawing…" : "Deleting…"}
          onConfirm={confirmDelete}
          focusAfterDelete={() => elementOrFallback(focusAfterDelete.current, LIST_HEADING_ID)}
        />
      </section>
    </Layout>
  );
};

export default Jobs;
