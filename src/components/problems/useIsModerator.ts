import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ModeratorState {
  userId: string | null;
  value: boolean;
}

/**
 * Whether the signed-in person may moderate. Any failure, including the roles
 * migration not being applied yet, counts as "no": the database makes the
 * final decision anyway, so the only cost of a false "no" is a hidden button.
 *
 * `checked` is false while the answer for the current user is still coming,
 * so a page can wait rather than flash "you can't edit this".
 */
export function useIsModerator(userId: string | null | undefined): {
  isModerator: boolean;
  checked: boolean;
} {
  const [state, setState] = useState<ModeratorState>({ userId: null, value: false });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      let value = false;
      try {
        const { data, error } = await supabase.rpc("is_moderator");
        value = !error && data === true;
      } catch {
        value = false;
      }
      if (!cancelled) setState({ userId, value });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) return { isModerator: false, checked: true };
  const current = state.userId === userId;
  return { isModerator: current && state.value, checked: current };
}
