import { afterAll, describe, expect, it } from "vitest";

// Every date test below runs in a zone with daylight saving, so a 23- or
// 25-hour day actually happens. Node re-reads TZ when it is assigned, and the
// library never reads the clock at import time.
const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = "America/New_York";
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

import {
  EXAMPLE_ROUTINES,
  MOTIVATION,
  addLocalDays,
  buildIcs,
  calendarRoutineCount,
  charLength,
  compareByTime,
  completionKey,
  currentStreak,
  describeDays,
  describeWhen,
  draftFromRoutine,
  emptyDraft,
  escapeIcsText,
  foldIcsLine,
  formatClockTime,
  groupCompletions,
  isScheduledOn,
  localDateString,
  localDayNumber,
  messageForDate,
  msUntilNextLocalDay,
  nextReminder,
  normaliseDays,
  parseClockTime,
  parseLocalDate,
  parseSteps,
  routinesForDay,
  startOfLocalDay,
  streakDetails,
  timeInputValue,
  validateRoutine,
  weekSummary,
  type IcsRoutine,
  type RoutineDraft,
} from "@/lib/companion";

const HOUR = 3_600_000;
const EVERY = [0, 1, 2, 3, 4, 5, 6];
const MON_WED_FRI = [1, 3, 5];

/** Local date from "YYYY-MM-DD" (and optional hour, minute). */
const d = (value: string, hours = 12, minutes = 0) => {
  const [y, m, day] = value.split("-").map(Number);
  return new Date(y, m - 1, day, hours, minutes);
};

const routine = (overrides: Partial<IcsRoutine> = {}): IcsRoutine => ({
  id: "r1",
  title: "Morning medication",
  notes: "",
  steps: ["Get water", "Take tablets"],
  remind_at: "08:00:00",
  days: EVERY,
  active: true,
  ...overrides,
});

/** Undoes RFC 5545 folding: CRLF followed by one space is removed. */
const unfold = (ics: string) => ics.replace(/\r\n /g, "");
const octets = (s: string) => new TextEncoder().encode(s).length;

describe("test environment", () => {
  it("really is in a zone with daylight saving", () => {
    // 2026-03-08 is the US spring-forward day. If TZ did not take, every DST
    // test below would pass without testing anything.
    expect(d("2026-03-07").getTimezoneOffset()).toBe(300);
    expect(d("2026-03-09").getTimezoneOffset()).toBe(240);
  });
});

describe("local dates", () => {
  it("formats the local date with zero padding", () => {
    expect(localDateString(new Date(2026, 0, 5, 9))).toBe("2026-01-05");
    expect(localDateString(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("uses the local date, not the UTC one, late in the evening west of UTC", () => {
    const lateEvening = new Date(2026, 8, 27, 22, 30); // 02:30 UTC on the 28th
    expect(lateEvening.toISOString().slice(0, 10)).toBe("2026-09-28");
    expect(localDateString(lateEvening)).toBe("2026-09-27");
  });

  it("uses the local date early in the morning east of UTC", () => {
    process.env.TZ = "Asia/Kolkata";
    try {
      const earlyMorning = new Date(2026, 8, 27, 3, 0); // 21:30 UTC on the 26th
      expect(earlyMorning.toISOString().slice(0, 10)).toBe("2026-09-26");
      expect(localDateString(earlyMorning)).toBe("2026-09-27");
    } finally {
      process.env.TZ = "America/New_York";
    }
  });

  it("parses only real calendar dates", () => {
    expect(parseLocalDate("2026-02-28")?.getDate()).toBe(28);
    expect(parseLocalDate("2028-02-29")?.getMonth()).toBe(1);
    expect(parseLocalDate("2026-02-29")).toBeNull();
    expect(parseLocalDate("2026-02-31")).toBeNull();
    expect(parseLocalDate("2026-13-01")).toBeNull();
    expect(parseLocalDate("27/09/2026")).toBeNull();
    expect(parseLocalDate("")).toBeNull();
  });

  it("finds the start of the local day", () => {
    const start = startOfLocalDay(d("2026-03-08", 18, 45));
    expect(localDateString(start)).toBe("2026-03-08");
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("steps whole calendar days across both DST changes", () => {
    // Adding 24 hours from midnight on the 25-hour fall-back day lands on the
    // same date. Calendar arithmetic does not.
    const fallBack = new Date(2026, 10, 1, 0, 0);
    expect(localDateString(new Date(fallBack.getTime() + 24 * HOUR))).toBe("2026-11-01");
    expect(localDateString(addLocalDays(fallBack, 1))).toBe("2026-11-02");

    const beforeSpring = new Date(2026, 2, 7, 23, 30);
    expect(localDateString(addLocalDays(beforeSpring, 1))).toBe("2026-03-08");
    expect(localDateString(addLocalDays(beforeSpring, 2))).toBe("2026-03-09");
    expect(localDateString(addLocalDays(d("2026-03-09"), -2))).toBe("2026-03-07");
    expect(localDateString(addLocalDays(d("2026-12-31"), 1))).toBe("2027-01-01");
    expect(localDateString(addLocalDays(d("2026-03-01"), -1))).toBe("2026-02-28");
  });

  it("counts calendar days between dates regardless of DST", () => {
    expect(localDayNumber(d("2026-03-09", 0)) - localDayNumber(d("2026-03-08", 23))).toBe(1);
    expect(localDayNumber(d("2026-11-02", 0)) - localDayNumber(d("2026-11-01", 0))).toBe(1);
    expect(localDayNumber(d("2027-01-01")) - localDayNumber(d("2026-01-01"))).toBe(365);
  });

  it("measures time to the next local midnight on short and long days", () => {
    expect(msUntilNextLocalDay(new Date(2026, 2, 8, 0, 0))).toBe(23 * HOUR);
    expect(msUntilNextLocalDay(new Date(2026, 10, 1, 0, 0))).toBe(25 * HOUR);
    expect(msUntilNextLocalDay(new Date(2026, 5, 1, 23, 0))).toBe(HOUR);
  });
});

describe("times of day", () => {
  it("parses Postgres times and time-input values", () => {
    expect(parseClockTime("08:30")).toEqual({ hours: 8, minutes: 30, seconds: 0 });
    expect(parseClockTime("21:05:09")).toEqual({ hours: 21, minutes: 5, seconds: 9 });
    expect(parseClockTime("07:00:00.123")).toEqual({ hours: 7, minutes: 0, seconds: 0 });
  });

  it("rejects empty and malformed times", () => {
    for (const bad of [null, undefined, "", "8:30", "24:00", "12:60", "noon", "12:00:61"]) {
      expect(parseClockTime(bad)).toBeNull();
    }
  });

  it("formats times for inputs and for reading", () => {
    expect(timeInputValue("08:30:00")).toBe("08:30");
    expect(timeInputValue(null)).toBe("");
    expect(formatClockTime(null)).toBe("Any time");
    expect(formatClockTime("08:30:00", "en-US")).toMatch(/^8:30\sAM$/);
    expect(formatClockTime("21:05", "en-GB")).toBe("21:05");
  });
});

describe("schedules", () => {
  it("normalises days to unique, in-range, sorted values", () => {
    expect(normaliseDays([5, 1, 1, 7, -1, 3, 2.5])).toEqual([1, 3, 5]);
  });

  it("is scheduled only on its weekdays, and only while active", () => {
    const monday = d("2026-09-28");
    const tuesday = d("2026-09-29");
    expect(isScheduledOn({ days: MON_WED_FRI, active: true }, monday)).toBe(true);
    expect(isScheduledOn({ days: MON_WED_FRI, active: true }, tuesday)).toBe(false);
    expect(isScheduledOn({ days: MON_WED_FRI, active: false }, monday)).toBe(false);
  });

  it("lists today's routines by time, with any-time ones last", () => {
    const list = [
      routine({ id: "a", title: "Anytime B", remind_at: null }),
      routine({ id: "b", title: "Evening", remind_at: "20:00:00" }),
      routine({ id: "c", title: "Anytime A", remind_at: null }),
      routine({ id: "d", title: "Morning", remind_at: "07:30:00" }),
      routine({ id: "e", title: "Paused", remind_at: "06:00:00", active: false }),
      routine({ id: "f", title: "Weekends", remind_at: "05:00:00", days: [0, 6] }),
      routine({ id: "g", title: "Also morning", remind_at: "07:30" }),
    ];
    const monday = d("2026-09-28");
    expect(routinesForDay(list, monday).map((r) => r.id)).toEqual(["g", "d", "b", "c", "a"]);
    expect(compareByTime(list[0], list[0])).toBe(0);
  });

  it("describes days in plain words", () => {
    expect(describeDays(EVERY)).toBe("Every day");
    expect(describeDays([5, 4, 3, 2, 1])).toBe("Weekdays");
    expect(describeDays([6, 0])).toBe("Weekends");
    expect(describeDays([0, 3])).toBe("Wednesday and Sunday");
    expect(describeDays(MON_WED_FRI)).toBe("Monday, Wednesday and Friday");
    expect(describeDays([2])).toBe("Tuesday");
    expect(describeDays([])).toBe("No days");
  });
});

describe("completions", () => {
  it("groups rows by routine", () => {
    const grouped = groupCompletions([
      { routine_id: "a", completed_on: "2026-09-27" },
      { routine_id: "b", completed_on: "2026-09-27" },
      { routine_id: "a", completed_on: "2026-09-26" },
    ]);
    expect([...(grouped.get("a") ?? [])].sort()).toEqual(["2026-09-26", "2026-09-27"]);
    expect([...(grouped.get("b") ?? [])]).toEqual(["2026-09-27"]);
    expect(completionKey("a", "2026-09-27")).toBe("a|2026-09-27");
  });
});

describe("currentStreak", () => {
  const daily = { days: EVERY };
  const today = d("2026-09-25"); // a Friday

  it("counts today when it is done", () => {
    const done = new Set(["2026-09-23", "2026-09-24", "2026-09-25"]);
    expect(currentStreak(daily, done, today)).toBe(3);
  });

  it("does not break the run when today is still to do", () => {
    const done = new Set(["2026-09-23", "2026-09-24"]);
    expect(currentStreak(daily, done, today)).toBe(2);
  });

  it("is zero when the last planned day was missed", () => {
    const done = new Set(["2026-09-22", "2026-09-23"]);
    expect(currentStreak(daily, done, today)).toBe(0);
    expect(currentStreak(daily, new Set(), today)).toBe(0);
  });

  it("skips days the routine is not planned for", () => {
    // Monday, Wednesday and Friday: Tuesday and Thursday are not breaks.
    const done = new Set(["2026-09-21", "2026-09-23", "2026-09-25"]);
    expect(currentStreak({ days: MON_WED_FRI }, done, today)).toBe(3);
    // Over a weekend too: Friday the 18th, then the week above.
    done.add("2026-09-18");
    expect(currentStreak({ days: MON_WED_FRI }, done, today)).toBe(4);
  });

  it("starts from the previous planned day when today is not planned", () => {
    const saturday = d("2026-09-26");
    const done = new Set(["2026-09-23", "2026-09-25"]);
    expect(currentStreak({ days: MON_WED_FRI }, done, saturday)).toBe(2);
  });

  it("starts from the previous planned day when today is planned but not done", () => {
    const done = new Set(["2026-09-21", "2026-09-23"]);
    expect(currentStreak({ days: MON_WED_FRI }, done, today)).toBe(2);
  });

  it("stops at a missed planned day", () => {
    const done = new Set(["2026-09-21", "2026-09-25"]); // Wednesday missed
    expect(currentStreak({ days: MON_WED_FRI }, done, today)).toBe(1);
  });

  it("does not count extra days the routine was not planned for", () => {
    const done = new Set(["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"]);
    expect(currentStreak({ days: MON_WED_FRI }, done, today)).toBe(2);
  });

  it("walks back across both DST changes", () => {
    const spring = new Set(["2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"]);
    expect(currentStreak(daily, spring, d("2026-03-10", 0, 30))).toBe(5);
    const autumn = new Set(["2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(currentStreak(daily, autumn, d("2026-11-02", 23, 30))).toBe(3);
  });

  it("reports 'at least' when the run reaches the start of the history", () => {
    const done = new Set(["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"]);
    expect(streakDetails(daily, done, today, d("2026-09-23"))).toEqual({
      count: 3,
      atLeast: true,
    });
    expect(streakDetails(daily, done, today, d("2026-09-01"))).toEqual({
      count: 4,
      atLeast: false,
    });
  });

  it("is zero for a routine with no days", () => {
    expect(currentStreak({ days: [] }, new Set(["2026-09-25"]), today)).toBe(0);
  });
});

describe("weekSummary", () => {
  const wednesday = d("2026-09-23");

  it("covers Monday to Sunday by default", () => {
    const week = weekSummary({ days: EVERY }, new Set(), wednesday);
    expect(week.days.map((x) => x.date)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(week.days.filter((x) => x.isToday).map((x) => x.date)).toEqual(["2026-09-23"]);
  });

  it("can start the week on Sunday", () => {
    const week = weekSummary({ days: EVERY }, new Set(), wednesday, { weekStartsOn: 0 });
    expect(week.days[0].date).toBe("2026-09-20");
    expect(week.days[0].weekday).toBe(0);
  });

  it("labels each day and counts planned, done and extra days", () => {
    const done = new Set(["2026-09-21", "2026-09-22"]); // Monday, and Tuesday (not planned)
    const week = weekSummary({ days: MON_WED_FRI }, done, wednesday);
    expect(week.days.map((x) => x.status)).toEqual([
      "done",
      "done",
      "to-do",
      "not-planned",
      "upcoming",
      "not-planned",
      "not-planned",
    ]);
    expect(week).toMatchObject({ planned: 3, done: 1, extra: 1 });
  });

  it("marks a missed planned day as not done", () => {
    const week = weekSummary({ days: MON_WED_FRI }, new Set(), d("2026-09-24"));
    expect(week.days[0].status).toBe("not-done");
    expect(week.days[2].status).toBe("not-done");
  });

  it("does not count days before the routine existed", () => {
    const week = weekSummary({ days: EVERY }, new Set(), wednesday, {
      since: d("2026-09-23", 9),
    });
    expect(week.days.slice(0, 2).map((x) => x.status)).toEqual(["not-planned", "not-planned"]);
    expect(week.planned).toBe(5);
  });

  it("builds a seven-day week that spans a DST change", () => {
    const week = weekSummary({ days: EVERY }, new Set(), d("2026-11-01"));
    expect(week.days).toHaveLength(7);
    expect(week.days[0].date).toBe("2026-10-26");
    expect(week.days[6].date).toBe("2026-11-01");
  });
});

describe("nextReminder", () => {
  const list = [
    routine({ id: "am", title: "Morning", remind_at: "08:00:00" }),
    routine({ id: "pm", title: "Evening", remind_at: "20:00:00" }),
    routine({ id: "any", title: "Any time", remind_at: null }),
    routine({ id: "off", title: "Paused", remind_at: "09:00:00", active: false }),
  ];

  it("finds the next time today", () => {
    const next = nextReminder(list, d("2026-09-25", 7, 0));
    expect(next?.routine.id).toBe("am");
    expect(next?.at).toEqual(d("2026-09-25", 8, 0));
  });

  it("is strictly after now", () => {
    const next = nextReminder(list, d("2026-09-25", 8, 0));
    expect(next?.routine.id).toBe("pm");
  });

  it("rolls over to the next scheduled day", () => {
    const next = nextReminder(list, d("2026-09-25", 21, 0));
    expect(next?.routine.id).toBe("am");
    expect(next?.at).toEqual(d("2026-09-26", 8, 0));

    const mwf = [routine({ id: "mwf", days: MON_WED_FRI, remind_at: "10:00" })];
    expect(nextReminder(mwf, d("2026-09-25", 11, 0))?.at).toEqual(d("2026-09-28", 10, 0));
  });

  it("skips an occurrence already marked done", () => {
    const done = new Set([completionKey("am", "2026-09-25")]);
    const next = nextReminder(list, d("2026-09-25", 7, 0), { done });
    expect(next?.routine.id).toBe("pm");
  });

  it("returns every routine due at the same moment", () => {
    const same = [
      routine({ id: "b", title: "B", remind_at: "08:00" }),
      routine({ id: "a", title: "A", remind_at: "08:00:00" }),
    ];
    const next = nextReminder(same, d("2026-09-25", 7, 0));
    expect(next?.routine.id).toBe("a");
    expect(next?.routines.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("is null with nothing timed and active", () => {
    expect(nextReminder([list[2], list[3]], d("2026-09-25"))).toBeNull();
    expect(nextReminder([], d("2026-09-25"))).toBeNull();
  });

  it("keeps the wall-clock time across a DST change", () => {
    const next = nextReminder([list[0]], d("2026-03-07", 9, 0));
    expect(next?.at.getHours()).toBe(8);
    expect(localDateString(next!.at)).toBe("2026-03-08");
  });

  it("describes when in words", () => {
    const now = d("2026-09-25", 7);
    expect(describeWhen(d("2026-09-25", 8), now, "en-US")).toMatch(/^today at 8:00\sAM$/);
    expect(describeWhen(d("2026-09-26", 8), now, "en-US")).toMatch(/^tomorrow at 8:00\sAM$/);
    expect(describeWhen(d("2026-09-28", 8), now, "en-US")).toMatch(/^on Monday at 8:00\sAM$/);
  });
});

describe("calendar file", () => {
  it("escapes backslashes, semicolons, commas and newlines", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect(escapeIcsText("one\r\ntwo\rthree")).toBe("one\\ntwo\\nthree");
    expect(escapeIcsText("bell\u0007 tab\there")).toBe("bell tab\there");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const long = `DESCRIPTION:${"é".repeat(100)}${"x".repeat(50)}`;
    const folded = foldIcsLine(long);
    for (const line of folded.split("\r\n")) {
      expect(octets(line)).toBeLessThanOrEqual(75);
      expect(line).not.toContain("�");
    }
    expect(folded.split("\r\n").slice(1).every((line) => line.startsWith(" "))).toBe(true);
    expect(unfold(folded)).toBe(long);
    expect(foldIcsLine("SHORT:line")).toBe("SHORT:line");
  });

  const now = new Date(Date.UTC(2026, 8, 25, 14, 3, 9)); // Friday 10:03:09 in New York
  const routines: IcsRoutine[] = [
    routine({
      id: "abc",
      title: "Tablets, water; rest",
      notes: "Ask Sam if unsure",
      steps: ["Fill glass", "  ", "Take two, with food"],
      remind_at: "08:30:00",
      days: [5, 1, 3],
    }),
    routine({ id: "anytime", remind_at: null }),
    routine({ id: "paused", remind_at: "09:00", active: false }),
  ];
  const ics = buildIcs(routines, { now });
  const lines = unfold(ics).split("\r\n");

  it("uses CRLF line endings throughout", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("has a calendar wrapper with version and product id", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines.some((l) => l.startsWith("PRODID:"))).toBe(true);
    expect(lines.filter(Boolean).at(-1)).toBe("END:VCALENDAR");
  });

  it("has one event per active routine with a time", () => {
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(calendarRoutineCount(routines)).toBe(1);
  });

  it("repeats weekly on the routine's days", () => {
    expect(lines).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
    const all = buildIcs([routine({ id: "x" })], { now });
    expect(unfold(all)).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA");
  });

  it("starts at floating local time on the next scheduled date", () => {
    expect(lines).toContain("DTSTART:20260925T083000");
    const tuesdayOnly = buildIcs([routine({ id: "t", days: [2], remind_at: "18:15" })], { now });
    expect(unfold(tuesdayOnly)).toContain("DTSTART:20260929T181500");
  });

  it("stamps the file in UTC", () => {
    expect(lines).toContain("DTSTAMP:20260925T140309Z");
  });

  it("escapes the summary and lists the steps in the description", () => {
    expect(lines).toContain("SUMMARY:Tablets\\, water\\; rest");
    const description = lines.find((l) => l.startsWith("DESCRIPTION:Steps"));
    expect(description).toBe(
      "DESCRIPTION:Steps:\\n1. Fill glass\\n2. Take two\\, with food\\n\\nAsk Sam if unsure",
    );
  });

  it("alerts at the start time", () => {
    const alarm = lines.slice(lines.indexOf("BEGIN:VALARM"), lines.indexOf("END:VALARM") + 1);
    expect(alarm).toContain("ACTION:DISPLAY");
    expect(alarm).toContain("TRIGGER:-PT0M");
    expect(alarm.some((l) => l.startsWith("DESCRIPTION:"))).toBe(true);
  });

  it("keeps each routine's UID the same between downloads", () => {
    const uid = (text: string) => unfold(text).split("\r\n").find((l) => l.startsWith("UID:"));
    const later = buildIcs(routines, { now: new Date(Date.UTC(2026, 10, 3, 9)) });
    expect(uid(ics)).toBeDefined();
    expect(uid(later)).toBe(uid(ics));
    expect(uid(ics)).toContain("abc");
  });

  it("folds long descriptions so no line exceeds 75 octets", () => {
    const wordy = buildIcs(
      [routine({ id: "w", steps: Array.from({ length: 20 }, (_, i) => `Step number ${i} ✓ ${"ü".repeat(40)}`) })],
      { now },
    );
    for (const line of wordy.split("\r\n")) expect(octets(line)).toBeLessThanOrEqual(75);
  });

  it("is an empty calendar when nothing has a time", () => {
    const empty = buildIcs([routine({ remind_at: null })], { now });
    expect(empty).not.toContain("BEGIN:VEVENT");
    expect(empty).toContain("END:VCALENDAR");
  });
});

describe("motivation", () => {
  it("has about twenty distinct, short messages", () => {
    expect(MOTIVATION.length).toBeGreaterThanOrEqual(15);
    expect(new Set(MOTIVATION).size).toBe(MOTIVATION.length);
    for (const message of MOTIVATION) expect(message.length).toBeLessThanOrEqual(90);
  });

  it("shows the same message all day", () => {
    expect(messageForDate(d("2026-09-25", 0, 1))).toBe(messageForDate(d("2026-09-25", 23, 59)));
    expect(messageForDate(d("2026-03-08", 0, 30))).toBe(messageForDate(d("2026-03-08", 23, 30)));
  });

  it("changes from one day to the next, and is always a real message", () => {
    let day = d("2026-01-01");
    for (let i = 0; i < 60; i++) {
      const next = addLocalDays(day, 1);
      expect(MOTIVATION).toContain(messageForDate(day));
      expect(messageForDate(next)).not.toBe(messageForDate(day));
      day = next;
    }
  });

  it("works for dates before 1970", () => {
    expect(MOTIVATION).toContain(messageForDate(new Date(1960, 5, 1)));
  });
});

describe("validateRoutine", () => {
  const draft = (overrides: Partial<RoutineDraft> = {}): RoutineDraft => ({
    ...emptyDraft(),
    title: "Morning",
    ...overrides,
  });

  it("accepts a valid draft and returns clean values", () => {
    const { values, errors } = validateRoutine(
      draft({
        title: "  Morning  ",
        notes: "  Keys by the door ",
        steps: "  Shoes \n\n Keys\r\n  \nCoat  ",
        time: "07:45",
        days: [3, 1, 1],
      }),
    );
    expect(errors).toEqual({});
    expect(values).toEqual({
      title: "Morning",
      notes: "Keys by the door",
      steps: ["Shoes", "Keys", "Coat"],
      remind_at: "07:45",
      days: [1, 3],
      active: true,
    });
  });

  it("treats an empty time as any time", () => {
    expect(validateRoutine(draft({ time: "" })).values.remind_at).toBeNull();
  });

  it("requires a name of at most 120 characters", () => {
    expect(validateRoutine(draft({ title: "   " })).errors.title).toBeDefined();
    expect(validateRoutine(draft({ title: "a".repeat(120) })).errors.title).toBeUndefined();
    expect(validateRoutine(draft({ title: "a".repeat(121) })).errors.title).toBeDefined();
    // Counted in characters, as Postgres does, not UTF-16 units.
    expect(validateRoutine(draft({ title: "😀".repeat(120) })).errors.title).toBeUndefined();
    expect(charLength("😀😀")).toBe(2);
  });

  it("limits notes to 1000 characters", () => {
    expect(validateRoutine(draft({ notes: "n".repeat(1000) })).errors.notes).toBeUndefined();
    expect(validateRoutine(draft({ notes: "n".repeat(1001) })).errors.notes).toBeDefined();
  });

  it("allows up to 20 steps, counting only non-empty lines", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `Step ${i}`).join("\n\n");
    expect(validateRoutine(draft({ steps: twenty })).errors.steps).toBeUndefined();
    expect(validateRoutine(draft({ steps: `${twenty}\nOne more` })).errors.steps).toBeDefined();
    expect(parseSteps(" a \n\n b \r\n")).toEqual(["a", "b"]);
  });

  it("limits the total length of the steps", () => {
    const huge = Array.from({ length: 10 }, () => "s".repeat(601)).join("\n");
    expect(validateRoutine(draft({ steps: huge })).errors.steps).toBeDefined();
  });

  it("rejects a malformed time", () => {
    expect(validateRoutine(draft({ time: "25:00" })).errors.time).toBeDefined();
  });

  it("requires at least one day", () => {
    expect(validateRoutine(draft({ days: [] })).errors.days).toBeDefined();
    expect(validateRoutine(draft({ days: [9] })).errors.days).toBeDefined();
  });

  it("round-trips a saved routine through the form", () => {
    const saved = routine({ steps: ["One", "Two"], remind_at: "08:30:00", days: [5, 1] });
    const back = draftFromRoutine(saved);
    expect(back).toMatchObject({ steps: "One\nTwo", time: "08:30", days: [1, 5] });
    expect(validateRoutine(back).values).toMatchObject({
      title: saved.title,
      steps: saved.steps,
      remind_at: "08:30",
      days: [1, 5],
    });
  });

  it("ships example routines that pass validation", () => {
    expect(EXAMPLE_ROUTINES.length).toBeGreaterThanOrEqual(2);
    for (const example of EXAMPLE_ROUTINES) {
      const { errors } = validateRoutine({
        title: example.title,
        notes: example.notes,
        steps: example.steps.join("\n"),
        time: example.remind_at ?? "",
        days: example.days,
        active: example.active,
      });
      expect(errors).toEqual({});
    }
  });
});
