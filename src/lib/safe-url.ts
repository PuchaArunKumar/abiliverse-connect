/**
 * Accepts only absolute http(s) URLs.
 *
 * User-supplied links (job apply URLs, course links, pitch demos) render as
 * <a href>. A `javascript:` URL there runs in the viewer's session when
 * clicked, and a scheme-less value becomes a broken relative link, so anything
 * that is not plainly http(s) is rejected on input and not linked on output.
 */
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  const trimmed = (value ?? "").trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  // The literal "://" is required, as the database CHECKs require it
  // ('^https?://[^\s]+$'). URL() alone is more forgiving: it repairs
  // "https:example.com" and "https:\example.com" into valid URLs, so a form
  // would accept a link the insert then rejects.
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** The URL when it is safe to link, otherwise null — for use in `href`. */
export function safeHref(value: string | null | undefined): string | null {
  return isSafeHttpUrl(value) ? (value as string).trim() : null;
}
