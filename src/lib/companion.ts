import type { Database } from "@/integrations/supabase/types";

/**
 * Companion: daily routines broken into small steps.
 *
 * Everything in this module is pure — no network, no DOM, no clock reads — so
 * the date arithmetic that decides "is this due today" and "how many times in
 * a row" can be tested exhaustively, including across daylight-saving changes.
 * Callers pass `today` / `now` in.
 *
 * All dates are the person's LOCAL dates. A routine set for 08:00 means 08:00
 * wherever the person is, and "done today" means their today, not the server's
 * UTC one (see 20260927090200_companion_routines.sql).
 */

export type Routine = Database["public"]["Tables"]["companion_routines"]["Row"];

/** Explicit column list, in the house style of never shipping `*`. */
export const ROUTINE_COLUMNS =
  "id, user_id, title, notes, steps, remind_at, days, active, created_at, updated_at";

/** The fields the schedule maths reads. */
export type ScheduledRoutine = Pick<Routine, "days" | "active" | "remind_at" | "title">;

/** Mirrors the CHECK constraints in 20260927090200_companion_routines.sql. */
export const ROUTINE_LIMITS = {
  titleMax: 120,
  notesMax: 1000,
  stepsMax: 20,
  stepsTotalMax: 6000,
} as const;

/** How far back the page loads completions, which also bounds a streak. */
export const COMPLETION_WINDOW_DAYS = 90;

// 0 = Sunday … 6 = Saturday, the same numbering as Date#getDay() and the
// `days` column.
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const ICS_DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export const EVERY_DAY: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5];

/** Days shown Monday first: most of the world, and ISO 8601, start the week there. */
export const DISPLAY_DAY_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

// ---------------------------------------------------------------------------
// Local dates

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/**
 * "YYYY-MM-DD" for the date as the person's own clock shows it.
 *
 * Never `toISOString().slice(0, 10)`: that is the UTC date, which for anyone
 * east of UTC is still yesterday in the early morning, and for anyone west of
 * it is already tomorrow in the evening.
 */
export function localDateString(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight for a "YYYY-MM-DD" string, or null when it is not a real date. */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // new Date() rolls 31 February over into March; reject instead.
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

/** The start of the local day containing `date`. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The local day `days` after (or before) `date`, at its start.
 *
 * Calendar arithmetic rather than adding 24-hour blocks: across a
 * daylight-saving change a local day is 23 or 25 hours long, and stepping by
 * 86 400 000 ms lands on the wrong date near midnight.
 */
export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * A running count of local calendar days, so two dates can be compared or
 * subtracted without DST skewing the difference.
 */
export function localDayNumber(date: Date): number {
  return Math.round(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

/** Milliseconds from `now` until the next local day begins. */
export function msUntilNextLocalDay(now: Date): number {
  return addLocalDays(now, 1).getTime() - now.getTime();
}

// ---------------------------------------------------------------------------
// Times of day

export interface ClockTime {
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Parses a Postgres `time` ("08:30:00") or an <input type="time"> value
 * ("08:30"). Null for empty or malformed input, which the UI treats as
 * "any time".
 */
export function parseClockTime(value: string | null | undefined): ClockTime | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return { hours, minutes, seconds };
}

function clockSeconds(value: string | null | undefined): number | null {
  const time = parseClockTime(value);
  return time ? time.hours * 3600 + time.minutes * 60 + time.seconds : null;
}

/** "HH:MM" for an <input type="time">, or "" for any time. */
export function timeInputValue(value: string | null | undefined): string {
  const time = parseClockTime(value);
  return time ? `${pad(time.hours)}:${pad(time.minutes)}` : "";
}

/** "8:30 AM" / "08:30" in the reader's locale, or "Any time". */
export function formatClockTime(value: string | null | undefined, locale?: string): string {
  const time = parseClockTime(value);
  if (!time) return "Any time";
  return new Date(2000, 0, 1, time.hours, time.minutes).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Schedules

/** Unique, sorted, in-range weekday numbers. */
export function normaliseDays(days: readonly number[]): number[] {
  return Array.from(
    new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)),
  ).sort((a, b) => a - b);
}

function runsOnWeekday(routine: Pick<Routine, "days">, date: Date): boolean {
  return routine.days.includes(date.getDay());
}

/** Whether an active routine is planned for the local day containing `date`. */
export function isScheduledOn(
  routine: Pick<Routine, "days" | "active">,
  date: Date,
): boolean {
  return routine.active && runsOnWeekday(routine, date);
}

/** Earlier times first; routines with no time ("any time") last, then by name. */
export function compareByTime(a: ScheduledRoutine, b: ScheduledRoutine): number {
  const ta = clockSeconds(a.remind_at);
  const tb = clockSeconds(b.remind_at);
  if (ta !== tb) {
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  }
  return a.title.localeCompare(b.title);
}

/** The active routines planned for `date`, in the order they come up. */
export function routinesForDay<T extends ScheduledRoutine>(
  routines: readonly T[],
  date: Date,
): T[] {
  return routines.filter((r) => isScheduledOn(r, date)).sort(compareByTime);
}

/** "Every day", "Weekdays", "Weekends", or the day names in week order. */
export function describeDays(days: readonly number[]): string {
  const set = normaliseDays(days);
  if (set.length === 7) return "Every day";
  if (set.join() === "1,2,3,4,5") return "Weekdays";
  if (set.join() === "0,6") return "Weekends";
  const names = DISPLAY_DAY_ORDER.filter((d) => set.includes(d)).map((d) => DAY_NAMES[d]);
  if (names.length <= 1) return names[0] ?? "No days";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Completions

/** Key for one routine on one local date, for a single Set of everything done. */
export function completionKey(routineId: string, date: string): string {
  return `${routineId}|${date}`;
}

/** Groups completion rows into routine id → set of "YYYY-MM-DD". */
export function groupCompletions(
  rows: readonly { routine_id: string; completed_on: string }[],
): Map<string, Set<string>> {
  const byRoutine = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = byRoutine.get(row.routine_id) ?? new Set<string>();
    set.add(row.completed_on);
    byRoutine.set(row.routine_id, set);
  }
  return byRoutine;
}

export interface StreakDetails {
  /** Planned days completed in a row. */
  count: number;
  /**
   * True when the count ran into `earliest` — the start of the loaded
   * history — so the real run may be longer than `count`.
   */
  atLeast: boolean;
}

/**
 * How many planned days in a row the routine has been done, counting back from
 * `today`.
 *
 * - Today counts once it is done. If it is still to do, it is not a break yet:
 *   counting starts from the previous planned day instead.
 * - Days the routine is not planned for are skipped. They neither add to the
 *   run nor end it, so a Monday–Wednesday–Friday routine done every time has a
 *   run of three by Friday, not a broken one.
 * - Doing it on an unplanned day is welcome but does not add to the count.
 *
 * `earliest` is the oldest date the caller has history for; the walk stops
 * there and reports `atLeast` rather than guessing about older days.
 */
export function streakDetails(
  routine: Pick<Routine, "days">,
  completedDates: ReadonlySet<string>,
  today: Date,
  earliest?: Date | null,
): StreakDetails {
  const planned = normaliseDays(routine.days);
  if (planned.length === 0) return { count: 0, atLeast: false };
  const plannedRoutine = { days: planned };
  const floor = earliest ? localDayNumber(earliest) : null;

  let cursor = startOfLocalDay(today);
  if (!completedDates.has(localDateString(cursor))) cursor = addLocalDays(cursor, -1);

  let count = 0;
  // Every week holds a planned day, and the walk stops at the first planned
  // day not in the set, so it cannot outrun the set by more than a week per
  // entry. The cap is belt and braces.
  const maxSteps = (completedDates.size + 2) * 7;
  for (let step = 0; step < maxSteps; step++) {
    if (floor !== null && localDayNumber(cursor) < floor) {
      return { count, atLeast: count > 0 };
    }
    if (runsOnWeekday(plannedRoutine, cursor)) {
      if (!completedDates.has(localDateString(cursor))) break;
      count++;
    }
    cursor = addLocalDays(cursor, -1);
  }
  return { count, atLeast: false };
}

/** Planned days completed in a row; see streakDetails for the rules. */
export function currentStreak(
  routine: Pick<Routine, "days">,
  completedDates: ReadonlySet<string>,
  today: Date,
  earliest?: Date | null,
): number {
  return streakDetails(routine, completedDates, today, earliest).count;
}

export type WeekDayStatus =
  /** Done on this day, planned or not. */
  | "done"
  /** Planned, the day has passed, and it was not done. */
  | "not-done"
  /** Planned for today and not done yet. */
  | "to-do"
  /** Planned for a day still to come this week. */
  | "upcoming"
  /** Not planned for this day. */
  | "not-planned";

export interface WeekDaySummary {
  date: string;
  weekday: number;
  isToday: boolean;
  status: WeekDayStatus;
}

export interface WeekSummary {
  /** Seven days, the first day of the week first. */
  days: WeekDaySummary[];
  /** Days this week the routine is planned for. */
  planned: number;
  /** Planned days this week already done. */
  done: number;
  /** Times it was done this week on a day it was not planned for. */
  extra: number;
}

/**
 * The calendar week containing `today`, day by day.
 *
 * `since` (the day the routine was created) keeps days before the routine
 * existed from reading as "not done": they show as not planned instead.
 */
export function weekSummary(
  routine: Pick<Routine, "days">,
  completedDates: ReadonlySet<string>,
  today: Date,
  options: { weekStartsOn?: number; since?: Date | null } = {},
): WeekSummary {
  const weekStartsOn = options.weekStartsOn ?? 1;
  const todayNumber = localDayNumber(today);
  const sinceNumber = options.since ? localDayNumber(options.since) : null;
  const start = addLocalDays(today, -((today.getDay() - weekStartsOn + 7) % 7));

  const days: WeekDaySummary[] = [];
  let planned = 0;
  let done = 0;
  let extra = 0;
  for (let i = 0; i < 7; i++) {
    const day = addLocalDays(start, i);
    const date = localDateString(day);
    const dayNumber = localDayNumber(day);
    const isPlanned =
      runsOnWeekday(routine, day) && (sinceNumber === null || dayNumber >= sinceNumber);
    const isDone = completedDates.has(date);

    let status: WeekDayStatus;
    if (isDone) status = "done";
    else if (!isPlanned) status = "not-planned";
    else if (dayNumber < todayNumber) status = "not-done";
    else if (dayNumber === todayNumber) status = "to-do";
    else status = "upcoming";

    if (isPlanned) planned++;
    if (isPlanned && isDone) done++;
    if (!isPlanned && isDone) extra++;
    days.push({ date, weekday: day.getDay(), isToday: dayNumber === todayNumber, status });
  }
  return { days, planned, done, extra };
}

// ---------------------------------------------------------------------------
// Reminders

export interface UpcomingReminder<T> {
  /** The first routine due (by name when several share the time). */
  routine: T;
  /** Every routine due at exactly `at`, so none is silently skipped. */
  routines: T[];
  at: Date;
}

export type ReminderRoutine = ScheduledRoutine & Pick<Routine, "id">;

/**
 * The next moment strictly after `now` that an active, timed routine is due.
 *
 * Occurrences already marked done (keys from completionKey in `done`) are
 * skipped: being reminded to take tablets you have already taken is worse than
 * no reminder at all.
 */
export function nextReminder<T extends ReminderRoutine>(
  routines: readonly T[],
  now: Date,
  options: { done?: ReadonlySet<string> } = {},
): UpcomingReminder<T> | null {
  let best: UpcomingReminder<T> | null = null;
  for (const routine of [...routines].sort(compareByTime)) {
    if (!routine.active) continue;
    const time = parseClockTime(routine.remind_at);
    if (!time) continue;
    // Two weeks covers "only on today's weekday, and today is already past or
    // done", plus a completion logged a day ahead.
    for (let offset = 0; offset <= 14; offset++) {
      const day = addLocalDays(now, offset);
      if (!runsOnWeekday(routine, day)) continue;
      if (options.done?.has(completionKey(routine.id, localDateString(day)))) continue;
      const at = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        time.hours,
        time.minutes,
        time.seconds,
      );
      if (at.getTime() <= now.getTime()) continue;
      if (!best || at.getTime() < best.at.getTime()) {
        best = { routine, routines: [routine], at };
      } else if (at.getTime() === best.at.getTime()) {
        best.routines.push(routine);
      }
      break;
    }
  }
  return best;
}

/** "today at 8:00 AM", "tomorrow at 8:00 AM" or "on Monday at 8:00 AM". */
export function describeWhen(at: Date, now: Date, locale?: string): string {
  const time = at.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const diff = localDayNumber(at) - localDayNumber(now);
  if (diff === 0) return `today at ${time}`;
  if (diff === 1) return `tomorrow at ${time}`;
  return `on ${DAY_NAMES[at.getDay()]} at ${time}`;
}

// ---------------------------------------------------------------------------
// Calendar file (RFC 5545)

export type IcsRoutine = Pick<
  Routine,
  "id" | "title" | "notes" | "steps" | "remind_at" | "days" | "active"
>;

/**
 * Escapes a TEXT value: backslash, semicolon, comma and line breaks, per
 * RFC 5545 §3.3.11. Control characters other than tab are not allowed in TEXT
 * at all, so they are dropped rather than escaped.
 */
export function escapeIcsText(value: string): string {
  const normalised = value.replace(/\r\n?/g, "\n");
  let clean = "";
  for (const ch of normalised) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 9 || code === 10 || (code >= 32 && code !== 127)) clean += ch;
  }
  return clean
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function utf8Length(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

/**
 * Folds a content line so no physical line exceeds 75 octets (RFC 5545
 * §3.1). Continuation lines start with one space, which counts toward their
 * 75. Splits fall between characters, never inside a multi-byte one.
 */
export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  let limit = 75;
  for (const ch of line) {
    const size = utf8Length(ch);
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      limit = 74;
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function icsUtcStamp(date: Date): string {
  return (
    `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** The first date on or after `from` that falls on one of `days`. */
function firstPlannedDate(days: readonly number[], from: Date): Date | null {
  for (let offset = 0; offset < 7; offset++) {
    const day = addLocalDays(from, offset);
    if (days.includes(day.getDay())) return day;
  }
  return null;
}

function calendarDescription(routine: IcsRoutine): string {
  const steps = routine.steps.map((s) => s.trim()).filter(Boolean);
  const parts: string[] = [];
  if (steps.length > 0) {
    parts.push(`Steps:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
  }
  if (routine.notes.trim()) parts.push(routine.notes.trim());
  return parts.join("\n\n");
}

/**
 * A calendar file with one weekly repeating event per active routine that has
 * a time, each with an alarm at the start.
 *
 * DTSTART is "floating" local time — no TZID, no Z — which RFC 5545 defines
 * as the same wall-clock time wherever the calendar is, exactly what a routine
 * at 08:00 means. It falls on the first planned day from today, so the start
 * is itself an occurrence of the RRULE, as the RFC expects.
 *
 * UIDs are derived from the routine id, so a calendar that already holds an
 * earlier export can recognise the same routine.
 */
export function buildIcs(routines: readonly IcsRoutine[], options: { now: Date }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Abilitiverse//Companion routines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Abilitiverse routines",
  ];
  const stamp = icsUtcStamp(options.now);

  for (const routine of routines) {
    if (!routine.active) continue;
    const time = parseClockTime(routine.remind_at);
    const days = normaliseDays(routine.days);
    if (!time || days.length === 0) continue;
    const start = firstPlannedDate(days, options.now);
    if (!start) continue;

    const dtstart =
      `${pad(start.getFullYear(), 4)}${pad(start.getMonth() + 1)}${pad(start.getDate())}` +
      `T${pad(time.hours)}${pad(time.minutes)}${pad(time.seconds)}`;
    const description = calendarDescription(routine);

    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(`companion-${routine.id}`)}@abilitiverse`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dtstart}`,
      // A zero-length event is legal but several calendar apps draw it as a
      // hairline that is easy to miss; a short block is visible.
      "DURATION:PT15M",
      `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => ICS_DAY_CODES[d]).join(",")}`,
      `SUMMARY:${escapeIcsText(routine.title.trim())}`,
    );
    if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(routine.title.trim())}`,
      "TRIGGER:-PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Routines that buildIcs would include. */
export function calendarRoutineCount(routines: readonly IcsRoutine[]): number {
  return routines.filter(
    (r) => r.active && parseClockTime(r.remind_at) && normaliseDays(r.days).length > 0,
  ).length;
}

// ---------------------------------------------------------------------------
// Motivation

/**
 * One line a day. Plain and warm, never cheerleading: the people this is for
 * are adults, and many have had a lifetime of being talked down to.
 */
export const MOTIVATION: readonly string[] = [
  "Small steps still count. One at a time is enough.",
  "You do not have to do everything today. Start with the next step.",
  "Going slowly is still going.",
  "Your routines are here to help you, not to judge you.",
  "If yesterday did not go to plan, today is a fresh start.",
  "Missing a day does not undo the days you did.",
  "Asking for help is a skill, not a weakness.",
  "Every step you finish is one less thing to hold in your head.",
  "Doing part of a routine is better than skipping all of it.",
  "Your pace is the right pace.",
  "Ticking things off helps you see how much you have done.",
  "If a routine is not working, changing it is a good idea.",
  "Not sure where to begin? Start with the easiest step.",
  "Done is better than perfect.",
  "Be as patient with yourself as you would be with a friend.",
  "Rest is part of looking after yourself too.",
  "You set these routines up for a reason. That reason still matters.",
  "A reminder is a tool you chose. Using it is a smart move.",
  "Some days are harder than others. That is normal.",
  "Take a breath. Then take the next step.",
];

/** The same message all day, a different one tomorrow. */
export function messageForDate(date: Date): string {
  const n = MOTIVATION.length;
  return MOTIVATION[((localDayNumber(date) % n) + n) % n];
}

// ---------------------------------------------------------------------------
// Editing

/** What the form edits: steps as one-per-line text, time as an input value. */
export interface RoutineDraft {
  title: string;
  notes: string;
  steps: string;
  time: string;
  days: number[];
  active: boolean;
}

/** What is written to companion_routines. */
export interface RoutineValues {
  title: string;
  notes: string;
  steps: string[];
  remind_at: string | null;
  days: number[];
  active: boolean;
}

export type RoutineField = "title" | "notes" | "steps" | "time" | "days";

/** Field order, so the first error can be focused. */
export const ROUTINE_FIELDS: readonly RoutineField[] = ["title", "steps", "notes", "time", "days"];

/** Postgres char_length counts characters; String#length counts UTF-16 units. */
export function charLength(value: string): number {
  return Array.from(value).length;
}

/** One step per line: trimmed, blank lines dropped. */
export function parseSteps(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function emptyDraft(): RoutineDraft {
  return { title: "", notes: "", steps: "", time: "", days: [...EVERY_DAY], active: true };
}

export function draftFromRoutine(
  routine: Pick<Routine, "title" | "notes" | "steps" | "remind_at" | "days" | "active">,
): RoutineDraft {
  return {
    title: routine.title,
    notes: routine.notes,
    steps: routine.steps.join("\n"),
    time: timeInputValue(routine.remind_at),
    days: normaliseDays(routine.days),
    active: routine.active,
  };
}

const formatCount = (n: number) => n.toLocaleString("en");

/**
 * Checks a draft against the same rules as the table's CHECK constraints, and
 * returns the values to save. Messages say what to do, not what went wrong.
 */
export function validateRoutine(draft: RoutineDraft): {
  values: RoutineValues;
  errors: Partial<Record<RoutineField, string>>;
} {
  const errors: Partial<Record<RoutineField, string>> = {};
  const title = draft.title.trim();
  const notes = draft.notes.trim();
  const steps = parseSteps(draft.steps);
  const days = normaliseDays(draft.days);
  const timeText = draft.time.trim();
  const time = parseClockTime(timeText);

  if (!title) {
    errors.title = "Give the routine a name.";
  } else if (charLength(title) > ROUTINE_LIMITS.titleMax) {
    errors.title = `Keep the name to ${ROUTINE_LIMITS.titleMax} characters or fewer. It has ${formatCount(charLength(title))} now.`;
  }

  if (charLength(notes) > ROUTINE_LIMITS.notesMax) {
    errors.notes = `Keep the notes to ${formatCount(ROUTINE_LIMITS.notesMax)} characters or fewer. They have ${formatCount(charLength(notes))} now.`;
  }

  if (steps.length > ROUTINE_LIMITS.stepsMax) {
    errors.steps = `A routine can have up to ${ROUTINE_LIMITS.stepsMax} steps. This one has ${steps.length}. Try splitting it into two routines.`;
  } else if (steps.reduce((sum, s) => sum + charLength(s), 0) > ROUTINE_LIMITS.stepsTotalMax) {
    errors.steps = `The steps are too long all together. Keep them under ${formatCount(ROUTINE_LIMITS.stepsTotalMax)} characters in total.`;
  }

  if (timeText && !time) {
    errors.time = "Enter a time such as 08:30, or leave it empty for any time.";
  }

  if (days.length === 0) {
    errors.days = "Choose at least one day.";
  }

  return {
    values: {
      title,
      notes,
      steps,
      remind_at: time ? `${pad(time.hours)}:${pad(time.minutes)}` : null,
      days,
      active: draft.active,
    },
    errors,
  };
}

// ---------------------------------------------------------------------------
// Examples

export interface ExampleRoutine extends RoutineValues {
  key: string;
}

/** Starting points someone can add in one click and then change. */
export const EXAMPLE_ROUTINES: readonly ExampleRoutine[] = [
  {
    key: "morning-medication",
    title: "Morning medication",
    notes:
      "Change these steps to match your own medicines and what your doctor or pharmacist told you.",
    steps: [
      "Get a glass of water.",
      "Find today's box in your pill organiser.",
      "Take the tablets in today's box.",
      "Close the organiser and put it back in its place.",
    ],
    remind_at: "08:00",
    days: [...EVERY_DAY],
    active: true,
  },
  {
    key: "leave-the-house",
    title: "Get ready to leave the house",
    notes: "",
    steps: [
      "Check the weather and choose a coat or umbrella.",
      "Put on your shoes.",
      "Put your keys, phone and wallet in your bag or pocket.",
      "Turn off the lights and the cooker.",
      "Lock the door behind you.",
    ],
    remind_at: "08:30",
    days: [...WEEKDAYS],
    active: true,
  },
  {
    key: "wind-down",
    title: "Wind down for bed",
    notes: "",
    steps: [
      "Put your phone on charge.",
      "Brush your teeth.",
      "Lay out your clothes for tomorrow.",
      "Set an alarm if you need one.",
      "Turn off the lights.",
    ],
    remind_at: "21:30",
    days: [...EVERY_DAY],
    active: true,
  },
];
