/**
 * The item to move focus to once `removedId` has been deleted from a list:
 * the one after it, or the one before it when it was last. Null when the list
 * is about to be empty, so the caller can fall back to the list's heading.
 */
export function neighbourId(ids: readonly string[], removedId: string): string | null {
  const index = ids.indexOf(removedId);
  if (index === -1) return ids[0] ?? null;
  return ids[index + 1] ?? ids[index - 1] ?? null;
}

/** The element with `id`, else the one with `fallbackId`: a focus target. */
export function elementOrFallback(
  id: string | null,
  fallbackId: string,
): HTMLElement | null {
  return (
    (id ? document.getElementById(id) : null) ?? document.getElementById(fallbackId)
  );
}
