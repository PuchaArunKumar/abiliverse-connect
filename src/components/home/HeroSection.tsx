import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

/**
 * Compact, left-aligned, and mostly white.
 *
 * The previous hero was a full-bleed saturated slab with centred marketing
 * copy — the visual language of a product launch page. A professional network
 * reads as credible by *restraining* colour to controls and accents and
 * leading with information rather than a pitch.
 */

const assurances = [
  "Free to join",
  "Built to WCAG 2.1 AA",
  "Open to everyone",
];

const HeroSection = () => {
  return (
    <section
      className="border-b border-border bg-background"
      aria-labelledby="hero-heading"
    >
      <div className="container grid gap-10 py-14 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:py-20">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-action">
            The assistive technology community
          </p>

          <h1
            id="hero-heading"
            className="max-w-2xl font-heading text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl lg:text-[2.75rem]"
          >
            Building a more accessible future, together
          </h1>

          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Document the problems disabled people actually face, find the people
            solving them, and build on work that already exists instead of
            starting over.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="min-h-12 text-base font-semibold">
              <Link to="/signup">
                Join Abilitiverse
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="min-h-12 text-base font-semibold"
            >
              <Link to="/problems">Browse the community</Link>
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2" role="list">
            {assurances.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check
                  className="h-4 w-4 shrink-0 text-action"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* The ecosystem this platform connects. Text, not decoration: a
            screen reader gets the same list a sighted reader sees. */}
        <div className="rounded-lg border border-border bg-card p-6 lg:p-8">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            One ecosystem
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3" role="list">
            {[
              "People with disabilities",
              "Caregivers",
              "Developers",
              "Researchers",
              "Designers",
              "Clinicians",
              "Startups",
              "NGOs",
              "Universities",
              "Investors",
            ].map((role) => (
              <li key={role} className="flex items-start gap-2 text-sm text-foreground">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-action"
                  aria-hidden="true"
                />
                {role}
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
            Nothing here is built <em>for</em> disabled people without them.
            Problems are documented by the people living them.
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
