import { describe, expect, it } from "vitest";
import {
  LIMITS,
  charLength,
  commentBodyError,
  coverNoteError,
  firstErrorField,
  lengthError,
  optionalUrlError,
  parseTagList,
  postBodyError,
  validateContact,
  validateCourse,
  validateEvent,
  validateJob,
  type CourseForm,
  type EventForm,
  type JobForm,
} from "@/components/community/validation";
import { friendlyError, isDuplicateError, NETWORK_MESSAGE } from "@/components/community/errors";
import { displayName, initialOf, initialsOf, plural } from "@/components/community/format";
import { neighbourId } from "@/components/community/list";

const job = (overrides: Partial<JobForm> = {}): JobForm => ({
  title: "Accessibility tester",
  company: "Acme",
  location: "",
  description: "Test our apps with a screen reader.",
  apply_url: "",
  tags: "",
  remote: false,
  ...overrides,
});

const course = (overrides: Partial<CourseForm> = {}): CourseForm => ({
  title: "Intro to ARIA",
  description: "A short course.",
  provider: "",
  url: "",
  level: "beginner",
  tags: "",
  ...overrides,
});

const event = (overrides: Partial<EventForm> = {}): EventForm => ({
  kind: "event",
  title: "Meetup",
  description: "Monthly meetup.",
  starts_at: "",
  location: "",
  link: "",
  ...overrides,
});

describe("lengths", () => {
  it("counts characters the way Postgres char_length does", () => {
    expect(charLength("ab")).toBe(2);
    // One code point, two UTF-16 units.
    expect(charLength("😀")).toBe(1);
  });

  it("a single emoji is too short for a two-character title", () => {
    expect(lengthError("Title", "😀", LIMITS.jobTitle)).toMatch(/at least 2/);
  });

  it("reports required, too short and too long separately", () => {
    expect(lengthError("Title", "", LIMITS.jobTitle)).toBe("Title is required.");
    expect(lengthError("Title", "A", LIMITS.jobTitle)).toMatch(/at least 2/);
    expect(lengthError("Title", "x".repeat(201), LIMITS.jobTitle)).toMatch(/at most 200.*201/);
    expect(lengthError("Title", "QA", LIMITS.jobTitle)).toBeUndefined();
  });
});

describe("posts and comments", () => {
  it("rejects whitespace-only bodies", () => {
    expect(postBodyError("   \n ")).toBeDefined();
    expect(commentBodyError("\t")).toBeDefined();
  });

  it("matches the database limits (posts 5,000, comments 2,000)", () => {
    expect(postBodyError("x".repeat(5000))).toBeUndefined();
    expect(postBodyError("x".repeat(5001))).toBeDefined();
    expect(commentBodyError("x".repeat(2000))).toBeUndefined();
    expect(commentBodyError("x".repeat(2001))).toBeDefined();
  });

  it("allows an empty cover note but caps it at 4,000", () => {
    expect(coverNoteError("")).toBeUndefined();
    expect(coverNoteError("x".repeat(4001))).toBeDefined();
  });
});

describe("links", () => {
  it("accepts empty or absolute http(s) addresses only", () => {
    expect(optionalUrlError("Link", "")).toBeUndefined();
    expect(optionalUrlError("Link", "https://example.org/jobs")).toBeUndefined();
    expect(optionalUrlError("Link", "http://example.org")).toBeUndefined();
  });

  // URL() repairs these into valid http(s) URLs, but the database CHECK
  // ('^https?://[^\s]+$') rejects them, so the form must too.
  it.each([
    "acme.com/careers",
    "javascript:alert(1)",
    "ms-officecmd:x",
    "ftp://example.org",
    "https:example.com",
    "https:/example.com",
    "http:example.com/path",
    "https:\\\\example.com",
  ])(
    "rejects %s",
    (value) => {
      expect(optionalUrlError("Link", value)).toMatch(/https:\/\//);
    },
  );
});

describe("tags", () => {
  it("trims, collapses spaces and drops duplicates ignoring case", () => {
    expect(parseTagList(" Screen reader ,screen  reader, , Step-free ").tags).toEqual([
      "Screen reader",
      "Step-free",
    ]);
  });

  it("limits the number and length of tags", () => {
    const many = Array.from({ length: LIMITS.tagCount + 1 }, (_, i) => `t${i}`).join(",");
    expect(parseTagList(many).error).toBeDefined();
    expect(parseTagList("x".repeat(LIMITS.tagLength + 1)).error).toBeDefined();
  });
});

describe("validateJob", () => {
  it("trims what it returns", () => {
    const { values, errors } = validateJob(job({ title: "  QA  ", company: " Acme " }));
    expect(errors).toEqual({});
    expect(values.title).toBe("QA");
    expect(values.company).toBe("Acme");
  });

  it("rejects a title of spaces, which would publish a blank heading", () => {
    expect(validateJob(job({ title: "  " })).errors.title).toBeDefined();
  });

  it("flags a scheme-less apply link", () => {
    expect(validateJob(job({ apply_url: "acme.com/careers" })).errors.apply_url).toBeDefined();
  });

  it("names the first invalid field in form order", () => {
    const { errors } = validateJob(job({ title: "", description: "" }));
    expect(firstErrorField(["title", "company", "description"] as const, errors)).toBe("title");
  });
});

describe("validateCourse", () => {
  it("accepts a valid course and caps the description at 4,000", () => {
    expect(validateCourse(course()).errors).toEqual({});
    expect(validateCourse(course({ description: "x".repeat(4001) })).errors.description).toBeDefined();
  });
});

describe("validateEvent", () => {
  it("drops date and location when the kind is not an event", () => {
    const { values } = validateEvent(
      event({ kind: "guidance", starts_at: "2026-10-12T18:00", location: "Hyderabad" }),
    );
    expect(values.starts_at).toBeNull();
    expect(values.location).toBe("");
  });

  it("keeps date and location for events", () => {
    const { values } = validateEvent(
      event({ starts_at: "2026-10-12T18:00", location: " Hyderabad " }),
    );
    expect(values.starts_at).toBe(new Date("2026-10-12T18:00").toISOString());
    expect(values.location).toBe("Hyderabad");
  });

  it("caps the description at 5,000", () => {
    expect(validateEvent(event({ description: "x".repeat(5001) })).errors.description).toBeDefined();
  });
});

describe("validateContact", () => {
  const contact = { name: "Asha", email: "asha@example.org", topic: "", message: "Hello there, a question." };

  it("mirrors send_contact_message's rules", () => {
    expect(validateContact(contact).errors).toEqual({});
    expect(validateContact({ ...contact, name: " " }).errors.name).toBeDefined();
    expect(validateContact({ ...contact, email: "asha" }).errors.email).toBeDefined();
    expect(validateContact({ ...contact, email: "a b@example.org" }).errors.email).toBeDefined();
    expect(validateContact({ ...contact, topic: "x".repeat(101) }).errors.topic).toBeDefined();
    expect(validateContact({ ...contact, message: "Too short" }).errors.message).toBeDefined();
    expect(validateContact({ ...contact, message: "x".repeat(5001) }).errors.message).toBeDefined();
  });

  it("trims the values it returns", () => {
    expect(validateContact({ ...contact, name: "  Asha " }).values.name).toBe("Asha");
  });
});

describe("errors", () => {
  it("never shows a raw constraint message", () => {
    const message = friendlyError(
      { code: "23514", message: 'new row for relation "jobs" violates check constraint "jobs_title_check"' },
      "fallback",
    );
    expect(message).not.toMatch(/constraint/);
  });

  it("recognises network failures and duplicates", () => {
    expect(friendlyError({ message: "TypeError: Failed to fetch" }, "fallback")).toBe(NETWORK_MESSAGE);
    expect(isDuplicateError({ code: "23505" })).toBe(true);
    expect(isDuplicateError(null)).toBe(false);
  });
});

describe("format", () => {
  it("falls back to a neutral name when display_name is empty", () => {
    expect(displayName("")).toBe("Community member");
    expect(displayName("  ")).toBe("Community member");
    expect(displayName(null)).toBe("Community member");
    expect(displayName(" Asha ")).toBe("Asha");
  });

  it("keeps an emoji whole in initials", () => {
    expect(initialOf("😀 Smile")).toBe("😀");
    expect(initialsOf("Asha Rao")).toBe("AR");
  });

  it("pluralises", () => {
    expect(plural(1, "like", "likes")).toBe("1 like");
    expect(plural(1200, "like", "likes")).toBe("1,200 likes");
  });
});

describe("neighbourId", () => {
  it("prefers the next item, then the previous, then nothing", () => {
    expect(neighbourId(["a", "b", "c"], "b")).toBe("c");
    expect(neighbourId(["a", "b", "c"], "c")).toBe("b");
    expect(neighbourId(["a"], "a")).toBeNull();
  });
});
