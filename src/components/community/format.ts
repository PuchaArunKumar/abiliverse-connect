/**
 * profiles.display_name can be empty (it no longer defaults to the member's
 * email address), so every place that shows an author falls back to the same
 * neutral wording.
 */
export const FALLBACK_NAME = "Community member";

export function displayName(name: string | null | undefined): string {
  return name?.trim() || FALLBACK_NAME;
}

/**
 * The first character for an avatar placeholder. Array.from keeps an emoji or
 * other astral character whole instead of splitting a surrogate pair.
 */
export function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? "?").toUpperCase();
}

/** Up to two initials, e.g. "Asha Rao" -> "AR". */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
  return Array.from(letters).slice(0, 2).join("") || "?";
}

export function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en")} ${count === 1 ? one : many}`;
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
