import { useEffect } from "react";

const SITE_NAME = "Abilitiverse";

/**
 * Sets the browser tab title for the current page (WCAG 2.4.2).
 *
 * In a single-page app the title otherwise never changes, so screen reader
 * users hear the same name on every route and cannot tell a navigation
 * happened, and every open tab reads alike.
 *
 * Pass the page's own name; the site name is appended. Pass null while the
 * real name is still loading to leave the title untouched.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (title === null || title === undefined) return;
    document.title = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}
