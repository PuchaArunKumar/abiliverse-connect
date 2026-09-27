import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Routine } from "@/lib/companion";

interface GuidedStepsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: Routine | null;
  /** Whether the routine is already marked done today. */
  doneToday: boolean;
  /** Marks the routine done today; resolves to an error message, or null. */
  onFinish: () => Promise<string | null>;
  onCloseAutoFocus: (event: Event) => void;
  /** Shown on the "all done" screen. */
  encouragement: string;
}

/**
 * One step at a time, in large text. A long list asks someone to hold their
 * place in it; a single instruction with "Next" does not.
 */
const GuidedSteps = ({
  open,
  onOpenChange,
  routine,
  doneToday,
  onFinish,
  onCloseAutoFocus,
  encouragement,
}: GuidedStepsProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      // The body moves focus to the step itself, so the first thing heard is
      // the instruction rather than a button name.
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={onCloseAutoFocus}
      className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg sm:max-w-2xl"
    >
      {routine && (
        <GuidedStepsBody
          routine={routine}
          doneToday={doneToday}
          onFinish={onFinish}
          onClose={() => onOpenChange(false)}
          encouragement={encouragement}
        />
      )}
    </DialogContent>
  </Dialog>
);

interface GuidedStepsBodyProps {
  routine: Routine;
  doneToday: boolean;
  onFinish: () => Promise<string | null>;
  onClose: () => void;
  encouragement: string;
}

const GuidedStepsBody = ({
  routine,
  doneToday,
  onFinish,
  onClose,
  encouragement,
}: GuidedStepsBodyProps) => {
  const steps = routine.steps.map((s) => s.trim()).filter(Boolean);
  const total = steps.length;
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [alreadyDone] = useState(doneToday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Every change of step moves focus to the step, so a screen reader reads the
  // new instruction and a keyboard user starts from the top of it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [index, finished]);

  const isLast = index >= total - 1;

  const finish = async () => {
    if (busyRef.current) return;
    if (doneToday) {
      setFinished(true);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const message = await onFinish();
    busyRef.current = false;
    setBusy(false);
    if (message) setError(message);
    else setFinished(true);
  };

  if (finished) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl [overflow-wrap:anywhere]">
            {routine.title}
          </DialogTitle>
          <DialogDescription className="text-base">
            {alreadyDone
              ? "This routine was already marked as done for today."
              : "Marked as done for today."}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 text-center">
          <Check
            className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary p-2 text-primary-foreground"
            aria-hidden="true"
          />
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="font-heading text-3xl font-bold text-foreground outline-none"
          >
            All done
          </h3>
          <p className="mt-3 text-lg text-foreground">
            {total > 1 ? `You finished all ${total} steps.` : "You finished the routine."}
          </p>
          <p className="mt-2 text-lg text-muted-foreground">{encouragement}</p>
        </div>
        <Button type="button" className="min-h-14 w-full text-lg" onClick={onClose}>
          Back to Today
        </Button>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl [overflow-wrap:anywhere]">
          {routine.title}
        </DialogTitle>
        <DialogDescription className="text-base">
          One step at a time. Take as long as you need.
        </DialogDescription>
      </DialogHeader>

      {total === 0 ? (
        <div className="py-4">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="font-heading text-2xl font-semibold text-foreground outline-none"
          >
            No steps yet
          </h3>
          <p className="mt-2 text-lg">
            You can add steps with Edit under My routines, or choose Finish to mark it done.
          </p>
        </div>
      ) : (
        <div className="py-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="mt-6 min-h-[8rem] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="block text-lg font-medium text-muted-foreground">
              Step {index + 1} of {total}
            </span>
            <span className="mt-3 block whitespace-pre-line font-heading text-2xl font-semibold leading-snug text-foreground [overflow-wrap:anywhere] sm:text-3xl">
              {steps[index]}
            </span>
          </h3>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-base font-medium text-destructive"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {total > 1 && (
          <Button
            type="button"
            variant="outline"
            className="min-h-14 text-lg sm:min-w-36"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
        )}
        {isLast ? (
          <Button
            type="button"
            className="min-h-14 text-lg sm:ml-auto sm:min-w-36"
            onClick={finish}
            aria-disabled={busy || undefined}
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                <Check aria-hidden="true" />
                Finish
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            className="min-h-14 text-lg sm:ml-auto sm:min-w-36"
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
          >
            Next
            <ArrowRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </>
  );
};

export default GuidedSteps;
