import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight } from "lucide-react";

interface Destination {
  href: string;
  name: string;
  description: string;
  table: "problems" | "jobs" | "courses" | "events" | null;
  unit: string;
}

const destinations: Destination[] = [
  {
    href: "/problems",
    name: "Problem repository",
    description:
      "Structured reports of the barriers disabled people face, searchable before you build so effort is not duplicated.",
    table: "problems",
    unit: "documented",
  },
  {
    href: "/jobs",
    name: "Jobs",
    description:
      "Roles at organisations building assistive technology, and employers who take access seriously.",
    table: "jobs",
    unit: "open",
  },
  {
    href: "/learn",
    name: "Learn",
    description:
      "Courses on accessibility, inclusive design, and the engineering behind assistive tools.",
    table: "courses",
    unit: "resources",
  },
  {
    href: "/opportunities",
    name: "Opportunities",
    description:
      "Grants, hackathons, conferences, and research programmes across the accessibility field.",
    table: "events",
    unit: "listed",
  },
  {
    href: "/feed",
    name: "Community feed",
    description:
      "What practitioners are discussing right now — questions, findings, and work in progress.",
    table: null,
    unit: "",
  },
  {
    href: "/connect",
    name: "Directory",
    description:
      "Find collaborators by discipline: researchers, developers, clinicians, and advocates.",
    table: null,
    unit: "",
  },
];

/**
 * Replaces the previous marketing feature grid.
 *
 * A professional network earns credibility by showing what is actually inside
 * it, so each destination reports a live row count. Counts are omitted rather
 * than shown as zero: an empty platform should read as new, not as broken, and
 * never as busier than it is.
 */
const PlatformDirectory = () => {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const tables = destinations
      .map((d) => d.table)
      .filter((t): t is NonNullable<Destination["table"]> => t !== null);

    Promise.all(
      tables.map(async (table) => {
        const { count, error } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true });
        return [table, error ? 0 : (count ?? 0)] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setCounts(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="border-b border-border bg-muted/40 py-14 lg:py-16"
      aria-labelledby="directory-heading"
    >
      <div className="container">
        <h2
          id="directory-heading"
          className="font-heading text-2xl font-bold tracking-tight text-foreground"
        >
          What's on Abilitiverse
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Six places to start, depending on whether you are documenting a
          problem, solving one, or looking for the people who already have.
        </p>

        <ul
          className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3"
          role="list"
        >
          {destinations.map((d) => {
            const count = d.table ? counts[d.table] : undefined;
            return (
              <li key={d.href} className="bg-card">
                <Link
                  to={d.href}
                  className="group flex h-full flex-col p-6 transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-heading text-base font-semibold text-foreground">
                      {d.name}
                    </h3>
                    {count !== undefined && count > 0 && (
                      <span className="shrink-0 text-sm font-semibold text-primary">
                        {count.toLocaleString()}{" "}
                        <span className="font-normal text-muted-foreground">
                          {d.unit}
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {d.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Open
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default PlatformDirectory;
