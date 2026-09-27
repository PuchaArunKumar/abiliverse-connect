import { Link, useLocation } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * Rendered inside the normal Layout so someone who followed a broken link
 * still has the navigation, the skip link and the accessibility settings,
 * rather than a bare page with a single way out.
 */
const NotFound = () => {
  const { pathname } = useLocation();
  useDocumentTitle("Page not found");

  return (
    <Layout>
      <section className="container py-16">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Error 404
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-foreground">
            Page not found
          </h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            There is no page at{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground [overflow-wrap:anywhere]">
              {pathname}
            </code>
            . The link may be out of date, or the address may have a typo.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="min-h-11">
              <Link to="/">Go to the homepage</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/problems">Browse problems</Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default NotFound;
