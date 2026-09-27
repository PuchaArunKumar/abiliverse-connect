import { useCallback, useEffect, useRef, type RefObject } from "react";

/**
 * Puts keyboard focus back after a "Try again" reload.
 *
 * Pressing Try again swaps the error message (and the button that had focus)
 * for a loading state, which drops focus to the page itself: a keyboard or
 * screen reader user is sent back to the top with no idea what happened.
 * Call the returned function from the button's onClick; once `busy` turns
 * false again, focus moves to `target` (a heading with tabIndex={-1}), from
 * where the new content, or the error, is read next.
 */
export function useFocusAfterReload(
  busy: boolean,
  target: RefObject<HTMLElement | null>,
): () => void {
  const pending = useRef(false);

  useEffect(() => {
    if (!pending.current || busy) return;
    pending.current = false;
    target.current?.focus();
  }, [busy, target]);

  return useCallback(() => {
    pending.current = true;
  }, []);
}
