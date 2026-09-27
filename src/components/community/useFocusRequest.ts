import { useEffect, useState } from "react";

/**
 * Moves keyboard focus to an element by id once the next render has
 * committed.
 *
 * Used when the control someone just pressed disappears (the "Easy apply"
 * button turns into a form, a submitted form turns into a confirmation).
 * Without it focus falls back to the top of the document and a keyboard or
 * screen reader user has to find their place again.
 */
export function useFocusRequest(): (id: string) => void {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    document.getElementById(target)?.focus();
    setTarget(null);
  }, [target]);

  return setTarget;
}
