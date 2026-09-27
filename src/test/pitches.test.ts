import { describe, expect, it } from "vitest";
import { Constants } from "@/integrations/supabase/types";
import {
  EMPTY_PITCH_FORM,
  FEEDBACK_KINDS,
  PITCH_LIMITS,
  PITCH_NEEDS,
  PITCH_NEED_LABELS,
  PITCH_STAGES,
  PITCH_STAGE_HINTS,
  PITCH_STAGE_LABELS,
  canManagePitch,
  charCount,
  countTags,
  displayNameOr,
  feedbackKindLabel,
  formatFunding,
  friendlyInterestError,
  friendlyPitchError,
  hasMorePitches,
  isCurrencyCode,
  isPitchId,
  normaliseCurrency,
  parseFundingGoal,
  pitchResultsSummary,
  pitchToFormValues,
  pluralise,
  toPitchPayload,
  validateFeedback,
  validateInterest,
  validatePitchForm,
  type PitchDetailRow,
  type PitchFormValues,
} from "@/lib/pitches";

const valid: PitchFormValues = {
  ...EMPTY_PITCH_FORM,
  title: "Talking bus stops",
  tagline: "Stops announce themselves to a phone.",
  description: "A".repeat(PITCH_LIMITS.descriptionMin),
};

describe("labels match the database enums", () => {
  it("covers every pitch_stage, in order", () => {
    expect(PITCH_STAGES).toEqual([...Constants.public.Enums.pitch_stage]);
    for (const s of PITCH_STAGES) {
      expect(PITCH_STAGE_LABELS[s]).toBeTruthy();
      expect(PITCH_STAGE_HINTS[s]).toBeTruthy();
    }
  });

  it("covers every pitch_need, in order", () => {
    expect(PITCH_NEEDS).toEqual([...Constants.public.Enums.pitch_need]);
    for (const n of PITCH_NEEDS) expect(PITCH_NEED_LABELS[n]).toBeTruthy();
  });

  it("feedback kinds match the CHECK constraint", () => {
    expect([...FEEDBACK_KINDS]).toEqual(["question", "suggestion", "concern", "encouragement"]);
  });
});

describe("charCount", () => {
  it("counts code points, as Postgres char_length does", () => {
    expect("🦽🦽".length).toBe(4);
    expect(charCount("🦽🦽")).toBe(2);
  });
});

describe("parseFundingGoal", () => {
  it("treats an empty field as no goal", () => {
    expect(parseFundingGoal("   ")).toEqual({ ok: true, value: null });
  });

  it("accepts plain digits and thousands grouped by commas or spaces", () => {
    expect(parseFundingGoal("25000")).toEqual({ ok: true, value: 25000 });
    expect(parseFundingGoal("25,000")).toEqual({ ok: true, value: 25000 });
    expect(parseFundingGoal("1 250 000")).toEqual({ ok: true, value: 1250000 });
  });

  it("rejects decimals, ambiguous separators, signs and words", () => {
    for (const raw of ["2,5", "25.5", "-5", "1e6", "ten", "25,00"]) {
      expect(parseFundingGoal(raw).ok).toBe(false);
    }
  });

  it("enforces the database range", () => {
    expect(parseFundingGoal("0").ok).toBe(false);
    expect(parseFundingGoal(String(PITCH_LIMITS.fundingMax)).ok).toBe(true);
    expect(parseFundingGoal(String(PITCH_LIMITS.fundingMax + 1)).ok).toBe(false);
  });
});

describe("currency", () => {
  it("normalises and checks three-letter codes", () => {
    expect(normaliseCurrency(" usd ")).toBe("USD");
    expect(isCurrencyCode("USD")).toBe(true);
    expect(isCurrencyCode("US")).toBe(false);
    expect(isCurrencyCode("usd")).toBe(false);
  });

  it("formats with the code, never a bare symbol", () => {
    expect(formatFunding(25000, "EUR")).toMatch(/^EUR 25.000$/);
  });
});

describe("countTags", () => {
  it("counts distinct tags case-insensitively", () => {
    expect(countTags("a, A, b,, c")).toBe(3);
  });
});

describe("validatePitchForm", () => {
  it("accepts a minimal valid pitch", () => {
    expect(validatePitchForm(valid)).toEqual({});
  });

  it("requires title, tagline and description with their minimums", () => {
    const errors = validatePitchForm(EMPTY_PITCH_FORM);
    expect(errors.title).toBe("Enter a title.");
    expect(errors.tagline).toBe("Enter a tagline.");
    expect(errors.description).toBe("Enter a description.");

    const short = validatePitchForm({ ...valid, title: "abc" });
    expect(short.title).toContain("at least 4");
  });

  it("measures length after trimming, in code points", () => {
    expect(validatePitchForm({ ...valid, title: "   abc   " }).title).toBeDefined();
    expect(
      validatePitchForm({ ...valid, title: "🦽".repeat(PITCH_LIMITS.titleMax) }).title,
    ).toBeUndefined();
    expect(
      validatePitchForm({ ...valid, title: "a".repeat(PITCH_LIMITS.titleMax + 1) }).title,
    ).toContain("at most 120");
  });

  it("checks funding details only when funding is a need", () => {
    const hidden = { ...valid, fundingGoal: "lots", fundingCurrency: "x" };
    expect(validatePitchForm(hidden)).toEqual({});
    const shown = validatePitchForm({ ...hidden, needs: ["funding"] });
    expect(shown.fundingGoal).toBeDefined();
    expect(shown.fundingCurrency).toBeDefined();
  });

  it("accepts only full http(s) addresses", () => {
    expect(validatePitchForm({ ...valid, websiteUrl: "https://example.org" }).websiteUrl).toBeUndefined();
    for (const bad of ["javascript:alert(1)", "example.org", "http:example.org", "ftp://x.org"]) {
      expect(validatePitchForm({ ...valid, websiteUrl: bad }).websiteUrl).toBeDefined();
      expect(validatePitchForm({ ...valid, demoUrl: bad }).demoUrl).toBeDefined();
    }
    const long = `https://example.org/${"a".repeat(PITCH_LIMITS.urlMax)}`;
    expect(validatePitchForm({ ...valid, websiteUrl: long }).websiteUrl).toContain("at most");
  });

  it("limits the number of tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `t${i}`).join(",");
    expect(validatePitchForm({ ...valid, tags }).tags).toContain("You have 21");
  });
});

describe("toPitchPayload", () => {
  it("trims text, orders needs by the enum and parses tags", () => {
    const payload = toPitchPayload({
      ...valid,
      title: "  Talking bus stops  ",
      needs: ["testers", "funding"],
      fundingGoal: "25,000",
      fundingCurrency: "eur",
      tags: "Transit, transit, Blind",
      problem: { id: "p1", title: "Bus stops" },
    });
    expect(payload.title).toBe("Talking bus stops");
    expect(payload.needs).toEqual(["funding", "testers"]);
    expect(payload.funding_goal).toBe(25000);
    expect(payload.funding_currency).toBe("EUR");
    expect(payload.tags).toEqual(["transit", "blind"]);
    expect(payload.problem_id).toBe("p1");
    expect(payload).not.toHaveProperty("user_id");
    expect(payload).not.toHaveProperty("support_count");
  });

  it("drops a funding goal when funding is not a need", () => {
    const payload = toPitchPayload({ ...valid, fundingGoal: "500", fundingCurrency: "zz" });
    expect(payload.funding_goal).toBeNull();
    expect(payload.funding_currency).toBe("USD");
  });
});

describe("pitchToFormValues", () => {
  it("round-trips a stored pitch into the form", () => {
    const row: PitchDetailRow = {
      id: "p",
      user_id: "u",
      title: "T",
      tagline: "Tagline",
      description: "D",
      problem_id: null,
      stage: "pilot",
      needs: ["funding"],
      disability_types: [],
      funding_goal: 1000,
      funding_currency: "INR",
      website_url: "",
      demo_url: "",
      tags: ["a", "b"],
      is_open: false,
      support_count: 0,
      feedback_count: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const values = pitchToFormValues(row, null);
    expect(values.fundingGoal).toBe("1000");
    expect(values.tags).toBe("a, b");
    expect(values.isOpen).toBe(false);
    expect(toPitchPayload(values).tags).toEqual(["a", "b"]);
  });
});

describe("validateFeedback", () => {
  it("requires text and enforces the maximum", () => {
    expect(validateFeedback("   ")).toBeTruthy();
    expect(validateFeedback("Useful idea")).toBeNull();
    expect(validateFeedback("a".repeat(PITCH_LIMITS.feedbackMax + 1))).toContain("at most");
  });

  it("labels unknown kinds safely", () => {
    expect(feedbackKindLabel("question")).toBe("Question");
    expect(feedbackKindLabel("rant")).toBe("Feedback");
  });
});

describe("validateInterest", () => {
  it("accepts a complete request", () => {
    expect(
      validateInterest({
        offering: "mentorship",
        message: "I run a hardware lab.",
        contact: "me@example.org",
      }),
    ).toEqual({});
  });

  it("flags each missing or invalid field", () => {
    const errors = validateInterest({ offering: "", message: "hi", contact: "x" });
    expect(Object.keys(errors).sort()).toEqual(["contact", "message", "offering"]);
    expect(validateInterest({ offering: "money", message: "a".repeat(20), contact: "abc" }).offering)
      .toBeDefined();
  });
});

describe("small helpers", () => {
  it("falls back to Community member for empty names", () => {
    expect(displayNameOr(null)).toBe("Community member");
    expect(displayNameOr("   ")).toBe("Community member");
    expect(displayNameOr(" Asha ")).toBe("Asha");
  });

  it("pluralises", () => {
    expect(pluralise(1, "pitch", "pitches")).toBe("1 pitch");
    expect(pluralise(0, "pitch", "pitches")).toBe("0 pitches");
  });

  it("recognises pitch ids", () => {
    expect(isPitchId("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isPitchId("new")).toBe(false);
    expect(isPitchId(undefined)).toBe(false);
  });

  it("lets founders and moderators manage a pitch", () => {
    const pitch = { user_id: "founder" };
    expect(canManagePitch("founder", pitch, false)).toBe(true);
    expect(canManagePitch("mod", pitch, true)).toBe(true);
    expect(canManagePitch("someone", pitch, false)).toBe(false);
    expect(canManagePitch(null, pitch, true)).toBe(false);
  });

  it("summarises list results for the live region", () => {
    expect(pitchResultsSummary(0, 0)).toBe("No pitches found");
    expect(pitchResultsSummary(1, 1)).toBe("1 pitch found");
    expect(pitchResultsSummary(12, 30)).toBe("Showing 12 of 30 pitches");
    expect(pitchResultsSummary(3, null)).toBe("3 pitches shown");
    expect(hasMorePitches(12, 30)).toBe(true);
    expect(hasMorePitches(30, 30)).toBe(false);
    expect(hasMorePitches(12, null)).toBe(false);
  });
});

describe("friendly errors", () => {
  it("never passes raw PostgREST text through", () => {
    const raw = { code: "XX000", message: "new row violates row-level security policy" };
    expect(friendlyPitchError(raw, "Fallback.")).toBe("Fallback.");
  });

  it("recognises a missing schema, permissions and network trouble", () => {
    expect(friendlyPitchError({ code: "PGRST205", message: "" })).toContain("not switched on");
    expect(friendlyPitchError({ code: "42501", message: "" })).toContain("permission");
    expect(friendlyPitchError({ message: "TypeError: Failed to fetch" })).toContain("connection");
    expect(friendlyPitchError({ code: "PGRST301", message: "JWT expired" })).toContain("session");
  });

  it("explains interest-specific refusals", () => {
    expect(friendlyInterestError({ code: "23505" })).toContain("already sent");
    expect(friendlyInterestError({ code: "42501" })).toContain("not taking new interest");
    expect(friendlyInterestError({ code: "XX000" })).toContain("could not be sent");
  });
});
