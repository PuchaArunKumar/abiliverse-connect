import type { Database } from "@/integrations/supabase/types";
import { isSafeHttpUrl } from "@/lib/safe-url";
import { isMissingSchemaError } from "@/lib/supabase-errors";

export type DisabilityType = Database["public"]["Enums"]["disability_type"];
export type SeverityLevel = Database["public"]["Enums"]["severity_level"];
export type AgeGroup = Database["public"]["Enums"]["age_group"];
export type ProblemStatus = Database["public"]["Enums"]["problem_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export type Problem = Omit<
  Database["public"]["Tables"]["problems"]["Row"],
  "search_vector"
>;

/**
 * Person-first labels for the stored enum values. Kept in one place so the
 * wording stays consistent everywhere it is shown, and so it can be handed to
 * a translator as a single unit.
 */
export const DISABILITY_TYPE_LABELS: Record<DisabilityType, string> = {
  visual: "Visual",
  hearing: "Hearing",
  mobility: "Mobility",
  cognitive: "Cognitive and learning",
  speech: "Speech and communication",
  neurological: "Neurological",
  chronic_illness: "Chronic illness",
  mental_health: "Mental health",
  multiple: "Multiple disabilities",
  other: "Other",
};

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
  profound: "Profound",
};

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  infant: "Infant (0–2)",
  child: "Child (3–12)",
  adolescent: "Adolescent (13–17)",
  adult: "Adult (18–64)",
  older_adult: "Older adult (65+)",
  all_ages: "All ages",
};

export const PROBLEM_STATUS_LABELS: Record<ProblemStatus, string> = {
  open: "Open",
  in_progress: "Being worked on",
  solved: "Solved",
  archived: "Archived",
};

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  person_with_disability: "Person with disability",
  caregiver: "Caregiver",
  parent: "Parent",
  researcher: "Researcher",
  student: "Student",
  developer: "Developer",
  designer: "Designer",
  healthcare_professional: "Healthcare professional",
  ngo: "NGO",
  startup: "Startup",
  company: "Company",
  university: "University",
  government: "Government organisation",
  volunteer: "Volunteer",
  investor: "Investor",
  mentor: "Mentor",
  admin: "Administrator",
  moderator: "Moderator",
};

export const DISABILITY_TYPES = Object.keys(
  DISABILITY_TYPE_LABELS,
) as DisabilityType[];
export const SEVERITY_LEVELS = Object.keys(SEVERITY_LABELS) as SeverityLevel[];
export const AGE_GROUPS = Object.keys(AGE_GROUP_LABELS) as AgeGroup[];
export const PROBLEM_STATUSES = Object.keys(
  PROBLEM_STATUS_LABELS,
) as ProblemStatus[];

/** Badge tone per status, so "solved" reads as resolved rather than as an alert. */
export const STATUS_VARIANTS: Record<
  ProblemStatus,
  "default" | "secondary" | "outline"
> = {
  open: "default",
  in_progress: "secondary",
  solved: "outline",
  archived: "outline",
};

/** Shown wherever a profile has no display name, or cannot be read. */
export const FALLBACK_DISPLAY_NAME = "Community member";

// Limits mirror the CHECK constraints on public.problems and its child tables,
// so the form says what is wrong before the database refuses it.
export const TITLE_MIN = 8;
export const TITLE_MAX = 200;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 20000;
export const SHORT_TEXT_MAX = 100;
export const EXISTING_SOLUTIONS_MAX = 10000;
export const MAX_TAGS = 20;
export const MAX_RESEARCH_LINKS = 20;
export const COMMENT_MAX = 5000;
export const REPORT_REASON_MAX = 2000;

/** Rows fetched per page of the problem list. */
export const PROBLEM_PAGE_SIZE = 20;

export function parseTags(raw: string): string[] {
  return uniqueTags(raw).slice(0, MAX_TAGS);
}

function uniqueTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Date and time, for edit history where several edits can share a day. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when the route parameter can be a problem id. Anything else is a
 * mistyped link: asking the database would only earn a raw "invalid input
 * syntax for type uuid" error, so the page shows "not found" straight away.
 */
export function isProblemId(value: string | null | undefined): value is string {
  return UUID_PATTERN.test(value ?? "");
}

/**
 * updated_at is bumped only by real edits (the trigger skips counter changes),
 * so any gap from created_at means someone changed the report. A minute's
 * slack covers the two timestamps being written by separate statements.
 */
export function wasEdited(createdAt: string, updatedAt: string): boolean {
  const created = Date.parse(createdAt);
  const updated = Date.parse(updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated - created > 60_000;
}

// DRAFT -------------------------------------------------------------------

/**
 * The form's working copy of a problem. Free-text fields stay as typed (tags
 * comma separated, research links one per line) so the form never rewrites
 * what someone is in the middle of entering; draftToPayload normalises them.
 */
export interface ProblemDraft {
  title: string;
  description: string;
  category: string;
  country: string;
  severity: SeverityLevel | "unspecified";
  status: ProblemStatus;
  disabilityTypes: DisabilityType[];
  ageGroups: AgeGroup[];
  existingSolutions: string;
  tags: string;
  relatedResearch: string;
  // Links from before uploads existed. The form can remove these but not add
  // to them: new files go through the uploader, which requires a description.
  imageUrls: string[];
  videoUrls: string[];
  documentUrls: string[];
}

export const EMPTY_DRAFT: ProblemDraft = {
  title: "",
  description: "",
  category: "",
  country: "",
  severity: "unspecified",
  status: "open",
  disabilityTypes: [],
  ageGroups: [],
  existingSolutions: "",
  tags: "",
  relatedResearch: "",
  imageUrls: [],
  videoUrls: [],
  documentUrls: [],
};

type DraftSource = Pick<
  Problem,
  | "title"
  | "description"
  | "category"
  | "country"
  | "severity"
  | "status"
  | "disability_types"
  | "age_groups"
  | "existing_solutions"
  | "tags"
  | "related_research"
  | "image_urls"
  | "video_urls"
  | "document_urls"
>;

export function draftFromProblem(p: DraftSource): ProblemDraft {
  return {
    title: p.title,
    description: p.description,
    category: p.category ?? "",
    country: p.country ?? "",
    severity: p.severity ?? "unspecified",
    status: p.status,
    disabilityTypes: [...(p.disability_types ?? [])],
    ageGroups: [...(p.age_groups ?? [])],
    existingSolutions: p.existing_solutions ?? "",
    tags: (p.tags ?? []).join(", "),
    relatedResearch: (p.related_research ?? []).join("\n"),
    imageUrls: [...(p.image_urls ?? [])],
    videoUrls: [...(p.video_urls ?? [])],
    documentUrls: [...(p.document_urls ?? [])],
  };
}

/** One link per line; blank lines and exact repeats are dropped. */
export function parseResearchLinks(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  );
}

export type DraftField =
  | "title"
  | "description"
  | "category"
  | "country"
  | "existingSolutions"
  | "tags"
  | "relatedResearch";

export type DraftErrors = Partial<Record<DraftField, string>>;

/**
 * Length as Postgres' char_length counts it: in code points, not the UTF-16
 * units String#length counts. An emoji is one character to the database but
 * two to .length, so a title of four emoji would pass an 8-character minimum
 * here and then be rejected by the CHECK.
 */
function charLength(s: string): number {
  return Array.from(s).length;
}

/**
 * Messages are complete sentences that name the field, because they are also
 * listed in the error summary, away from the field they belong to.
 */
export function validateDraft(d: ProblemDraft): DraftErrors {
  const errors: DraftErrors = {};
  const title = d.title.trim();
  const description = d.description.trim();

  if (charLength(title) < TITLE_MIN) {
    errors.title = `Enter a title of at least ${TITLE_MIN} characters.`;
  } else if (charLength(title) > TITLE_MAX) {
    errors.title = `Keep the title to ${TITLE_MAX} characters or fewer.`;
  }

  if (charLength(description) < DESCRIPTION_MIN) {
    errors.description = `Describe the problem in at least ${DESCRIPTION_MIN} characters.`;
  } else if (charLength(description) > DESCRIPTION_MAX) {
    errors.description = `Keep the description to ${DESCRIPTION_MAX} characters or fewer.`;
  }

  if (charLength(d.category.trim()) > SHORT_TEXT_MAX) {
    errors.category = `Keep the category to ${SHORT_TEXT_MAX} characters or fewer.`;
  }
  if (charLength(d.country.trim()) > SHORT_TEXT_MAX) {
    errors.country = `Keep the country to ${SHORT_TEXT_MAX} characters or fewer.`;
  }
  if (charLength(d.existingSolutions.trim()) > EXISTING_SOLUTIONS_MAX) {
    errors.existingSolutions = `Keep existing solutions to ${EXISTING_SOLUTIONS_MAX} characters or fewer.`;
  }

  if (uniqueTags(d.tags).length > MAX_TAGS) {
    errors.tags = `Use at most ${MAX_TAGS} tags.`;
  }

  const links = parseResearchLinks(d.relatedResearch);
  const invalid = links.filter((link) => !isSafeHttpUrl(link));
  if (invalid.length > 0) {
    errors.relatedResearch =
      invalid.length === 1
        ? `Related research: "${invalid[0]}" is not a web address starting with http:// or https://.`
        : `Related research: ${invalid.length} lines are not web addresses starting with http:// or https://, for example "${invalid[0]}".`;
  } else if (links.length > MAX_RESEARCH_LINKS) {
    errors.relatedResearch = `Add at most ${MAX_RESEARCH_LINKS} related research links.`;
  }

  return errors;
}

type ProblemInsert = Database["public"]["Tables"]["problems"]["Insert"];

/**
 * The columns the API may write on both insert and update. Counters,
 * timestamps and user_id are deliberately absent: the database owns them, and
 * user_id is added only on insert. Status is added only on edit.
 */
export type ProblemWritePayload = Required<
  Pick<
    ProblemInsert,
    | "title"
    | "description"
    | "category"
    | "country"
    | "severity"
    | "disability_types"
    | "age_groups"
    | "existing_solutions"
    | "related_research"
    | "tags"
    | "image_urls"
    | "video_urls"
    | "document_urls"
  >
>;

export function draftToPayload(d: ProblemDraft): ProblemWritePayload {
  return {
    title: d.title.trim(),
    description: d.description.trim(),
    category: d.category.trim(),
    country: d.country.trim(),
    severity: d.severity === "unspecified" ? null : d.severity,
    disability_types: [...d.disabilityTypes],
    age_groups: [...d.ageGroups],
    existing_solutions: d.existingSolutions.trim(),
    related_research: parseResearchLinks(d.relatedResearch),
    tags: parseTags(d.tags),
    image_urls: [...d.imageUrls],
    video_urls: [...d.videoUrls],
    document_urls: [...d.documentUrls],
  };
}

export function isDraftEmpty(d: ProblemDraft): boolean {
  return (
    !d.title.trim() &&
    !d.description.trim() &&
    !d.category.trim() &&
    !d.country.trim() &&
    d.severity === "unspecified" &&
    d.disabilityTypes.length === 0 &&
    d.ageGroups.length === 0 &&
    !d.existingSolutions.trim() &&
    !d.tags.trim() &&
    !d.relatedResearch.trim()
  );
}

function stringField(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function enumList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return allowed.filter((v) => value.includes(v));
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/**
 * Reads a draft saved in sessionStorage. The stored text is treated as
 * untrusted: anything that is not the expected shape falls back to the empty
 * value, and enum values the database would reject are dropped.
 */
export function parseStoredDraft(raw: string | null): ProblemDraft | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;

  const draft: ProblemDraft = {
    title: stringField(v.title, TITLE_MAX),
    description: stringField(v.description, DESCRIPTION_MAX),
    category: stringField(v.category, SHORT_TEXT_MAX),
    country: stringField(v.country, SHORT_TEXT_MAX),
    severity: SEVERITY_LEVELS.includes(v.severity as SeverityLevel)
      ? (v.severity as SeverityLevel)
      : "unspecified",
    status: PROBLEM_STATUSES.includes(v.status as ProblemStatus)
      ? (v.status as ProblemStatus)
      : "open",
    disabilityTypes: enumList(v.disabilityTypes, DISABILITY_TYPES),
    ageGroups: enumList(v.ageGroups, AGE_GROUPS),
    existingSolutions: stringField(v.existingSolutions, EXISTING_SOLUTIONS_MAX),
    tags: stringField(v.tags, 2000),
    relatedResearch: stringField(v.relatedResearch, 20000),
    imageUrls: stringList(v.imageUrls),
    videoUrls: stringList(v.videoUrls),
    documentUrls: stringList(v.documentUrls),
  };
  return isDraftEmpty(draft) ? null : draft;
}

// ERRORS ------------------------------------------------------------------

interface MaybeError {
  code?: string | null;
  message?: string | null;
}

export type LoadFailure = "missing" | "not_found" | "error";

/**
 * Sorts a failed read into what the visitor should be told: the feature is
 * not deployed yet, the link points nowhere, or something went wrong that a
 * retry may fix.
 */
export function classifyLoadError(error: MaybeError): LoadFailure {
  if (isMissingSchemaError(error)) return "missing";
  // invalid_text_representation: a malformed id in the URL.
  if (error.code === "22P02") return "not_found";
  return "error";
}

/**
 * A sentence for a failed write that a person can act on, in place of the raw
 * PostgREST text ("new row violates row-level security policy ...").
 */
export function friendlyWriteError(
  error: MaybeError | null | undefined,
  fallback: string,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (/fetch|network|load failed/i.test(message) && !code) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  if (code === "PGRST301" || /jwt expired/i.test(message)) {
    return "Your session has expired. Sign in again, then try once more.";
  }
  if (code === "42501" || /row-level security/i.test(message)) {
    return "You don't have permission to do that.";
  }
  if (code === "23514") {
    return "Some details are outside the allowed limits. Check them and try again.";
  }
  return fallback;
}

// LIST --------------------------------------------------------------------

/** Inclusive row range for the next page, as PostgREST's range() expects. */
export function nextPageRange(
  loaded: number,
  pageSize: number = PROBLEM_PAGE_SIZE,
): [number, number] {
  return [loaded, loaded + pageSize - 1];
}

/**
 * Appends a page, skipping rows already shown. Offset paging shifts when a
 * problem is reported between two loads, which would otherwise repeat a row.
 */
export function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((row) => row.id));
  return [...existing, ...incoming.filter((row) => !seen.has(row.id))];
}

/** What the results live region announces after each load. */
export function resultsSummary(shown: number, total: number | null): string {
  const plural = (n: number) => `${n} problem${n === 1 ? "" : "s"}`;
  if (total === null) return `${plural(shown)} shown`;
  if (total === 0) return "No problems found";
  if (shown >= total) return `${plural(total)} found`;
  return `Showing ${shown} of ${plural(total)}`;
}

/** Which problems the list shows. "saved" and "mine" need a signed-in user. */
export type ProblemScope = "all" | "saved" | "mine";

export const PROBLEM_SCOPE_LABELS: Record<ProblemScope, string> = {
  all: "All problems",
  saved: "Saved by me",
  mine: "Reported by me",
};

// PEOPLE ------------------------------------------------------------------

/** A profile's display name, or the neutral fallback when it is blank. */
export function displayNameOr(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed || FALLBACK_DISPLAY_NAME;
}

// DRAFT STORAGE -------------------------------------------------------------

/**
 * sessionStorage key for an unpublished report. Keyed by account so someone
 * signing in on a shared tab never sees another person's draft.
 */
export function draftStorageKey(userId: string): string {
  return `abilitiverse:problem-draft:${userId}`;
}

// REPORTS -----------------------------------------------------------------

/** Why a moderation report cannot be sent yet, or null when it can. */
export function validateReportReason(reason: string): string | null {
  const text = reason.trim();
  if (!text) return "Say what is wrong with this problem, so a moderator knows what to look for.";
  if (charLength(text) > REPORT_REASON_MAX) {
    return `Keep the reason to ${REPORT_REASON_MAX} characters or fewer.`;
  }
  return null;
}
