import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  members: number;
  problems: number;
  countries: number;
  opportunities: number;
}

// Only the figures the platform directory does not already report per-section,
// so the same number is never printed twice on one page.
const LABELS: { key: keyof Stats; label: string }[] = [
  { key: "members", label: "members" },
  { key: "countries", label: "countries represented" },
];

/**
 * Real counts, read from the database.
 *
 * These were previously hard-coded ("2,400+ community members", "1M+ lives
 * impacted"). The section now renders nothing until there is something true to
 * report, which is the correct state for a platform that has not launched: an
 * empty stats bar is honest, an invented one is not.
 *
 * Any error hides the section too. In particular, while public_stats has not
 * been deployed the call fails, and printing zeros then would present a
 * missing function as a platform with no members.
 */
const StatsSection = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc("public_stats")
      .single()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setStats(data as Stats);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) return null;

  const shown = LABELS.filter(({ key }) => Number(stats[key]) > 0);
  if (shown.length === 0) return null;

  return (
    <section className="border-b border-border bg-card" aria-labelledby="stats-heading">
      <div className="container flex flex-wrap items-center gap-x-10 gap-y-3 py-5">
        <h2 id="stats-heading" className="sr-only">
          Community in numbers
        </h2>
        {shown.map(({ key, label }) => (
          <p key={key} className="text-sm text-muted-foreground">
            <span className="font-heading text-lg font-bold text-foreground">
              {Number(stats[key]).toLocaleString()}
            </span>{" "}
            {label}
          </p>
        ))}
      </div>
    </section>
  );
};

export default StatsSection;
