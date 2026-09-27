import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoadProblemProps {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}

/**
 * A list that failed to load, said plainly, with a way to try again. An empty
 * list here would read as "nobody has shared anything yet", which is not true.
 */
const LoadProblem = ({ message, onRetry, retrying }: LoadProblemProps) => (
  <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
    <p role="alert" className="text-foreground [overflow-wrap:anywhere]">
      {message}
    </p>
    {/* aria-disabled rather than disabled, so focus stays on the button while
        the retry runs. */}
    <Button
      variant="outline"
      className="mt-4 min-h-11"
      aria-disabled={retrying || undefined}
      onClick={() => {
        if (!retrying) onRetry();
      }}
    >
      {retrying ? (
        <>
          <Loader2
            className="h-4 w-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          Trying again…
        </>
      ) : (
        "Try again"
      )}
    </Button>
  </div>
);

export default LoadProblem;
