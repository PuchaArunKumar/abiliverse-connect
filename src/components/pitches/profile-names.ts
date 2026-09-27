import { supabase } from "@/integrations/supabase/client";

/**
 * Display names for a set of users, keyed by user id. Names that are empty,
 * or profiles that cannot be read, are left out, so callers fall back to
 * "Community member" (see displayNameOr).
 *
 * profiles is readable only by signed-in users; call this only when there is
 * one, and treat a failure as "no names" rather than as a failed page.
 */
export async function fetchDisplayNames(
  userIds: string[],
): Promise<Record<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", ids);
  if (error || !data) return {};
  const names: Record<string, string> = {};
  for (const row of data) {
    const name = (row.display_name ?? "").trim();
    if (name) names[row.user_id] = name;
  }
  return names;
}
