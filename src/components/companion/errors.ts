interface MaybePostgrestError {
  code?: string | null;
  message?: string | null;
}

/**
 * A sentence someone can act on, in place of a raw PostgREST message.
 * `action` finishes "Could not …", e.g. "save the routine".
 *
 * Missing tables are not handled here: callers check isMissingSchemaError
 * first and show FeatureUnavailable instead.
 */
export function describeCompanionError(
  error: MaybePostgrestError | null | undefined,
  action: string,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "PGRST116") {
    return `Could not ${action}. The routine may have been deleted in another tab. Reload the page to see your routines as they are now.`;
  }
  if (code === "42501") {
    return `Could not ${action}. Your sign-in may have expired. Sign out, sign in again and try once more.`;
  }
  if (code === "23514" || code === "22P02") {
    return `Could not ${action}, because something in it is outside the allowed limits. Check each field and try again.`;
  }
  if (/fetch|network|timeout/i.test(message)) {
    return `Could not ${action}. The connection dropped. Check your internet connection and try again.`;
  }
  return `Could not ${action}. Please try again in a moment.`;
}
