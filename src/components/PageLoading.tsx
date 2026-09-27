/**
 * Full-height loading state for route transitions and auth checks.
 *
 * The spinner is decorative; the status text is what a screen reader hears,
 * so a blind user is not left on a silent page while a chunk downloads.
 */
const PageLoading = () => (
  <div
    role="status"
    className="flex min-h-screen flex-col items-center justify-center gap-3"
  >
    <div
      className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent motion-reduce:animate-none"
      aria-hidden="true"
    />
    <span className="sr-only">Loading…</span>
  </div>
);

export default PageLoading;
