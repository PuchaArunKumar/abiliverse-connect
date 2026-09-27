import type { Database } from "@/integrations/supabase/types";
import { parseTags, type DisabilityType } from "@/lib/problems";
import { isSafeHttpUrl } from "@/lib/safe-url";
import { isMissingSchemaError } from "@/lib/supabase-errors";

export { isSafeHttpUrl } from "@/lib/safe-url";

export type PitchStage = Database["public"]["Enums"]["pitch_stage"];
export type PitchNeed = Database["public"]["Enums"]["pitch_need"];

export type Pitch = Omit<
  Database["public"]["Tables"]["pitches"]["Row"],
  "search_vector"
>;

export type PitchFeedback = Database["public"]["Tables"]["pitch_feedback"]["Row"];
export type PitchInterest = Database["public"]["Tables"]["pitch_interests"]["Row"];

export const PITCH_STAGE_LABELS: Record<PitchStage, string> = {
  idea: "Idea",
  prototype: "Prototype",
  pilot: "Pilot with users",
  launched: "Launched",
};

/** One line on what each stage means, shown beside the stage picker. */
export const PITCH_STAGE_HINTS: Record<PitchStage, string> = {
  idea: "A concept, not yet built.",
  prototype: "Something works, but real users have not tried it yet.",
  pilot: "Being tried by disabled users in real conditions.",
  launched: "Available for people to use today.",
};

export const PITCH_NEED_LABELS: Record<PitchNeed, string> = {
  funding: "Funding",
  mentorship: "Mentorship",
  cofounder: "A co-founder",
  testers: "User testers",
  partners: "Partners",
  feedback: "Feedback",
};

export const FEEDBACK_KINDS = [
  "question",
  "suggestion",
  "concern",
  "encouragement",
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  question: "Question",
  suggestion: "Suggestion",
  concern: "Concern",
  encouragement: "Encouragement",
};

export const PITCH_STAGES = Object.keys(PITCH_STAGE_LABELS) as PitchStage[];
export const PITCH_NEEDS = Object.keys(PITCH_NEED_LABELS) as PitchNeed[];

/** Mirrors the CHECK constraints in 20260927090100_pitch_platform.sql. */
export const PITCH_LIMITS = {
  titleMin: 4,
  titleMax: 120,
  taglineMin: 10,
  taglineMax: 200,
  descriptionMin: 50,
  descriptionMax: 10000,
  urlMax: 500,
  fundingMax: 1_000_000_000,
  feedbackMax: 5000,
  interestMessageMin: 10,
  interestMessageMax: 2000,
  contactMin: 3,
  contactMax: 200,
  tagsMax: 20,
} as const;

/** "USD 25,000" — formatted for the reader's locale, never as a currency sign
 * alone, since "$" is ambiguous across a dozen currencies. */
export function formatFunding(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

/* ------------------------------------------------------------------------ */
/* Queries                                                                   */
/* ------------------------------------------------------------------------ */

// Explicit column lists: `select("*")` would also ship the tsvector search
// column to the browser on every row.
export const PITCH_LIST_COLUMNS =
  "id, user_id, title, tagline, stage, needs, disability_types, funding_goal, funding_currency, is_open, support_count, feedback_count, created_at";

export const PITCH_DETAIL_COLUMNS =
  "id, user_id, title, tagline, description, problem_id, stage, needs, disability_types, funding_goal, funding_currency, website_url, demo_url, tags, is_open, support_count, feedback_count, created_at, updated_at";

export type ListedPitch = Pick<
  Pitch,
  | "id"
  | "user_id"
  | "title"
  | "tagline"
  | "stage"
  | "needs"
  | "disability_types"
  | "funding_goal"
  | "funding_currency"
  | "is_open"
  | "support_count"
  | "feedback_count"
  | "created_at"
>;

export const PITCHES_PAGE_SIZE = 12;

export type PitchSort = "newest" | "supported" | "feedback";

export const PITCH_SORT_LABELS: Record<PitchSort, string> = {
  newest: "Newest",
  supported: "Most supported",
  feedback: "Most feedback",
};

export const PITCH_SORTS = Object.keys(PITCH_SORT_LABELS) as PitchSort[];

export const PITCH_SORT_COLUMNS: Record<
  PitchSort,
  "created_at" | "support_count" | "feedback_count"
> = {
  newest: "created_at",
  supported: "support_count",
  feedback: "feedback_count",
};

/* ------------------------------------------------------------------------ */
/* Small helpers                                                             */
/* ------------------------------------------------------------------------ */

export const FALLBACK_DISPLAY_NAME = "Community member";

/** profiles.display_name can be empty; never show a blank where a name goes. */
export function displayNameOr(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed || FALLBACK_DISPLAY_NAME;
}

/**
 * Length as Postgres' char_length counts it: in code points, not UTF-16 units.
 * "🦽🦽" is 2 characters to the database but 4 to String.length, so checking
 * minimums with .length would let through text the database then rejects.
 */
export function charCount(value: string): number {
  return Array.from(value).length;
}

export function isPitchNeed(value: string): value is PitchNeed {
  return (PITCH_NEEDS as string[]).includes(value);
}

export function isPitchStage(value: string): value is PitchStage {
  return (PITCH_STAGES as string[]).includes(value);
}

export function isFeedbackKind(value: string): value is FeedbackKind {
  return (FEEDBACK_KINDS as readonly string[]).includes(value);
}

/** Label for a stored feedback kind, tolerating a value added after this build. */
export function feedbackKindLabel(kind: string): string {
  return isFeedbackKind(kind) ? FEEDBACK_KIND_LABELS[kind] : "Feedback";
}

/** The id of a list card's title link, so the list can move focus to it. */
export function pitchTitleId(pitchId: string): string {
  return `pitch-title-${pitchId}`;
}

export function pluralise(count: number, singular: string, plural: string): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

interface MaybeError {
  code?: string | null;
  message?: string | null;
}

/**
 * A sentence to show for a failed request, instead of the raw PostgREST
 * message ("new row violates row-level security policy for table ...").
 */
export function friendlyPitchError(
  error: MaybeError | null | undefined,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!error) return fallback;
  if (isMissingSchemaError(error)) {
    return "The Pitch Platform is not switched on yet. Please try again later.";
  }
  if (error.code === "PGRST301" || /jwt expired/i.test(error.message ?? "")) {
    return "Your session has expired. Sign in again, then try once more.";
  }
  switch (error.code) {
    case "23514":
      return "Some details did not pass the checks. Review them and try again.";
    case "42501":
      return "You do not have permission to do that. Try signing in again.";
    case "23503":
      return "Something this refers to no longer exists. Reload the page and try again.";
  }
  if (/failed to fetch|network/i.test(error.message ?? "")) {
    return "We could not reach the server. Check your connection and try again.";
  }
  return fallback;
}

/* ------------------------------------------------------------------------ */
/* Pitch form                                                                */
/* ------------------------------------------------------------------------ */

export interface LinkedProblem {
  id: string;
  title: string;
}

/** What the form holds. Strings stay raw until submit, so typing is never
 * fought by normalisation (a half-typed "25," is not rewritten under you). */
export interface PitchFormValues {
  title: string;
  tagline: string;
  description: string;
  stage: PitchStage;
  needs: PitchNeed[];
  disabilityTypes: DisabilityType[];
  fundingGoal: string;
  fundingCurrency: string;
  websiteUrl: string;
  demoUrl: string;
  tags: string;
  problem: LinkedProblem | null;
  isOpen: boolean;
}

export const EMPTY_PITCH_FORM: PitchFormValues = {
  title: "",
  tagline: "",
  description: "",
  stage: "idea",
  needs: [],
  disabilityTypes: [],
  fundingGoal: "",
  fundingCurrency: "USD",
  websiteUrl: "",
  demoUrl: "",
  tags: "",
  problem: null,
  isOpen: true,
};

export type PitchFormField =
  | "title"
  | "tagline"
  | "description"
  | "stage"
  | "fundingGoal"
  | "fundingCurrency"
  | "websiteUrl"
  | "demoUrl"
  | "tags";

export type PitchFormErrors = Partial<Record<PitchFormField, string>>;

/** Field order for the error summary, matching the order on screen. */
export const PITCH_FORM_FIELD_ORDER: PitchFormField[] = [
  "title",
  "tagline",
  "description",
  "stage",
  "fundingGoal",
  "fundingCurrency",
  "websiteUrl",
  "demoUrl",
  "tags",
];

export type FundingGoalResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

/**
 * Reads the optional funding goal. Accepts plain digits or digits grouped in
 * threes by commas or spaces ("25000", "25,000", "25 000"), and nothing else:
 * "2,5" is a decimal in much of the world, so guessing would be wrong for
 * someone.
 */
export function parseFundingGoal(raw: string): FundingGoalResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const grouped = /^\d{1,3}([, ]\d{3})+$/.test(trimmed);
  if (!grouped && !/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      error: "Enter the funding goal as a whole number, for example 25000.",
    };
  }
  const value = Number(trimmed.replace(/[, ]/g, ""));
  if (!Number.isSafeInteger(value) || value < 1 || value > PITCH_LIMITS.fundingMax) {
    return {
      ok: false,
      error: `The funding goal must be between 1 and ${PITCH_LIMITS.fundingMax.toLocaleString()}.`,
    };
  }
  return { ok: true, value };
}

export function normaliseCurrency(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

/** Distinct tags typed, before parseTags caps the list. */
export function countTags(raw: string): number {
  return new Set(
    raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  ).size;
}

/** `noun` is the field as it reads mid-sentence, e.g. "title". */
function lengthError(
  noun: string,
  value: string,
  min: number,
  max: number,
): string | undefined {
  const n = charCount(value.trim());
  if (n === 0) return `Enter a ${noun}.`;
  if (n < min) return `The ${noun} must be at least ${min} characters. It is ${n} now.`;
  if (n > max) {
    return `The ${noun} can be at most ${max.toLocaleString()} characters. It is ${n.toLocaleString()} now.`;
  }
  return undefined;
}

function urlError(label: string, raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  // The database also insists on the "://", which URL() alone does not:
  // new URL("http:example.com") parses, and the insert would then fail.
  if (!/^https?:\/\//i.test(value) || !isSafeHttpUrl(value)) {
    return `Enter the ${label} as a full web address starting with https:// or http://.`;
  }
  if (value.length > PITCH_LIMITS.urlMax) {
    return `The ${label} can be at most ${PITCH_LIMITS.urlMax} characters.`;
  }
  return undefined;
}

/**
 * Every problem with the form, keyed by field. Each message is a full sentence
 * that makes sense read aloud on its own, since that is how a screen reader
 * user meets it in the error summary.
 */
export function validatePitchForm(values: PitchFormValues): PitchFormErrors {
  const errors: PitchFormErrors = {};

  const title = lengthError("title", values.title, PITCH_LIMITS.titleMin, PITCH_LIMITS.titleMax);
  if (title) errors.title = title;

  const tagline = lengthError(
    "tagline",
    values.tagline,
    PITCH_LIMITS.taglineMin,
    PITCH_LIMITS.taglineMax,
  );
  if (tagline) errors.tagline = tagline;

  const description = lengthError(
    "description",
    values.description,
    PITCH_LIMITS.descriptionMin,
    PITCH_LIMITS.descriptionMax,
  );
  if (description) errors.description = description;

  if (!isPitchStage(values.stage)) errors.stage = "Choose the stage your pitch is at.";

  // Funding details only matter, and are only shown, when funding is a need.
  if (values.needs.includes("funding")) {
    const goal = parseFundingGoal(values.fundingGoal);
    if (goal.ok === false) errors.fundingGoal = goal.error;
    if (!isCurrencyCode(normaliseCurrency(values.fundingCurrency))) {
      errors.fundingCurrency = "Enter a three-letter currency code, such as USD, EUR or INR.";
    }
  }

  const website = urlError("website", values.websiteUrl);
  if (website) errors.websiteUrl = website;
  const demo = urlError("demo link", values.demoUrl);
  if (demo) errors.demoUrl = demo;

  const tagCount = countTags(values.tags);
  if (tagCount > PITCH_LIMITS.tagsMax) {
    errors.tags = `Use at most ${PITCH_LIMITS.tagsMax} tags. You have ${tagCount}.`;
  }

  return errors;
}

/** The columns the API may write on both insert and update (see the grants). */
export type PitchWritable = Pick<
  Database["public"]["Tables"]["pitches"]["Insert"],
  | "title"
  | "tagline"
  | "description"
  | "problem_id"
  | "stage"
  | "needs"
  | "disability_types"
  | "funding_goal"
  | "funding_currency"
  | "website_url"
  | "demo_url"
  | "tags"
  | "is_open"
>;

/** Turns validated form values into the row to write. */
export function toPitchPayload(values: PitchFormValues): PitchWritable {
  const wantsFunding = values.needs.includes("funding");
  const goal = parseFundingGoal(values.fundingGoal);
  const currency = normaliseCurrency(values.fundingCurrency);
  return {
    title: values.title.trim(),
    tagline: values.tagline.trim(),
    description: values.description.trim(),
    problem_id: values.problem?.id ?? null,
    stage: values.stage,
    // Keep the enum order rather than click order, so the same choices always
    // read the same way on the pitch.
    needs: PITCH_NEEDS.filter((n) => values.needs.includes(n)),
    disability_types: values.disabilityTypes,
    funding_goal: wantsFunding && goal.ok ? goal.value : null,
    // The column is NOT NULL, so a hidden, half-typed code falls back to USD
    // rather than failing a save the person cannot see the reason for.
    funding_currency: isCurrencyCode(currency) ? currency : "USD",
    website_url: values.websiteUrl.trim(),
    demo_url: values.demoUrl.trim(),
    tags: parseTags(values.tags),
    is_open: values.isOpen,
  };
}

export type PitchDetailRow = Pick<
  Pitch,
  | "id"
  | "user_id"
  | "title"
  | "tagline"
  | "description"
  | "problem_id"
  | "stage"
  | "needs"
  | "disability_types"
  | "funding_goal"
  | "funding_currency"
  | "website_url"
  | "demo_url"
  | "tags"
  | "is_open"
  | "support_count"
  | "feedback_count"
  | "created_at"
  | "updated_at"
>;

/** Pre-fills the edit form from a stored pitch. */
export function pitchToFormValues(
  pitch: PitchDetailRow,
  problem: LinkedProblem | null,
): PitchFormValues {
  return {
    title: pitch.title,
    tagline: pitch.tagline,
    description: pitch.description,
    stage: pitch.stage,
    needs: pitch.needs,
    disabilityTypes: pitch.disability_types,
    fundingGoal: pitch.funding_goal === null ? "" : String(pitch.funding_goal),
    fundingCurrency: pitch.funding_currency || "USD",
    websiteUrl: pitch.website_url,
    demoUrl: pitch.demo_url,
    tags: pitch.tags.join(", "),
    problem,
    isOpen: pitch.is_open,
  };
}

/* ------------------------------------------------------------------------ */
/* Feedback and interest                                                     */
/* ------------------------------------------------------------------------ */

export function validateFeedback(body: string): string | null {
  const n = charCount(body.trim());
  if (n === 0) return "Write your feedback before posting.";
  if (n > PITCH_LIMITS.feedbackMax) {
    return `Feedback can be at most ${PITCH_LIMITS.feedbackMax.toLocaleString()} characters. It is ${n.toLocaleString()} now.`;
  }
  return null;
}

export interface InterestValues {
  offering: string;
  message: string;
  contact: string;
}

export type InterestErrors = Partial<Record<keyof InterestValues, string>>;

export function validateInterest(values: InterestValues): InterestErrors {
  const errors: InterestErrors = {};
  if (!isPitchNeed(values.offering)) {
    errors.offering = "Choose what you are offering.";
  }
  const message = charCount(values.message.trim());
  if (message < PITCH_LIMITS.interestMessageMin) {
    errors.message = `Write a message of at least ${PITCH_LIMITS.interestMessageMin} characters so the founder knows who you are.`;
  } else if (message > PITCH_LIMITS.interestMessageMax) {
    errors.message = `The message can be at most ${PITCH_LIMITS.interestMessageMax.toLocaleString()} characters. It is ${message.toLocaleString()} now.`;
  }
  const contact = charCount(values.contact.trim());
  if (contact < PITCH_LIMITS.contactMin) {
    errors.contact = "Tell the founder how to reach you, such as an email address.";
  } else if (contact > PITCH_LIMITS.contactMax) {
    errors.contact = `Contact details can be at most ${PITCH_LIMITS.contactMax} characters.`;
  }
  return errors;
}

/* ------------------------------------------------------------------------ */
/* Pages                                                                     */
/* ------------------------------------------------------------------------ */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when a route parameter can be a pitch id. A mistyped link would only
 * earn "invalid input syntax for type uuid" from the database, so the page can
 * say "not found" without asking.
 */
export function isPitchId(value: string | null | undefined): value is string {
  return UUID_PATTERN.test(value ?? "");
}

/** Founders and moderators may edit or delete a pitch (see the RLS policies). */
export function canManagePitch(
  userId: string | null | undefined,
  pitch: Pick<Pitch, "user_id"> | null | undefined,
  isModerator: boolean,
): boolean {
  if (!userId || !pitch) return false;
  return pitch.user_id === userId || isModerator;
}

/** What the results live region announces after each load of the list. */
export function pitchResultsSummary(shown: number, total: number | null): string {
  if (total === null) return `${pluralise(shown, "pitch", "pitches")} shown`;
  if (total === 0) return "No pitches found";
  if (shown >= total) return `${pluralise(total, "pitch", "pitches")} found`;
  return `Showing ${shown.toLocaleString()} of ${pluralise(total, "pitch", "pitches")}`;
}

/** Whether "Load more" has anything left to fetch. */
export function hasMorePitches(shown: number, total: number | null): boolean {
  return total !== null && shown < total;
}

/**
 * Interest requests have their own failure modes: the unique constraint on
 * (pitch_id, user_id), and the insert policy that refuses a closed pitch or
 * the founder's own.
 */
export function friendlyInterestError(error: MaybeError | null | undefined): string {
  switch (error?.code) {
    case "23505":
      return "You have already sent interest in this pitch.";
    case "42501":
      return "This pitch is not taking new interest right now.";
  }
  return friendlyPitchError(error, "Your interest could not be sent. Please try again.");
}
