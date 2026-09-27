/**
 * Recognises "this table or function does not exist" errors.
 *
 * Schema changes reach the hosted database only when someone applies the
 * migrations (see docs/DEPLOYMENT.md), while the frontend deploys on every push
 * to main. In the window between the two, a page whose tables are missing
 * should say the feature is not available yet — not flash a raw PostgREST
 * message like "Could not find the table 'public.problems' in the schema cache".
 */

interface MaybePostgrestError {
  code?: string | null;
  message?: string | null;
}

// PGRST205: table not in PostgREST's schema cache. PGRST202: function not
// found. 42P01 / 42883: Postgres' own undefined_table / undefined_function,
// which surface when a view or function references the missing object.
const MISSING_SCHEMA_CODES = new Set(["PGRST205", "PGRST202", "42P01", "42883"]);

export function isMissingSchemaError(
  error: MaybePostgrestError | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) return true;
  return /schema cache/i.test(error.message ?? "");
}

// The storage API reports a missing bucket in its message rather than a code.
export function isMissingBucketError(
  error: MaybePostgrestError | null | undefined,
): boolean {
  return /bucket not found/i.test(error?.message ?? "");
}
