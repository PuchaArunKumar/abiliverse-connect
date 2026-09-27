/**
 * Plain-language messages for Supabase Auth errors.
 *
 * The server's own messages are terse ("Invalid login credentials", "AAL2
 * session is required…") and some leak whether an address has an account.
 * Pages pass a fallback that fits what the person was doing.
 */

interface MaybeAuthError {
  code?: string | null;
  status?: number | null;
  name?: string | null;
  message?: string | null;
}

/** The action needs a session that has passed two-factor verification. */
export function isInsufficientAal(error: MaybeAuthError | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "insufficient_aal") return true;
  // Some endpoints (unenroll) have answered with only a message.
  return /\baal2\b/i.test(error.message ?? "");
}

function isNetworkError(error: MaybeAuthError): boolean {
  return error.name === "AuthRetryableFetchError" || error.status === 0;
}

export function friendlyAuthError(
  error: MaybeAuthError | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;
  if (isNetworkError(error)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password do not match. Check them and try again.";
    case "email_not_confirmed":
      return "Please confirm your email address first, using the link we sent you.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "weak_password":
      // The server's text lists what the password is missing.
      return error.message
        ? `Please choose a stronger password. ${error.message}`
        : "Please choose a stronger password.";
    case "same_password":
      return "Your new password must be different from your current one.";
    case "mfa_verification_failed":
      return "That code did not work. Check your authenticator app and enter the current code.";
    case "mfa_challenge_expired":
      return "That code has expired. Enter the new code from your authenticator app.";
    case "insufficient_aal":
      return "Enter the code from your authenticator app first.";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
      return "Your session has ended. Please sign in again.";
    default:
      return fallback;
  }
}
