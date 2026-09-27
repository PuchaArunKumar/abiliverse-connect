import {
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MediaUploader, { type MediaUploaderProps } from "@/components/problems/MediaUploader";
import SimilarProblems from "@/components/problems/SimilarProblems";
import {
  AGE_GROUPS,
  AGE_GROUP_LABELS,
  DESCRIPTION_MAX,
  DISABILITY_TYPES,
  DISABILITY_TYPE_LABELS,
  EXISTING_SOLUTIONS_MAX,
  MAX_RESEARCH_LINKS,
  MAX_TAGS,
  PROBLEM_STATUSES,
  PROBLEM_STATUS_LABELS,
  SEVERITY_LABELS,
  SEVERITY_LEVELS,
  SHORT_TEXT_MAX,
  TITLE_MAX,
  TITLE_MIN,
  DESCRIPTION_MIN,
  validateDraft,
  type DraftErrors,
  type DraftField,
  type ProblemDraft,
  type ProblemStatus,
  type SeverityLevel,
} from "@/lib/problems";
import {
  mediaDescriptionFieldId,
  pendingDescriptionErrors,
  type PendingMedia,
} from "@/lib/media";
import { safeHref } from "@/lib/safe-url";

type MediaProps = Omit<
  MediaUploaderProps,
  "pending" | "onPendingChange" | "descriptionErrors" | "disabled"
>;

export interface ProblemFormProps {
  mode: "create" | "edit";
  draft: ProblemDraft;
  onDraftChange: Dispatch<SetStateAction<ProblemDraft>>;
  pending: PendingMedia[];
  onPendingChange: Dispatch<SetStateAction<PendingMedia[]>>;
  media: MediaProps;
  submitting: boolean;
  /** What is happening during a long save, e.g. "Uploading file 2 of 3". */
  progress?: string;
  submitLabel: string;
  busyLabel: string;
  /** Called only once the draft and every file description are valid. */
  onSubmit: () => void;
  onCancel: () => void;
}

const FIELD_IDS: Record<DraftField, string> = {
  title: "p-title",
  description: "p-description",
  category: "p-category",
  country: "p-country",
  existingSolutions: "p-existing",
  tags: "p-tags",
  relatedResearch: "p-research",
};

// Summary order follows the order of the fields on the page.
const FIELD_ORDER: DraftField[] = [
  "title",
  "description",
  "category",
  "country",
  "existingSolutions",
  "relatedResearch",
  "tags",
];

type LegacyKey = "imageUrls" | "videoUrls" | "documentUrls";

const LEGACY_LABELS: Record<LegacyKey, string> = {
  imageUrls: "Image link",
  videoUrls: "Video link",
  documentUrls: "Document link",
};

interface SummaryItem {
  target: string;
  message: string;
}

function summarise(
  fieldErrors: DraftErrors,
  pending: PendingMedia[],
  mediaErrors: Record<string, string>,
): SummaryItem[] {
  return [
    ...FIELD_ORDER.filter((f) => fieldErrors[f]).map((f) => ({
      target: FIELD_IDS[f],
      message: fieldErrors[f] as string,
    })),
    ...pending
      .filter((p) => mediaErrors[p.id])
      .map((p) => ({ target: mediaDescriptionFieldId(p.id), message: mediaErrors[p.id] })),
  ];
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Error text under a field; the id is what aria-describedby points at. */
const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} className="mt-1 text-sm font-medium text-destructive">
      {message}
    </p>
  ) : null;

function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const list = ids.filter(Boolean);
  return list.length ? list.join(" ") : undefined;
}

/**
 * The problem report form, shared by "Report a problem" and "Edit problem".
 *
 * Validation runs on submit rather than by disabling the button: a disabled
 * button cannot tell anyone what is missing. After the first attempt, messages
 * update as the person types, so a fixed field stops being flagged.
 */
const ProblemForm = ({
  mode,
  draft,
  onDraftChange,
  pending,
  onPendingChange,
  media,
  submitting,
  progress,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
}: ProblemFormProps) => {
  const [attempted, setAttempted] = useState(false);
  // The summary is a snapshot from the last submit, not live: re-announcing an
  // alert on every keystroke would drown out what the person is typing. The
  // messages beside each field do update live.
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const legacyRef = useRef<HTMLDivElement>(null);

  const fieldErrors: DraftErrors = attempted ? validateDraft(draft) : {};
  const mediaErrors: Record<string, string> = attempted
    ? pendingDescriptionErrors(pending)
    : {};

  // A file removed since the last submit takes its summary entry with it, so
  // no link points at a field that is no longer there.
  const pendingFieldIds = new Set(pending.map((p) => mediaDescriptionFieldId(p.id)));
  const shownSummary = summary.filter(
    (item) => !item.target.startsWith("media-desc-") || pendingFieldIds.has(item.target),
  );

  const set = <K extends keyof ProblemDraft>(key: K, value: ProblemDraft[K]) =>
    onDraftChange((prev) => ({ ...prev, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setAttempted(true);
    const items = summarise(validateDraft(draft), pending, pendingDescriptionErrors(pending));
    setSummary(items);
    if (items.length > 0) {
      // Move focus to the summary so the problems are read out, with links to
      // each field; after render, because the summary is about to change.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    onSubmit();
  };

  const removeLegacy = (key: LegacyKey, url: string) => {
    onDraftChange((prev) => ({ ...prev, [key]: prev[key].filter((u) => u !== url) }));
    // The pressed button is gone; keep focus in the same group, or on the
    // field before it once the last link (and so the group) has gone.
    requestAnimationFrame(() =>
      (legacyRef.current ?? document.getElementById(FIELD_IDS.tags))?.focus(),
    );
  };

  const legacy = (["imageUrls", "videoUrls", "documentUrls"] as LegacyKey[]).flatMap(
    (key) => draft[key].map((url) => ({ key, url })),
  );

  const errorId = (field: DraftField) => `${FIELD_IDS[field]}-error`;
  const invalid = (field: DraftField) => (fieldErrors[field] ? true : undefined);

  const hint = (id: string, text: ReactNode) => (
    <p id={id} className="mt-1 text-sm text-muted-foreground">
      {text}
    </p>
  );

  return (
    <form onSubmit={submit} className="mt-8 space-y-6" noValidate>
      <div ref={summaryRef} tabIndex={-1} role="alert" className="focus:outline-none">
        {shownSummary.length > 0 && (
          <div className="rounded-lg border border-destructive p-4">
            <h2 className="font-heading text-lg font-semibold text-destructive">
              {shownSummary.length === 1
                ? "One thing needs fixing before you can continue"
                : `${shownSummary.length} things need fixing before you can continue`}
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" role="list">
              {shownSummary.map((item) => (
                <li key={`${item.target}-${item.message}`} className="break-words [overflow-wrap:anywhere]">
                  <a
                    href={`#${item.target}`}
                    className="text-destructive underline underline-offset-2"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(item.target)?.focus();
                    }}
                  >
                    {item.message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Title and description are required. Everything else is optional.
      </p>

      <div>
        <Label htmlFor="p-title">Title (required)</Label>
        <Input
          id="p-title"
          className="mt-1"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Public transport apps do not announce stops audibly"
          required
          maxLength={TITLE_MAX}
          aria-invalid={invalid("title")}
          aria-describedby={describedBy("p-title-hint", fieldErrors.title && errorId("title"))}
        />
        {hint("p-title-hint", `At least ${TITLE_MIN} characters. A clear, specific summary.`)}
        <FieldError id={errorId("title")} message={fieldErrors.title} />
      </div>

      {mode === "create" && <SimilarProblems title={draft.title} />}

      <div>
        <Label htmlFor="p-description">Description (required)</Label>
        <Textarea
          id="p-description"
          className="mt-1"
          rows={6}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          required
          maxLength={DESCRIPTION_MAX}
          aria-invalid={invalid("description")}
          aria-describedby={describedBy(
            "p-description-hint",
            fieldErrors.description && errorId("description"),
          )}
        />
        {hint(
          "p-description-hint",
          `At least ${DESCRIPTION_MIN} characters. What happens, who it affects, and why current options fall short.`,
        )}
        <FieldError id={errorId("description")} message={fieldErrors.description} />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">
          Disability types affected
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {DISABILITY_TYPES.map((d) => (
            <div key={d} className="flex min-h-11 items-center gap-2">
              <Checkbox
                id={`dt-${d}`}
                checked={draft.disabilityTypes.includes(d)}
                onCheckedChange={() =>
                  onDraftChange((prev) => ({
                    ...prev,
                    disabilityTypes: toggle(prev.disabilityTypes, d),
                  }))
                }
              />
              <Label htmlFor={`dt-${d}`} className="font-normal">
                {DISABILITY_TYPE_LABELS[d]}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Age groups affected</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {AGE_GROUPS.map((a) => (
            <div key={a} className="flex min-h-11 items-center gap-2">
              <Checkbox
                id={`ag-${a}`}
                checked={draft.ageGroups.includes(a)}
                onCheckedChange={() =>
                  onDraftChange((prev) => ({ ...prev, ageGroups: toggle(prev.ageGroups, a) }))
                }
              />
              <Label htmlFor={`ag-${a}`} className="font-normal">
                {AGE_GROUP_LABELS[a]}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="p-category">Category</Label>
          <Input
            id="p-category"
            className="mt-1"
            value={draft.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="Transport"
            maxLength={SHORT_TEXT_MAX}
            aria-invalid={invalid("category")}
            aria-describedby={describedBy(fieldErrors.category && errorId("category"))}
          />
          <FieldError id={errorId("category")} message={fieldErrors.category} />
        </div>
        <div>
          <Label htmlFor="p-country">Country</Label>
          <Input
            id="p-country"
            className="mt-1"
            value={draft.country}
            onChange={(e) => set("country", e.target.value)}
            placeholder="India"
            maxLength={SHORT_TEXT_MAX}
            autoComplete="country-name"
            aria-invalid={invalid("country")}
            aria-describedby={describedBy(fieldErrors.country && errorId("country"))}
          />
          <FieldError id={errorId("country")} message={fieldErrors.country} />
        </div>
        <div>
          <Label htmlFor="p-severity">Severity</Label>
          <Select
            value={draft.severity}
            onValueChange={(v) => set("severity", v as SeverityLevel | "unspecified")}
          >
            <SelectTrigger id="p-severity" className="mt-1 min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unspecified">Not specified</SelectItem>
              {SEVERITY_LEVELS.map((s) => (
                <SelectItem key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {mode === "edit" && (
        <div className="sm:max-w-xs">
          <Label htmlFor="p-status">Status</Label>
          <Select value={draft.status} onValueChange={(v) => set("status", v as ProblemStatus)}>
            <SelectTrigger id="p-status" className="mt-1 min-h-11" aria-describedby="p-status-hint">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROBLEM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PROBLEM_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hint("p-status-hint", "Let people know if someone is working on this or it has been solved.")}
        </div>
      )}

      <div>
        <Label htmlFor="p-existing">Existing solutions you know of</Label>
        <Textarea
          id="p-existing"
          className="mt-1"
          rows={3}
          value={draft.existingSolutions}
          onChange={(e) => set("existingSolutions", e.target.value)}
          maxLength={EXISTING_SOLUTIONS_MAX}
          placeholder="What people currently do, and where it falls short."
          aria-invalid={invalid("existingSolutions")}
          aria-describedby={describedBy(
            fieldErrors.existingSolutions && errorId("existingSolutions"),
          )}
        />
        <FieldError id={errorId("existingSolutions")} message={fieldErrors.existingSolutions} />
      </div>

      <div>
        <Label htmlFor="p-research">Related research</Label>
        <Textarea
          id="p-research"
          className="mt-1"
          rows={3}
          value={draft.relatedResearch}
          onChange={(e) => set("relatedResearch", e.target.value)}
          placeholder="https://example.org/study"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={invalid("relatedResearch")}
          aria-describedby={describedBy(
            "p-research-hint",
            fieldErrors.relatedResearch && errorId("relatedResearch"),
          )}
        />
        {hint(
          "p-research-hint",
          `Links to studies, articles or standards, one per line, each starting with http:// or https://. Up to ${MAX_RESEARCH_LINKS}.`,
        )}
        <FieldError id={errorId("relatedResearch")} message={fieldErrors.relatedResearch} />
      </div>

      <div>
        <Label htmlFor="p-tags">Tags</Label>
        <Input
          id="p-tags"
          className="mt-1"
          value={draft.tags}
          onChange={(e) => set("tags", e.target.value)}
          placeholder="screen-reader, navigation, public-transport"
          aria-invalid={invalid("tags")}
          aria-describedby={describedBy("p-tags-hint", fieldErrors.tags && errorId("tags"))}
        />
        {hint("p-tags-hint", `Comma separated, up to ${MAX_TAGS}.`)}
        <FieldError id={errorId("tags")} message={fieldErrors.tags} />
      </div>

      {legacy.length > 0 && (
        <div ref={legacyRef} tabIndex={-1} className="focus:outline-none">
          <p className="text-sm font-medium text-foreground" id="legacy-links-label">
            Linked files
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Links added before uploads were available. You can remove them; new
            files go through the uploader below, which asks for a description.
          </p>
          <ul className="mt-2 space-y-2" role="list" aria-labelledby="legacy-links-label">
            {legacy.map(({ key, url }) => {
              const href = safeHref(url);
              return (
                <li
                  key={`${key}-${url}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1"
                >
                  <span className="min-w-0 break-words text-sm [overflow-wrap:anywhere]">
                    {LEGACY_LABELS[key]}:{" "}
                    {href ? (
                      <a href={href} rel="noopener noreferrer ugc" className="text-primary underline underline-offset-2">
                        {url}
                      </a>
                    ) : (
                      url
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11 shrink-0"
                    aria-label={`Remove ${LEGACY_LABELS[key].toLowerCase()} ${url}`}
                    onClick={() => removeLegacy(key, url)}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          Photos, video and documents
        </legend>
        <MediaUploader
          {...media}
          pending={pending}
          onPendingChange={onPendingChange}
          descriptionErrors={mediaErrors}
          disabled={submitting}
        />
      </fieldset>

      <p role="status" className="text-sm text-muted-foreground">
        {submitting ? progress ?? busyLabel : ""}
      </p>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="min-h-11" aria-disabled={submitting}>
          {submitting ? (
            <>
              <Loader2
                className="mr-1 h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {busyLabel}
            </>
          ) : (
            submitLabel
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-disabled={submitting}
          onClick={() => {
            if (!submitting) onCancel();
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default ProblemForm;
