/**
 * Remembers which session came from a password-reset link.
 *
 * The reset page must only accept a new password from a session created by a
 * recovery link, not from any signed-in session. The signals for that are
 * fleeting: the link's `#…type=recovery` hash, which the SDK clears once it
 * has read it, and a one-off PASSWORD_RECOVERY event. The reset page is loaded
 * on demand, so it can mount after both are gone, and a reload loses them too.
 * The session's own `amr` claim does not help: with the implicit flow the
 * token records the method as "otp", never "recovery".
 *
 * So the marker is taken while it still exists — when this module is first
 * evaluated, which happens with the main bundle before the SDK's asynchronous
 * URL handling can clear the hash — and tied to the session it belongs to by
 * the token's `session_id` claim, which survives token refreshes.
 */

const STORAGE_KEY = "abilitiverse:recovery-session";

/** The `session_id` claim of a Supabase access token, or null. */
export function sessionIdOf(accessToken: string | null | undefined): string | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as { session_id?: unknown };
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}

export function markRecoverySession(accessToken: string | null | undefined): void {
  const id = sessionIdOf(accessToken);
  if (!id) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage blocked: the reset page falls back to the event it may still hear.
  }
}

export function isRecoverySession(accessToken: string | null | undefined): boolean {
  const id = sessionIdOf(accessToken);
  if (!id) return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === id;
  } catch {
    return false;
  }
}

export function clearRecoverySession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Reads a recovery link's token from the URL hash, if this is one. */
export function captureRecoveryFromHash(hash: string): void {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.get("type") === "recovery") markRecoverySession(params.get("access_token"));
}

if (typeof window !== "undefined") captureRecoveryFromHash(window.location.hash);
