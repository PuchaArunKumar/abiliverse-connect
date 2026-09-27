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
import { Calendar, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ConfirmDeleteDialog from "@/components/community/ConfirmDeleteDialog";
import ExternalLinkButton from "@/components/community/ExternalLinkButton";
import Field from "@/components/community/Field";
import FilterRadioGroup from "@/components/community/FilterRadioGroup";
import InlineLoading from "@/components/community/InlineLoading";
import LoadProblem from "@/components/community/LoadProblem";
import { friendlyError } from "@/components/community/errors";
import { plural } from "@/components/community/format";
import { elementOrFallback, neighbourId } from "@/components/community/list";
import { useFocusRequest } from "@/components/community/useFocusRequest";
import {
  EVENT_FIELDS,
  EVENT_KIND_LABELS,
  LIMITS,
  firstErrorField,
  isEventKind,
  validateEvent,
  type EventField,
  type EventForm,
  type EventKind,
  type FieldErrors,
} from "@/components/community/validation";

type EventItem = Pick<
  Tables<"events">,
  | "id"
  | "user_id"
  | "kind"
  | "title"
  | "description"
  | "starts_at"
  | "location"
  | "link"
  | "created_at"
>;

const EVENT_COLUMNS =
  "id, user_id, kind, title, description, starts_at, location, link, created_at";

type Filter = "all" | EventKind;

const FILTER_OPTIONS: readonly { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "event", label: "Events" },
  { value: "opportunity", label: "Opportunities" },
  { value: "guidance", label: "Guidance" },
];

const EVENT_KIND_HEADINGS: Record<EventKind, string> = {
  event: "Events",
  opportunity: "Opportunities",
  guidance: "Guidance",
};

const EMPTY_FORM: EventForm = {
  kind: "event",
  title: "",
  description: "",
  starts_at: "",
  location: "",
  link: "",
};

const FIELD_IDS: Record<EventField, string> = {
  kind: "event-kind",
  title: "event-title",
  description: "event-description",
  starts_at: "event-starts-at",
  location: "event-location",
  link: "event-link",
};

const LIST_HEADING_ID = "opportunities-list-heading";
const itemId = (id: string) => `event-${id}`;

type LoadState = "loading" | "ready" | "error" | "unavailable";

const Opportunities = () => {
  useDocumentTitle("Events, opportunities and guidance");
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const requestFocus = useFocusRequest();

  const [items, setItems] = useState<EventItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retrying, setRetrying] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors<EventField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const focusAfterDelete = useRef<string | null>(null);

  // Only the newest request may write to state, so a slow response from
  // before sign-in cannot overwrite the list that came after it.
  const requestId = useRef(0);

  const load = useCallback(async (): Promise<boolean> => {
    const id = ++requestId.current;
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .order("created_at", { ascending: false });
    if (id !== requestId.current) return false;
    setRetrying(false);
    if (error) {
      setLoadState(isMissingSchemaError(error) ? "unavailable" : "error");
      return false;
    }
    setItems(data ?? []);
    setLoadState("ready");
    return true;
  }, []);

  useEffect(() => {
    // Wait until we know who is looking, rather than loading once as a
    // visitor and again as the member a moment later. userId is listed so a
    // sign-in or sign-out reloads the list under the new session.
    if (authLoading) return;
    void load();
  }, [authLoading, userId, load]);

  const retry = () => {
    setRetrying(true);
    void load().then((ok) => {
      if (ok) requestFocus(LIST_HEADING_ID);
    });
  };

  const updateForm = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || savingRef.current) return;
    const { values, errors: found } = validateEvent(form);
    setErrors(found);
    setFormError(null);
    const first = firstErrorField(EVENT_FIELDS, found);
    if (first) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    const { data, error } = await supabase
      .from("events")
      .insert({ user_id: user.id, ...values })
      .select(EVENT_COLUMNS)
      .single();
    savingRef.current = false;
    setSaving(false);
    if (error) {
      setFormError(friendlyError(error, "This could not be shared. Please try again."));
      return;
    }
    setItems((prev) => [data, ...prev]);
    setForm(EMPTY_FORM);
    setErrors({});
    setOpen(false);
    toast.success("Shared with the community");
  };

  const shown = filter === "all" ? items : items.filter((i) => i.kind === filter);

  const confirmDelete = async (): Promise<string | null> => {
    const target = deleteTarget;
    if (!target) return null;
    const { error } = await supabase.from("events").delete().eq("id", target.id);
    if (error) {
      return friendlyError(error, "This could not be deleted. Please try again.");
    }
    focusAfterDelete.current = neighbourId(
      shown.map((i) => i.id),
      target.id,
    );
    setItems((prev) => prev.filter((i) => i.id !== target.id));
    toast.success("Deleted");
    return null;
  };

  const kindLabel = (kind: string) => (isEventKind(kind) ? EVENT_KIND_LABELS[kind] : kind);

  return (
    <Layout>
      <section className="container max-w-4xl py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold">
              Events, Opportunities & Guidance
            </h1>
            <p className="text-muted-foreground">
              Share meetups, scholarships, mentorship offers, and helpful advice.
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
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Share
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Share with the community</DialogTitle>
                  <DialogDescription>
                    It will be listed on this page for others to read.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} noValidate className="space-y-4">
                  <Field id={FIELD_IDS.kind} label="Type" error={errors.kind}>
                    {(control) => (
                      <Select
                        value={form.kind}
                        onValueChange={(v) => {
                          if (isEventKind(v)) updateForm("kind", v);
                        }}
                      >
                        <SelectTrigger {...control} className="min-h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="event">Event / Meetup</SelectItem>
                          <SelectItem value="opportunity">Opportunity</SelectItem>
                          <SelectItem value="guidance">Guidance / Advice</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  <Field
                    id={FIELD_IDS.title}
                    label="Title"
                    hint={`${LIMITS.eventTitle.min} to ${LIMITS.eventTitle.max} characters.`}
                    error={errors.title}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        required
                        maxLength={LIMITS.eventTitle.max}
                        value={form.title}
                        onChange={(e) => updateForm("title", e.target.value)}
                        className="min-h-11"
                      />
                    )}
                  </Field>
                  <Field
                    id={FIELD_IDS.description}
                    label="Description"
                    hint={`Up to ${LIMITS.eventDescription.max.toLocaleString("en")} characters.`}
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
                  {form.kind === "event" && (
                    <>
                      <Field
                        id={FIELD_IDS.starts_at}
                        label="Date and time (optional)"
                        hint="In your local time."
                        error={errors.starts_at}
                      >
                        {(control) => (
                          <Input
                            {...control}
                            type="datetime-local"
                            value={form.starts_at}
                            onChange={(e) => updateForm("starts_at", e.target.value)}
                            className="min-h-11"
                          />
                        )}
                      </Field>
                      <Field
                        id={FIELD_IDS.location}
                        label="Location (optional)"
                        error={errors.location}
                      >
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
                    </>
                  )}
                  <Field
                    id={FIELD_IDS.link}
                    label="Link (optional)"
                    hint="A full web address, starting with https://"
                    error={errors.link}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        placeholder="https://"
                        value={form.link}
                        onChange={(e) => updateForm("link", e.target.value)}
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
                <Link to="/login?next=/opportunities">Sign in to share</Link>
              </Button>
            )
          )}
        </div>

        {loadState === "unavailable" ? (
          <FeatureUnavailable
            feature="Events, opportunities and guidance"
            headingLevel="h2"
          />
        ) : (
          <>
            <FilterRadioGroup<Filter>
              legend="Show"
              name="opportunity-filter"
              value={filter}
              options={FILTER_OPTIONS}
              onChange={setFilter}
              className="mb-6"
            />

            <h2
              id={LIST_HEADING_ID}
              tabIndex={-1}
              className="mb-1 font-heading text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {filter === "all" ? "All listings" : EVENT_KIND_HEADINGS[filter]}
            </h2>
            <p aria-live="polite" className="mb-4 text-sm text-muted-foreground">
              {loadState === "ready"
                ? filter === "all"
                  ? plural(items.length, "listing", "listings")
                  : `Showing ${shown.length.toLocaleString("en")} of ${plural(items.length, "listing", "listings")}`
                : ""}
            </p>

            {loadState === "loading" ? (
              <InlineLoading label="Loading listings…" />
            ) : loadState === "error" ? (
              <LoadProblem
                message="We could not load the listings. Check your connection and try again."
                onRetry={retry}
                retrying={retrying}
              />
            ) : shown.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                {items.length === 0 ? "Nothing here yet." : "Nothing of this type yet."}
              </p>
            ) : (
              <ul className="space-y-4" role="list">
                {shown.map((e) => (
                  <li key={e.id}>
                    <article
                      id={itemId(e.id)}
                      tabIndex={-1}
                      aria-labelledby={`${itemId(e.id)}-title`}
                      className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Card>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Badge className="mb-2" variant="secondary">
                                {kindLabel(e.kind)}
                              </Badge>
                              <CardTitle
                                id={`${itemId(e.id)}-title`}
                                className="flex items-start gap-2 text-xl leading-snug [overflow-wrap:anywhere]"
                              >
                                <Calendar
                                  className="mt-1 h-5 w-5 shrink-0 text-primary"
                                  aria-hidden="true"
                                />
                                <span className="min-w-0">{e.title}</span>
                              </CardTitle>
                              {e.starts_at && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  <time dateTime={e.starts_at}>
                                    {format(new Date(e.starts_at), "PPp")}
                                  </time>
                                </p>
                              )}
                              {e.location && (
                                <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                  <span className="sr-only">Location: </span>
                                  {e.location}
                                </p>
                              )}
                            </div>
                            {userId === e.user_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete "${e.title}"`}
                                onClick={() => {
                                  setDeleteTarget(e);
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
                            {e.description}
                          </p>
                          {e.link && (
                            <div className="mt-4">
                              <ExternalLinkButton href={e.link} size="sm">
                                Open link
                                <span className="sr-only"> for {e.title}</span>
                              </ExternalLinkButton>
                            </div>
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
          title={deleteTarget ? `Delete "${deleteTarget.title}"?` : "Delete this listing?"}
          description="It will be removed for everyone. This cannot be undone."
          confirmLabel="Delete listing"
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

export default Opportunities;
