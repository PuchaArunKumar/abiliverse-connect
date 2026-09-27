// The app may be served from a sub-path (GitHub Pages serves it under
// /abiliverse-connect/), so anything that leaves the router — auth email
// redirects, full-page navigations — must include Vite's base path.
// BASE_URL is "/" for a root deploy and "/abiliverse-connect/" on Pages.
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Absolute URL for an in-app route, e.g. appUrl("/reset-password"). */
export const appUrl = (path: string) => `${window.location.origin}${basePath}${path}`;
