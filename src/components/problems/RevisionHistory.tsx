import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/problems";

interface Revision {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

type HistoryState =
  | { status: "loading" }
  | { status: "error"; problemId: string }
  | { status: "ready"; problemId: string; revisions: Revision[] };

interface RevisionHistoryProps {
  problemId: string;
  /** Changes whenever the problem is edited, so the list refetches. */
  updatedAt: string;
}

/**
 * Earlier wording of a problem, for its author and moderators. Row-level
 * security hides revisions from everyone else, so this is only rendered for
 * them; for anyone else an empty result would falsely read as "never edited".
 */
const RevisionHistory = ({ problemId, updatedAt }: RevisionHistoryProps) => {
  const [state, setState] = useState<HistoryState>({ status: "loading" });

  useEffect(() => {
    // No reset to "loading" on a refetch: blanking the list would drop focus
    // from an open entry. A different problem is hidden until its own answer.
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("problem_revisions")
        .select("id, title, description, created_at")
        .eq("problem_id", problemId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setState(
        error
          ? { status: "error", problemId }
          : { status: "ready", problemId, revisions: data ?? [] },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [problemId, updatedAt]);

  if (state.status === "loading" || state.problemId !== problemId) return null;

  return (
    <section aria-labelledby="history-heading" className="mt-8">
      <h2
        id="history-heading"
        className="flex items-center gap-2 font-heading text-xl font-semibold text-foreground"
      >
        <History className="h-5 w-5" aria-hidden="true" />
        Edit history
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Visible only to the person who reported this problem and to
        moderators. Each entry is how the title and description read before an
        edit.
      </p>
      {state.status === "error" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          The edit history could not be loaded right now.
        </p>
      ) : state.revisions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          The title and description have not been edited.
        </p>
      ) : (
        <ol className="mt-4 space-y-3" role="list">
          {state.revisions.map((r) => (
            <li key={r.id}>
              <details className="rounded-lg border border-border p-3">
                <summary className="min-h-11 cursor-pointer break-words py-2 text-sm [overflow-wrap:anywhere]">
                  <span className="font-medium">Before the edit on {formatDateTime(r.created_at)}:</span>{" "}
                  {r.title}
                </summary>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground [overflow-wrap:anywhere]">
                  {r.description}
                </p>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

export default RevisionHistory;
