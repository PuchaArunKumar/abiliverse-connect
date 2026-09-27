import { useEffect, useRef, useState } from "react";
import { Link2Off, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isMissingSchemaError } from "@/lib/supabase-errors";
import type { LinkedProblem } from "@/lib/pitches";

interface ProblemPickerProps {
  value: LinkedProblem | null;
  onChange: (problem: LinkedProblem | null) => void;
}

type SearchState = "idle" | "done" | "failed";

const MIN_QUERY = 3;

/**
 * Links a pitch to a documented problem.
 *
 * A search box and a list of buttons rather than a combobox: every screen
 * reader handles buttons in a list the same way, while combobox support still
 * varies, and this is a once-per-pitch choice where speed matters less than
 * certainty.
 */
const ProblemPicker = ({ value, onChange }: ProblemPickerProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LinkedProblem[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [unavailable, setUnavailable] = useState(false);
  const requestRef = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  // Where focus should go once the swap between search and chosen problem has
  // rendered; the control that had focus no longer exists.
  const pendingFocus = useRef<"search" | "clear" | null>(null);

  useEffect(() => {
    if (pendingFocus.current === "clear") clearRef.current?.focus();
    if (pendingFocus.current === "search") searchRef.current?.focus();
    pendingFocus.current = null;
  }, [value]);

  useEffect(() => {
    const term = query.trim();
    if (value || unavailable) return;
    const requestId = ++requestRef.current;
    if (term.length < MIN_QUERY) {
      setResults([]);
      setState("idle");
      return;
    }
    // The status line keeps its last message until new results arrive, so a
    // screen reader is not told "searching" on every keystroke.
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_problems", {
        _query: term,
        _limit: 5,
      });
      if (requestId !== requestRef.current) return;
      if (error) {
        setResults([]);
        if (isMissingSchemaError(error)) setUnavailable(true);
        else setState("failed");
        return;
      }
      setResults((data ?? []).map((row) => ({ id: row.id, title: row.title })));
      setState("done");
    }, 350);
    return () => clearTimeout(timer);
  }, [query, value, unavailable]);

  const choose = (problem: LinkedProblem) => {
    pendingFocus.current = "clear";
    onChange(problem);
    setQuery("");
    setResults([]);
    setState("idle");
  };

  const clear = () => {
    pendingFocus.current = "search";
    onChange(null);
  };

  const statusText =
    state === "failed"
      ? "Search is not working right now. You can leave this empty and add it later by editing your pitch."
      : state === "done"
        ? results.length === 0
          ? "No documented problems match. You can leave this empty."
          : `${results.length} matching ${results.length === 1 ? "problem" : "problems"}. Choose one to link it.`
        : "";

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">
        Linked problem (optional)
      </legend>
      <p id="pitch-problem-hint" className="text-sm text-muted-foreground">
        If your pitch answers a problem documented on Abilitiverse, link it so
        people can see the need behind your idea.
      </p>

      {value ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <p className="min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">
            <span className="text-muted-foreground">Linked to: </span>
            <span className="font-medium">
              {value.title || "a documented problem"}
            </span>
          </p>
          <Button
            ref={clearRef}
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={clear}
          >
            <Link2Off className="h-4 w-4" aria-hidden="true" />
            Remove link
          </Button>
        </div>
      ) : unavailable ? (
        <p className="text-sm text-muted-foreground">
          Linking a problem is not available yet. You can add one later by
          editing your pitch.
        </p>
      ) : (
        <>
          <Label htmlFor="pitch-problem-search">Search documented problems</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={searchRef}
              id="pitch-problem-search"
              type="search"
              className="min-h-11 pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Enter here would otherwise submit the whole pitch.
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="e.g. audible bus stop announcements"
              autoComplete="off"
              aria-describedby="pitch-problem-hint pitch-problem-status"
            />
          </div>
          <p
            id="pitch-problem-status"
            role="status"
            className="min-h-5 text-sm text-muted-foreground"
          >
            {statusText}
          </p>
          {results.length > 0 && (
            <ul className="space-y-2" aria-label="Matching problems">
              {results.map((problem) => (
                <li key={problem.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left [overflow-wrap:anywhere]"
                    onClick={() => choose(problem)}
                  >
                    <span className="sr-only">Link </span>
                    {problem.title}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </fieldset>
  );
};

export default ProblemPicker;
