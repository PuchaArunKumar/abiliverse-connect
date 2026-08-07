import type { Database } from "@/integrations/supabase/types";

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

export function parseTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
