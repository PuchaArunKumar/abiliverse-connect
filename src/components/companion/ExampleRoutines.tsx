import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EXAMPLE_ROUTINES,
  describeDays,
  formatClockTime,
  type ExampleRoutine,
} from "@/lib/companion";

interface ExampleRoutinesProps {
  /** Key of the example being added, if any. */
  adding: string | null;
  onAdd: (example: ExampleRoutine) => void;
}

/**
 * Ready-made starting points. A blank form is a hard place to begin, and
 * seeing a routine already broken into steps shows what "small steps" means.
 */
const ExampleRoutines = ({ adding, onAdd }: ExampleRoutinesProps) => (
  <ul className="grid gap-4 md:grid-cols-3" role="list">
    {EXAMPLE_ROUTINES.map((example) => {
      const titleId = `example-${example.key}-title`;
      const busy = adding === example.key;
      return (
        <li key={example.key}>
          <article
            aria-labelledby={titleId}
            className="flex h-full flex-col rounded-xl border border-border bg-card p-5"
          >
            <h3 id={titleId} className="font-heading text-xl font-semibold text-foreground">
              {example.title}
            </h3>
            <p className="mt-1 text-base text-muted-foreground">
              {describeDays(example.days)} · {formatClockTime(example.remind_at)}
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-6 text-base text-foreground">
              {example.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="mt-auto pt-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                onClick={() => onAdd(example)}
                aria-disabled={adding !== null || undefined}
              >
                {busy ? (
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Plus aria-hidden="true" />
                )}
                {busy ? "Adding…" : "Add this routine"}
                <span className="sr-only">: {example.title}</span>
              </Button>
            </div>
          </article>
        </li>
      );
    })}
  </ul>
);

export default ExampleRoutines;
