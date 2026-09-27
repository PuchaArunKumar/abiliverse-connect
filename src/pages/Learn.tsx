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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GraduationCap, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmDeleteDialog from "@/components/community/ConfirmDeleteDialog";
import ExternalLinkButton from "@/components/community/ExternalLinkButton";
import Field from "@/components/community/Field";
import InlineLoading from "@/components/community/InlineLoading";
import LoadProblem from "@/components/community/LoadProblem";
import { friendlyError } from "@/components/community/errors";
import { plural } from "@/components/community/format";
import { elementOrFallback, neighbourId } from "@/components/community/list";
import { useFocusRequest } from "@/components/community/useFocusRequest";
import {
  COURSE_FIELDS,
  COURSE_LEVELS,
  COURSE_LEVEL_LABELS,
  LIMITS,
  firstErrorField,
  isCourseLevel,
  validateCourse,
  type CourseField,
  type CourseForm,
  type FieldErrors,
} from "@/components/community/validation";

type Course = Pick<
  Tables<"courses">,
  "id" | "user_id" | "title" | "description" | "provider" | "url" | "level" | "tags" | "created_at"
>;

const COURSE_COLUMNS = "id, user_id, title, description, provider, url, level, tags, created_at";

const EMPTY_FORM: CourseForm = {
  title: "",
  description: "",
  provider: "",
  url: "",
  level: "beginner",
  tags: "",
};

const FIELD_IDS: Record<CourseField, string> = {
  title: "course-title",
  description: "course-description",
  provider: "course-provider",
  url: "course-url",
  level: "course-level",
  tags: "course-tags",
};

const LIST_HEADING_ID = "learn-list-heading";
const itemId = (id: string) => `course-${id}`;

type LoadState = "loading" | "ready" | "error" | "unavailable";

const Learn = () => {
  useDocumentTitle("Learning Hub");
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const requestFocus = useFocusRequest();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retrying, setRetrying] = useState(false);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors<CourseField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const focusAfterDelete = useRef<string | null>(null);

  // Only the newest request may write to state (see Opportunities).
  const requestId = useRef(0);

  const load = useCallback(async (): Promise<boolean> => {
    const id = ++requestId.current;
    const { data, error } = await supabase
      .from("courses")
      .select(COURSE_COLUMNS)
      .order("created_at", { ascending: false });
    if (id !== requestId.current) return false;
    setRetrying(false);
    if (error) {
      setLoadState(isMissingSchemaError(error) ? "unavailable" : "error");
      return false;
    }
    setCourses(data ?? []);
    setLoadState("ready");
    return true;
  }, []);

  useEffect(() => {
    // userId is listed so a sign-in or sign-out reloads under the new session.
    if (authLoading) return;
    void load();
  }, [authLoading, userId, load]);

  const retry = () => {
    setRetrying(true);
    void load().then((ok) => {
      if (ok) requestFocus(LIST_HEADING_ID);
    });
  };

  const updateForm = <K extends keyof CourseForm>(key: K, value: CourseForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || savingRef.current) return;
    const { values, errors: found } = validateCourse(form);
    setErrors(found);
    setFormError(null);
    const first = firstErrorField(COURSE_FIELDS, found);
    if (first) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    const { data, error } = await supabase
      .from("courses")
      .insert({ user_id: user.id, ...values })
      .select(COURSE_COLUMNS)
      .single();
    savingRef.current = false;
    setSaving(false);
    if (error) {
      setFormError(friendlyError(error, "The resource could not be shared. Please try again."));
      return;
    }
    setCourses((prev) => [data, ...prev]);
    setForm(EMPTY_FORM);
    setErrors({});
    setOpen(false);
    toast.success("Resource shared");
  };

  const confirmDelete = async (): Promise<string | null> => {
    const target = deleteTarget;
    if (!target) return null;
    const { error } = await supabase.from("courses").delete().eq("id", target.id);
    if (error) {
      return friendlyError(error, "The resource could not be deleted. Please try again.");
    }
    focusAfterDelete.current = neighbourId(
      courses.map((c) => c.id),
      target.id,
    );
    setCourses((prev) => prev.filter((c) => c.id !== target.id));
    toast.success("Resource deleted");
    return null;
  };

  const levelLabel = (level: string) => (isCourseLevel(level) ? COURSE_LEVEL_LABELS[level] : level);

  return (
    <Layout>
      <section className="container max-w-4xl py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold">Learning Hub</h1>
            <p className="text-muted-foreground">
              Courses, tutorials, and resources shared by the community.
            </p>
          </div>
          {user ? (
            <Dialog
              open={open}
              onOpenChange={(next) => {
                if (savingRef.current) return;
                setOpen(next);
                if (next) setFormError(null);
              }}
            >
              <DialogTrigger asChild>
                <Button className="min-h-11">
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Share a resource
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Share a learning resource</DialogTitle>
                  <DialogDescription>
                    It will be listed in the Learning Hub for others to use.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} noValidate className="space-y-4">
                  <Field
                    id={FIELD_IDS.title}
                    label="Title"
                    hint={`${LIMITS.courseTitle.min} to ${LIMITS.courseTitle.max} characters.`}
                    error={errors.title}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        required
                        maxLength={LIMITS.courseTitle.max}
                        value={form.title}
                        onChange={(e) => updateForm("title", e.target.value)}
                        className="min-h-11"
                      />
                    )}
                  </Field>
                  <Field
                    id={FIELD_IDS.description}
                    label="Description"
                    hint={`Up to ${LIMITS.courseDescription.max.toLocaleString("en")} characters.`}
                    error={errors.description}
                  >
                    {(control) => (
                      <Textarea
                        {...control}
                        required
                        rows={3}
                        value={form.description}
                        onChange={(e) => updateForm("description", e.target.value)}
                      />
                    )}
                  </Field>
                  <Field
                    id={FIELD_IDS.provider}
                    label="Provider (optional)"
                    hint="For example Coursera or YouTube."
                    error={errors.provider}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        maxLength={LIMITS.shortText.max}
                        value={form.provider}
                        onChange={(e) => updateForm("provider", e.target.value)}
                        className="min-h-11"
                      />
                    )}
                  </Field>
                  <Field
                    id={FIELD_IDS.url}
                    label="Link (optional)"
                    hint="A full web address, starting with https://"
                    error={errors.url}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        placeholder="https://"
                        value={form.url}
                        onChange={(e) => updateForm("url", e.target.value)}
                        className="min-h-11"
                      />
                    )}
                  </Field>
                  <Field id={FIELD_IDS.level} label="Level" error={errors.level}>
                    {(control) => (
                      <Select
                        value={form.level}
                        onValueChange={(v) => {
                          if (isCourseLevel(v)) updateForm("level", v);
                        }}
                      >
                        <SelectTrigger {...control} className="min-h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COURSE_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {COURSE_LEVEL_LABELS[level]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  <Field
                    id={FIELD_IDS.tags}
                    label="Tags (optional)"
                    hint={`Separate tags with commas. Up to ${LIMITS.tagCount} tags of ${LIMITS.tagLength} characters each.`}
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
                          Sharing…
                        </>
                      ) : (
                        "Share"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            !authLoading && (
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/login?next=/learn">Sign in to share a resource</Link>
              </Button>
            )
          )}
        </div>

        {loadState === "unavailable" ? (
          <FeatureUnavailable feature="The Learning Hub" headingLevel="h2" />
        ) : (
          <>
            <h2
              id={LIST_HEADING_ID}
              tabIndex={-1}
              className="mb-1 font-heading text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Resources
            </h2>
            <p aria-live="polite" className="mb-4 text-sm text-muted-foreground">
              {loadState === "ready" ? plural(courses.length, "resource", "resources") : ""}
            </p>

            {loadState === "loading" ? (
              <InlineLoading label="Loading resources…" />
            ) : loadState === "error" ? (
              <LoadProblem
                message="We could not load the resources. Check your connection and try again."
                onRetry={retry}
                retrying={retrying}
              />
            ) : courses.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">No resources yet.</p>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2" role="list">
                {courses.map((c) => (
                  <li key={c.id} className="min-w-0">
                    <article
                      id={itemId(c.id)}
                      tabIndex={-1}
                      aria-labelledby={`${itemId(c.id)}-title`}
                      className="h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Card className="h-full">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle
                              id={`${itemId(c.id)}-title`}
                              className="flex min-w-0 items-start gap-2 text-xl leading-snug [overflow-wrap:anywhere]"
                            >
                              <GraduationCap
                                className="mt-1 h-5 w-5 shrink-0 text-primary"
                                aria-hidden="true"
                              />
                              <span className="min-w-0">{c.title}</span>
                            </CardTitle>
                            {userId === c.user_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete "${c.title}"`}
                                onClick={() => {
                                  setDeleteTarget(c);
                                  setDeleteOpen(true);
                                }}
                                className="min-h-11 min-w-11 shrink-0"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                          {c.provider && (
                            <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                              {c.provider}
                            </p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <p className="mb-3 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                            {c.description}
                          </p>
                          <div className="mb-3 flex flex-wrap gap-2">
                            <Badge variant="secondary">
                              <span className="sr-only">Level: </span>
                              {levelLabel(c.level)}
                            </Badge>
                            {c.tags.map((t) => (
                              <Badge
                                key={t}
                                variant="outline"
                                className="max-w-full [overflow-wrap:anywhere]"
                              >
                                {t}
                              </Badge>
                            ))}
                          </div>
                          {c.url && (
                            <ExternalLinkButton href={c.url} size="sm">
                              Open
                              <span className="sr-only"> {c.title}</span>
                            </ExternalLinkButton>
                          )}
                        </CardContent>
                      </Card>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={deleteTarget ? `Delete "${deleteTarget.title}"?` : "Delete this resource?"}
          description="It will be removed from the Learning Hub for everyone. This cannot be undone."
          confirmLabel="Delete resource"
          onConfirm={confirmDelete}
          focusAfterDelete={() =>
            elementOrFallback(
              focusAfterDelete.current ? itemId(focusAfterDelete.current) : null,
              LIST_HEADING_ID,
            )
          }
        />
      </section>
    </Layout>
  );
};

export default Learn;
