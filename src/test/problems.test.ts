import { describe, expect, it } from "vitest";
import { Constants } from "@/integrations/supabase/types";
import {
  AGE_GROUP_LABELS,
  APP_ROLE_LABELS,
  DISABILITY_TYPE_LABELS,
  EMPTY_DRAFT,
  FALLBACK_DISPLAY_NAME,
  MAX_RESEARCH_LINKS,
  PROBLEM_PAGE_SIZE,
  PROBLEM_STATUS_LABELS,
  REPORT_REASON_MAX,
  SEVERITY_LABELS,
  classifyLoadError,
  displayNameOr,
  draftFromProblem,
  draftStorageKey,
  draftToPayload,
  friendlyWriteError,
  isDraftEmpty,
  isProblemId,
  mergeById,
  nextPageRange,
  parseResearchLinks,
  parseStoredDraft,
  parseTags,
  resultsSummary,
  validateDraft,
  validateReportReason,
  wasEdited,
  type ProblemDraft,
} from "@/lib/problems";

describe("parseTags", () => {
  it("splits, trims and lowercases", () => {
    expect(parseTags(" Screen-Reader , Navigation ")).toEqual([
      "screen-reader",
      "navigation",
    ]);
  });

  it("drops empty entries from trailing or repeated commas", () => {
    expect(parseTags("a,,b,")).toEqual(["a", "b"]);
  });

  it("de-duplicates case-insensitively", () => {
    expect(parseTags("Mobility, mobility, MOBILITY")).toEqual(["mobility"]);
  });

  it("caps the list at 20 tags", () => {
    const raw = Array.from({ length: 30 }, (_, i) => `tag${i}`).join(",");
    expect(parseTags(raw)).toHaveLength(20);
  });

  it("returns nothing for blank input", () => {
    expect(parseTags("   ")).toEqual([]);
  });
});

// Every enum value must have a human label, or the UI renders a raw database
// value such as "chronic_illness". These fail the moment an enum gains a member
// and the label map is not updated alongside it.
describe("enum label coverage", () => {
  const cases: [string, Record<string, string>, readonly string[]][] = [
    ["disability_type", DISABILITY_TYPE_LABELS, Constants.public.Enums.disability_type],
    ["severity_level", SEVERITY_LABELS, Constants.public.Enums.severity_level],
    ["age_group", AGE_GROUP_LABELS, Constants.public.Enums.age_group],
    ["problem_status", PROBLEM_STATUS_LABELS, Constants.public.Enums.problem_status],
    ["app_role", APP_ROLE_LABELS, Constants.public.Enums.app_role],
  ];

  it.each(cases)("%s labels every value", (_name, labels, values) => {
    for (const value of values) {
      expect(labels[value]).toBeTruthy();
    }
    expect(Object.keys(labels).sort()).toEqual([...values].sort());
  });
});

const validDraft: ProblemDraft = {
  ...EMPTY_DRAFT,
  title: "Bus apps do not announce stops",
  description: "Screen reader users cannot tell which stop is next on most routes.",
};

describe("validateDraft", () => {
  it("accepts a draft with a title and description", () => {
    expect(validateDraft(validDraft)).toEqual({});
  });

  it("names the field in each message, for the error summary", () => {
    const errors = validateDraft({ ...EMPTY_DRAFT, title: "short", description: "too short" });
    expect(errors.title).toMatch(/title/);
    expect(errors.description).toMatch(/Describe the problem/);
  });

  it("measures the trimmed text", () => {
    expect(validateDraft({ ...validDraft, title: "   abc    " }).title).toBeDefined();
  });

  it("counts characters the way the database does, so emoji are one each", () => {
    // Four emoji are 8 UTF-16 units but 4 characters to char_length, which the
    // problems_title_check would reject.
    expect(validateDraft({ ...validDraft, title: "🦽🦽🦽🦽" }).title).toBeDefined();
    expect(validateDraft({ ...validDraft, description: "🦽".repeat(10) }).description).toBeDefined();
    // 200 emoji are 400 units but exactly the 200-character maximum.
    expect(validateDraft({ ...validDraft, title: "🦽".repeat(200) }).title).toBeUndefined();
  });

  it("rejects research links that are not http(s)", () => {
    const errors = validateDraft({
      ...validDraft,
      relatedResearch: "https://example.org/study\njavascript:alert(1)",
    });
    expect(errors.relatedResearch).toMatch(/javascript:alert\(1\)/);
  });

  it("caps the number of research links", () => {
    const links = Array.from({ length: MAX_RESEARCH_LINKS + 1 }, (_, i) => `https://example.org/${i}`);
    expect(validateDraft({ ...validDraft, relatedResearch: links.join("\n") }).relatedResearch).toMatch(
      /at most/,
    );
  });

  it("flags more tags than the database allows instead of dropping them silently", () => {
    const tags = Array.from({ length: 25 }, (_, i) => `t${i}`).join(",");
    expect(validateDraft({ ...validDraft, tags }).tags).toMatch(/at most 20/);
  });
});

describe("parseResearchLinks", () => {
  it("takes one link per line, trimmed, without blanks or repeats", () => {
    expect(parseResearchLinks(" https://a.org \r\n\nhttps://b.org\nhttps://a.org")).toEqual([
      "https://a.org",
      "https://b.org",
    ]);
  });
});

describe("draftToPayload", () => {
  it("normalises the free-text fields and leaves out status and counters", () => {
    const payload = draftToPayload({
      ...validDraft,
      title: "  Bus apps do not announce stops  ",
      tags: "Transit, transit, audio",
      relatedResearch: "https://example.org\n",
      severity: "unspecified",
      status: "solved",
    });
    expect(payload.title).toBe("Bus apps do not announce stops");
    expect(payload.tags).toEqual(["transit", "audio"]);
    expect(payload.related_research).toEqual(["https://example.org"]);
    expect(payload.severity).toBeNull();
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("user_id");
    expect(payload).not.toHaveProperty("vote_count");
  });

  it("round-trips through draftFromProblem", () => {
    const draft: ProblemDraft = {
      ...validDraft,
      category: "Transport",
      severity: "severe",
      status: "in_progress",
      disabilityTypes: ["visual"],
      ageGroups: ["adult"],
      tags: "audio, transit",
      relatedResearch: "https://a.org\nhttps://b.org",
      imageUrls: ["https://img.example/1.png"],
    };
    const payload = draftToPayload(draft);
    const back = draftFromProblem({ ...payload, status: draft.status });
    expect(back).toEqual(draft);
  });
});

describe("isDraftEmpty", () => {
  it("is true only when nothing has been entered", () => {
    expect(isDraftEmpty(EMPTY_DRAFT)).toBe(true);
    expect(isDraftEmpty({ ...EMPTY_DRAFT, title: "  " })).toBe(true);
    expect(isDraftEmpty({ ...EMPTY_DRAFT, ageGroups: ["child"] })).toBe(false);
  });
});

describe("parseStoredDraft", () => {
  it("restores a saved draft", () => {
    expect(parseStoredDraft(JSON.stringify(validDraft))).toEqual(validDraft);
  });

  it("ignores missing, broken or empty storage", () => {
    expect(parseStoredDraft(null)).toBeNull();
    expect(parseStoredDraft("{not json")).toBeNull();
    expect(parseStoredDraft("[]")).toBeNull();
    expect(parseStoredDraft(JSON.stringify(EMPTY_DRAFT))).toBeNull();
  });

  it("drops values the database would reject", () => {
    const draft = parseStoredDraft(
      JSON.stringify({
        ...validDraft,
        severity: "catastrophic",
        status: "deleted",
        disabilityTypes: ["visual", "made_up"],
        title: 42,
      }),
    );
    expect(draft?.severity).toBe("unspecified");
    expect(draft?.status).toBe("open");
    expect(draft?.disabilityTypes).toEqual(["visual"]);
    expect(draft?.title).toBe("");
  });
});

describe("draftStorageKey", () => {
  it("is per account", () => {
    expect(draftStorageKey("a")).not.toBe(draftStorageKey("b"));
  });
});

describe("isProblemId", () => {
  it("accepts UUIDs only", () => {
    expect(isProblemId("c9f0f895-fb98-4b91-8b3a-6f7e8d9c0b1a")).toBe(true);
    expect(isProblemId("C9F0F895-FB98-4B91-8B3A-6F7E8D9C0B1A")).toBe(true);
    expect(isProblemId("not-a-uuid")).toBe(false);
    expect(isProblemId(undefined)).toBe(false);
  });
});

describe("wasEdited", () => {
  it("ignores the moment between insert and the trigger", () => {
    expect(wasEdited("2026-09-01T10:00:00Z", "2026-09-01T10:00:00.500Z")).toBe(false);
  });

  it("is true once the problem was changed later", () => {
    expect(wasEdited("2026-09-01T10:00:00Z", "2026-09-03T09:00:00Z")).toBe(true);
  });

  it("is false for unreadable dates", () => {
    expect(wasEdited("nonsense", "2026-09-03T09:00:00Z")).toBe(false);
  });
});

describe("classifyLoadError", () => {
  it("tells a missing feature from a bad link from a real failure", () => {
    expect(classifyLoadError({ code: "PGRST205", message: "Could not find the table" })).toBe("missing");
    expect(classifyLoadError({ code: "22P02", message: "invalid input syntax for type uuid" })).toBe(
      "not_found",
    );
    expect(classifyLoadError({ code: "", message: "TypeError: Failed to fetch" })).toBe("error");
  });
});

describe("friendlyWriteError", () => {
  it("never passes raw database text through", () => {
    expect(
      friendlyWriteError({ code: "42501", message: "new row violates row-level security policy" }, "x"),
    ).toBe("You don't have permission to do that.");
    expect(friendlyWriteError({ code: "", message: "Failed to fetch" }, "x")).toMatch(/connection/);
    expect(friendlyWriteError({ code: "PGRST301", message: "JWT expired" }, "x")).toMatch(/Sign in again/);
    expect(friendlyWriteError({ code: "XX000", message: "internal" }, "Fallback.")).toBe("Fallback.");
    expect(friendlyWriteError(null, "Fallback.")).toBe("Fallback.");
  });
});

describe("paging helpers", () => {
  it("asks for the next inclusive range", () => {
    expect(nextPageRange(0)).toEqual([0, PROBLEM_PAGE_SIZE - 1]);
    expect(nextPageRange(20, 10)).toEqual([20, 29]);
  });

  it("appends without repeating rows that shifted between pages", () => {
    expect(mergeById([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }])).toEqual([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
  });

  it("announces the real total, not the page size", () => {
    expect(resultsSummary(20, 57)).toBe("Showing 20 of 57 problems");
    expect(resultsSummary(1, 1)).toBe("1 problem found");
    expect(resultsSummary(0, 0)).toBe("No problems found");
    expect(resultsSummary(3, null)).toBe("3 problems shown");
  });
});

describe("displayNameOr", () => {
  it("falls back when a profile has no name", () => {
    expect(displayNameOr("  Asha ")).toBe("Asha");
    expect(displayNameOr("")).toBe(FALLBACK_DISPLAY_NAME);
    expect(displayNameOr(null)).toBe(FALLBACK_DISPLAY_NAME);
  });
});

describe("validateReportReason", () => {
  it("needs 1 to 2000 characters of real text", () => {
    expect(validateReportReason("   ")).not.toBeNull();
    expect(validateReportReason("Spam link")).toBeNull();
    expect(validateReportReason("x".repeat(REPORT_REASON_MAX + 1))).toMatch(/2000/);
  });
});
