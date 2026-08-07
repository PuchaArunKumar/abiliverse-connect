import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  members: number;
  problems: number;
  countries: number;
  opportunities: number;
}

const LABELS: { key: keyof Stats; label: string }[] = [
  { key: "members", label: "Community members" },
  { key: "problems", label: "Problems documented" },
  { key: "countries", label: "Countries represented" },
  { key: "opportunities", label: "Opportunities shared" },
];

/**
 * Real counts, read from the database.
 *
 * These were previously hard-coded ("2,400+ community members", "1M+ lives
 * impacted") on a live public site. The section now renders nothing until
 * there is something true to report, which is the correct state for a platform
 * that has not launched: an empty stats block is honest, an invented one is not.
 */
const StatsSection = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    supabase
      .rpc("public_stats")
      .single()
      .then(({ data, error }) => {
        if (!error && data) setStats(data as Stats);
      });
  }, []);

  if (!stats) return null;

  const shown = LABELS.filter(({ key }) => stats[key] > 0);
  if (shown.length === 0) return null;

  return (
    <section className="bg-secondary py-16" aria-labelledby="stats-heading">
      <div className="container">
        <h2 id="stats-heading" className="sr-only">
          Our impact in numbers
        </h2>
        <div
          className="grid gap-8"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(10rem, 1fr))`,
          }}
        >
          {shown.map(({ key, label }) => (
            <div key={key} className="text-center">
              <p className="font-heading text-3xl font-extrabold text-primary md:text-4xl">
                {stats[key].toLocaleString()}
              </p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
