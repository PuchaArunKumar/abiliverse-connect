import { describe, expect, it } from "vitest";
import { Constants } from "@/integrations/supabase/types";
import {
  AGE_GROUP_LABELS,
  APP_ROLE_LABELS,
  DISABILITY_TYPE_LABELS,
  PROBLEM_STATUS_LABELS,
  SEVERITY_LABELS,
  parseTags,
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
