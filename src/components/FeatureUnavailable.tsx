import { Link } from "react-router-dom";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeatureUnavailableProps {
  /** What the visitor was trying to reach, e.g. "The problem repository". */
  feature: string;
  /** Heading level to render, so the page keeps a sensible outline. */
  headingLevel?: "h1" | "h2";
}

/**
 * Shown in place of a feature whose database tables are not deployed yet.
 * Honest about the state rather than rendering an empty list, which would
 * read as "nobody has posted anything".
 */
const FeatureUnavailable = ({
  feature,
  headingLevel = "h1",
}: FeatureUnavailableProps) => {
  const Heading = headingLevel;
  return (
    <div
      role="status"
      className="mx-auto max-w-xl rounded-xl border border-dashed border-border px-6 py-12 text-center"
    >
      <Wrench
        className="mx-auto mb-4 h-8 w-8 text-muted-foreground"
        aria-hidden="true"
      />
      <Heading className="font-heading text-2xl font-bold text-foreground">
        {feature} is being set up
      </Heading>
      <p className="mt-2 text-muted-foreground">
        This part of Abilitiverse is built but not yet switched on. Please check
        back soon.
      </p>
      <Button asChild variant="outline" className="mt-6 min-h-11">
        <Link to="/">Back to the homepage</Link>
      </Button>
    </div>
  );
};

export default FeatureUnavailable;
