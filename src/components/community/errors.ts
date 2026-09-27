/**
 * Plain-language messages for failed writes on the community pages.
 *
 * PostgREST errors read like "new row for relation \"jobs\" violates check
 * constraint \"jobs_title_check\"", which tells nobody what to do next. The
 * forms validate before sending, so these are the cases that still get
 * through: a stale session, a lost connection, or a rule the form could not
 * know about.
 */

interface ErrorLike {
  code?: string | null;
  message?: string | null;
}

export const NETWORK_MESSAGE =
  "We could not reach the server. Check your connection and try again.";

export function friendlyError(
  error: ErrorLike | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;
  switch (error.code) {
    // check_violation: a length or value rule in the database.
    case "23514":
      return "Some details were not accepted. Check the limits shown under each field and try again.";
    // insufficient_privilege (row-level security) and an expired or missing JWT.
    case "42501":
    case "PGRST301":
    case "PGRST303":
      return "You do not have permission to do that. If you have been signed out, sign in again and retry.";
  }
  if (/failed to fetch|network ?error|load failed/i.test(error.message ?? "")) {
    return NETWORK_MESSAGE;
  }
  return fallback;
}

/** unique_violation: the row already exists (a second like or application). */
export function isDuplicateError(error: ErrorLike | null | undefined): boolean {
  return error?.code === "23505";
}
