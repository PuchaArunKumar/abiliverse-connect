import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TITLE_MIN } from "@/lib/problems";

interface SimilarProblem {
  id: string;
  title: string;
  vote_count: number;
}

interface Result {
  term: string;
  items: SimilarProblem[];
}

/**
 * Duplicate detection while a title is typed. Ranked lexical match today; the
 * same call site swaps to an embedding search once problems carry vectors.
 *
 * Suggestions open in a new tab so that checking one never costs the person
 * the report they are halfway through writing.
 */
const SimilarProblems = ({ title }: { title: string }) => {
  const term = title.trim();
  const [result, setResult] = useState<Result>({ term: "", items: [] });

  useEffect(() => {
    if (term.length < TITLE_MIN) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_problems", {
        _query: term,
        _limit: 5,
      });
      // A reply for text that has since changed must not bring back a panel
      // for words that are no longer in the title.
      if (cancelled) return;
      setResult({
        term,
        items:
          error || !data
            ? []
            : data.map((d) => ({ id: d.id, title: d.title, vote_count: d.vote_count })),
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  // Only show suggestions that belong to the title as it reads right now.
  const items = term.length >= TITLE_MIN && result.term === term ? result.items : [];

  // A polite status region: the panel is advice, not an error, so it should
  // not interrupt someone mid-sentence the way role="alert" would.
  return (
    <div role="status">
      {items.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Lightbulb className="h-4 w-4 shrink-0" aria-hidden="true" />
            Similar problems already documented
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Adding to an existing report keeps the evidence together. These open
            in a new tab, so your draft here stays as it is.
          </p>
          <ul className="mt-2 space-y-2 text-sm" role="list">
            {items.map((s) => (
              <li key={s.id} className="break-words [overflow-wrap:anywhere]">
                <Link
                  to={`/problems/${s.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline-offset-2 hover:underline sm:min-h-0"
                >
                  {s.title}
                  <span className="sr-only"> (opens in new tab)</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </Link>{" "}
                <span className="text-muted-foreground">
                  ({s.vote_count} affected)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SimilarProblems;
