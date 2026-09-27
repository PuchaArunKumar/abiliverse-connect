import { isSafeHttpUrl } from "@/lib/safe-url";

/**
 * Form rules for the community pages (feed, jobs, learning hub, events,
 * contact).
 *
 * The numbers mirror the CHECK constraints in
 * supabase/migrations/20260724165909_*.sql and the send_contact_message()
 * function, so a value that passes here is one the database accepts. Without
 * them the first sign of a too-short title was a raw Postgres message such as
 * `violates check constraint "jobs_title_check"`.
 */
export const LIMITS = {
  postBody: { min: 1, max: 5000 },
  commentBody: { min: 1, max: 2000 },
  jobTitle: { min: 2, max: 200 },
  jobCompany: { min: 1, max: 200 },
  jobDescription: { min: 1, max: 10000 },
  coverNote: { min: 0, max: 4000 },
  courseTitle: { min: 2, max: 200 },
  courseDescription: { min: 1, max: 4000 },
  eventTitle: { min: 2, max: 200 },
  eventDescription: { min: 1, max: 5000 },
  // Location and provider have no CHECK in the database; this cap only stops
  // one runaway paste from filling a card.
  shortText: { min: 0, max: 200 },
  // Links must be empty or http(s), at most 2048 characters: the same rule as
  // the CHECKs added in 20260927080000_harden_live_tables.sql.
  url: { min: 0, max: 2048 },
  tagCount: 20,
  tagLength: 50,
  contactName: { min: 1, max: 200 },
  contactEmail: { min: 3, max: 320 },
  contactTopic: { min: 0, max: 100 },
  contactMessage: { min: 10, max: 5000 },
} as const;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

interface Range {
  min: number;
  max: number;
}

/**
 * Length in characters as Postgres' char_length() counts them (code points),
 * not UTF-16 units: "😀" is one character there but `"😀".length` is 2, so a
 * title of one emoji would pass a `.length >= 2` check and then fail the
 * database's `char_length(title) BETWEEN 2 AND 200`.
 */
export function charLength(value: string): number {
  return Array.from(value).length;
}

const formatNumber = (n: number) => n.toLocaleString("en");

/**
 * An error message for a trimmed value, or undefined when it fits. Trimming
 * first is what stops a title of two spaces from publishing a blank heading.
 */
export function lengthError(
  label: string,
  value: string,
  range: Range,
): string | undefined {
  const length = charLength(value);
  if (range.min > 0 && length === 0) return `${label} is required.`;
  if (length < range.min) {
    return `${label} needs at least ${formatNumber(range.min)} characters.`;
  }
  if (length > range.max) {
    return `${label} can be at most ${formatNumber(range.max)} characters (it is ${formatNumber(length)}).`;
  }
  return undefined;
}

/** Empty is allowed; anything else must be an absolute http(s) address. */
export function optionalUrlError(label: string, value: string): string | undefined {
  if (!value) return undefined;
  if (charLength(value) > LIMITS.url.max) {
    return `${label} can be at most ${formatNumber(LIMITS.url.max)} characters.`;
  }
  if (!isSafeHttpUrl(value)) {
    return `${label} must be a full web address starting with https:// (or http://).`;
  }
  return undefined;
}

/**
 * Splits a comma-separated tag field. Duplicates are dropped ignoring case,
 * keeping the first spelling the person typed.
 */
export function parseTagList(raw: string): { tags: string[]; error?: string } {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  if (tags.length > LIMITS.tagCount) {
    return { tags, error: `Use at most ${LIMITS.tagCount} tags.` };
  }
  const long = tags.find((t) => charLength(t) > LIMITS.tagLength);
  if (long) {
    return {
      tags,
      error: `Each tag can be at most ${LIMITS.tagLength} characters.`,
    };
  }
  return { tags };
}

/** True when the object holds no error messages. */
export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}

/** The first field, in form order, that has an error: where focus should go. */
export function firstErrorField<K extends string>(
  order: readonly K[],
  errors: FieldErrors<K>,
): K | undefined {
  return order.find((field) => errors[field]);
}

// ---------------------------------------------------------------- posts ---

export function postBodyError(body: string): string | undefined {
  return lengthError("Your post", body.trim(), LIMITS.postBody);
}

export function commentBodyError(body: string): string | undefined {
  return lengthError("Your comment", body.trim(), LIMITS.commentBody);
}

// ----------------------------------------------------------------- jobs ---

export interface JobForm {
  title: string;
  company: string;
  location: string;
  description: string;
  apply_url: string;
  tags: string;
  remote: boolean;
}

export const JOB_FIELDS = [
  "title",
  "company",
  "location",
  "description",
  "apply_url",
  "tags",
] as const;
export type JobField = (typeof JOB_FIELDS)[number];

export interface JobValues {
  title: string;
  company: string;
  location: string;
  description: string;
  apply_url: string;
  accessibility_tags: string[];
  remote: boolean;
}

export function validateJob(form: JobForm): {
  values: JobValues;
  errors: FieldErrors<JobField>;
} {
  const values: JobValues = {
    title: form.title.trim(),
    company: form.company.trim(),
    location: form.location.trim(),
    description: form.description.trim(),
    apply_url: form.apply_url.trim(),
    accessibility_tags: [],
    remote: form.remote,
  };
  const tags = parseTagList(form.tags);
  values.accessibility_tags = tags.tags;

  const errors: FieldErrors<JobField> = {
    title: lengthError("Job title", values.title, LIMITS.jobTitle),
    company: lengthError("Company", values.company, LIMITS.jobCompany),
    location: lengthError("Location", values.location, LIMITS.shortText),
    description: lengthError(
      "Description",
      values.description,
      LIMITS.jobDescription,
    ),
    apply_url: optionalUrlError("The application link", values.apply_url),
    tags: tags.error,
  };
  return { values, errors: compact(errors) };
}

export function coverNoteError(note: string): string | undefined {
  return lengthError("Your note", note.trim(), LIMITS.coverNote);
}

// -------------------------------------------------------------- courses ---

export const COURSE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function isCourseLevel(value: string): value is CourseLevel {
  return (COURSE_LEVELS as readonly string[]).includes(value);
}

export interface CourseForm {
  title: string;
  description: string;
  provider: string;
  url: string;
  level: CourseLevel;
  tags: string;
}

export const COURSE_FIELDS = [
  "title",
  "description",
  "provider",
  "url",
  "level",
  "tags",
] as const;
export type CourseField = (typeof COURSE_FIELDS)[number];

export interface CourseValues {
  title: string;
  description: string;
  provider: string;
  url: string;
  level: CourseLevel;
  tags: string[];
}

export function validateCourse(form: CourseForm): {
  values: CourseValues;
  errors: FieldErrors<CourseField>;
} {
  const tags = parseTagList(form.tags);
  const values: CourseValues = {
    title: form.title.trim(),
    description: form.description.trim(),
    provider: form.provider.trim(),
    url: form.url.trim(),
    level: form.level,
    tags: tags.tags,
  };
  const errors: FieldErrors<CourseField> = {
    title: lengthError("Title", values.title, LIMITS.courseTitle),
    description: lengthError(
      "Description",
      values.description,
      LIMITS.courseDescription,
    ),
    provider: lengthError("Provider", values.provider, LIMITS.shortText),
    url: optionalUrlError("The link", values.url),
    level: isCourseLevel(values.level) ? undefined : "Choose a level.",
    tags: tags.error,
  };
  return { values, errors: compact(errors) };
}

// --------------------------------------------------------------- events ---

export const EVENT_KINDS = ["event", "opportunity", "guidance"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  event: "Event",
  opportunity: "Opportunity",
  guidance: "Guidance",
};

export function isEventKind(value: string): value is EventKind {
  return (EVENT_KINDS as readonly string[]).includes(value);
}

export interface EventForm {
  kind: EventKind;
  title: string;
  description: string;
  /** The raw value of an <input type="datetime-local">, in local time. */
  starts_at: string;
  location: string;
  link: string;
}

export const EVENT_FIELDS = [
  "kind",
  "title",
  "description",
  "starts_at",
  "location",
  "link",
] as const;
export type EventField = (typeof EVENT_FIELDS)[number];

export interface EventValues {
  kind: EventKind;
  title: string;
  description: string;
  starts_at: string | null;
  location: string;
  link: string;
}

export function validateEvent(form: EventForm): {
  values: EventValues;
  errors: FieldErrors<EventField>;
} {
  // Date and place belong to events only. Their inputs are hidden for the
  // other kinds, so anything typed there before switching kind is dropped
  // rather than published where the author can no longer see it.
  const isEvent = form.kind === "event";
  const rawDate = isEvent ? form.starts_at.trim() : "";
  const date = rawDate ? new Date(rawDate) : null;
  const dateValid = date !== null && !Number.isNaN(date.getTime());

  const values: EventValues = {
    kind: form.kind,
    title: form.title.trim(),
    description: form.description.trim(),
    starts_at: dateValid ? (date as Date).toISOString() : null,
    location: isEvent ? form.location.trim() : "",
    link: form.link.trim(),
  };
  const errors: FieldErrors<EventField> = {
    kind: isEventKind(form.kind) ? undefined : "Choose a type.",
    title: lengthError("Title", values.title, LIMITS.eventTitle),
    description: lengthError(
      "Description",
      values.description,
      LIMITS.eventDescription,
    ),
    starts_at:
      rawDate && !dateValid ? "Enter a valid date and time." : undefined,
    location: lengthError("Location", values.location, LIMITS.shortText),
    link: optionalUrlError("The link", values.link),
  };
  return { values, errors: compact(errors) };
}

// -------------------------------------------------------------- contact ---

export interface ContactForm {
  name: string;
  email: string;
  topic: string;
  message: string;
}

export const CONTACT_FIELDS = ["name", "email", "topic", "message"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

export function validateContact(form: ContactForm): {
  values: ContactForm;
  errors: FieldErrors<ContactField>;
} {
  const values: ContactForm = {
    name: form.name.trim(),
    email: form.email.trim(),
    topic: form.topic.trim(),
    message: form.message.trim(),
  };
  let email = lengthError("Email address", values.email, LIMITS.contactEmail);
  // The database only insists on an "@" after the first character; asking
  // for something on both sides with no spaces catches most typos without
  // rejecting unusual but valid addresses.
  if (!email && !/^[^\s@]+@[^\s@]+$/.test(values.email)) {
    email = "Enter an email address like name@example.com.";
  }
  const errors: FieldErrors<ContactField> = {
    name: lengthError("Name", values.name, LIMITS.contactName),
    email,
    topic: lengthError("Topic", values.topic, LIMITS.contactTopic),
    message: lengthError("Message", values.message, LIMITS.contactMessage),
  };
  return { values, errors: compact(errors) };
}

function compact<K extends string>(errors: FieldErrors<K>): FieldErrors<K> {
  const out: FieldErrors<K> = {};
  for (const key of Object.keys(errors) as K[]) {
    if (errors[key]) out[key] = errors[key];
  }
  return out;
}
