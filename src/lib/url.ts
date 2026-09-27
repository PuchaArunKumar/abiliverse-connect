// The app may be served from a sub-path (GitHub Pages serves it under
// /abiliverse-connect/), so anything that leaves the router — auth email
// redirects, full-page navigations — must include Vite's base path.
// BASE_URL is "/" for a root deploy and "/abiliverse-connect/" on Pages.
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Absolute URL for an in-app route, e.g. appUrl("/reset-password"). */
export const appUrl = (path: string) => `${window.location.origin}${basePath}${path}`;

// A backslash is read as "/" by the URL parser, and tabs and newlines are
// silently dropped from it, so "/\evil.example" and "/<TAB>/evil.example" both
// resolve to another host even though they start with a single "/".
// eslint-disable-next-line no-control-regex
const UNSAFE_PATH_CHARS = /[\\\u0000-\u001f\u007f]/;
// The same characters still percent-encoded. Harmless to the router as they
// are, but a value that was encoded twice becomes one of the above as soon as
// anything decodes it again, and no real page link needs them.
const UNSAFE_ENCODED_CHARS = /%(?:[01][0-9a-f]|7f|5c)/i;

// Returning to one of these after signing in would only bounce straight on
// again (or show a spent reset link), so they are never a destination.
const AUTH_PAGES = /^\/(login|signup|forgot-password|reset-password)(\/|$)/;

/** True for the sign-in, sign-up and password pages (router-relative path). */
export const isAuthPage = (path: string) => AUTH_PAGES.test(path);

/**
 * The in-app path to return to after signing in, or `fallback`.
 *
 * `?next=` arrives in a link anyone can craft. React Router falls back to a
 * full `location.assign` when pushState refuses a cross-origin URL, so an
 * unchecked value turns the sign-in page into a trusted-looking redirect to a
 * phishing site. Only same-origin paths survive. The result is relative to the
 * router, so a value that already carries the Pages base path has it removed
 * (navigate() adds it back).
 */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (UNSAFE_PATH_CHARS.test(raw) || UNSAFE_ENCODED_CHARS.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, window.location.origin);
  } catch {
    return fallback;
  }
  if (url.origin !== window.location.origin) return fallback;

  let path = url.pathname;
  if (basePath && (path === basePath || path.startsWith(`${basePath}/`))) {
    path = path.slice(basePath.length) || "/";
  }
  // Normalisation can produce a protocol-relative path from an odd input
  // (e.g. "/./%2F..."); never hand one of those to the router.
  if (path.startsWith("//")) return fallback;
  if (isAuthPage(path)) return fallback;
  return `${path}${url.search}${url.hash}`;
}
