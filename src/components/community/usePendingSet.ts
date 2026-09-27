import { useCallback, useRef, useState } from "react";

/**
 * Tracks which items have a request in flight (a like, a comment, an
 * application), keyed by id.
 *
 * The ref is the guard: it updates synchronously, so a double click, or a
 * switch or touch input that repeats, cannot start a second request before
 * the first re-render. The state copy is only for showing "Sending…".
 */
export function usePendingSet() {
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  /** Marks `id` busy. Returns false when it already was: the caller stops. */
  const start = useCallback((id: string): boolean => {
    if (inFlight.current.has(id)) return false;
    inFlight.current.add(id);
    setPending(new Set(inFlight.current));
    return true;
  }, []);

  const finish = useCallback((id: string) => {
    inFlight.current.delete(id);
    setPending(new Set(inFlight.current));
  }, []);

  return { pending, start, finish };
}
