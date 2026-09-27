import { CheckCircle2, Clock, Loader2, Play, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatClockTime, type Routine, type StreakDetails } from "@/lib/companion";
import { StreakText } from "./RoutineProgress";
import { startButtonId } from "./ids";

interface TodayRoutineCardProps {
  routine: Routine;
  done: boolean;
  /** A mark-done or undo for this routine is on its way to the server. */
  pending: boolean;
  streak: StreakDetails;
  onStart: (routine: Routine) => void;
  onToggleDone: (routine: Routine) => void;
}

const TodayRoutineCard = ({
  routine,
  done,
  pending,
  streak,
  onStart,
  onToggleDone,
}: TodayRoutineCardProps) => {
  const titleId = `today-${routine.id}-title`;
  const stepCount = routine.steps.filter((s) => s.trim()).length;

  return (
    <li>
      <article
        aria-labelledby={titleId}
        className={cn(
          "rounded-xl border bg-card p-5 shadow-sm",
          done ? "border-primary/60" : "border-border",
        )}
      >
        <h3
          id={titleId}
          className="font-heading text-xl font-semibold text-foreground [overflow-wrap:anywhere]"
        >
          {routine.title}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-base text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium text-foreground">{formatClockTime(routine.remind_at)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {stepCount === 0 ? "No steps" : `${stepCount} ${stepCount === 1 ? "step" : "steps"}`}
          </span>
        </p>
        {routine.notes && (
          <p className="mt-3 whitespace-pre-line text-base text-foreground [overflow-wrap:anywhere]">
            {routine.notes}
          </p>
        )}

        <div className="mt-3 space-y-1">
          {done && (
            <p className="flex items-center gap-2 text-base font-semibold text-primary">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              Done today
            </p>
          )}
          <StreakText streak={streak} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {stepCount > 0 && (
            <Button
              id={startButtonId(routine.id)}
              type="button"
              className="min-h-12 px-5 text-base"
              variant={done ? "outline" : "default"}
              onClick={() => onStart(routine)}
            >
              <Play aria-hidden="true" />
              Start<span className="sr-only"> {routine.title}, step by step</span>
            </Button>
          )}
          {/* One button whose label flips, so focus stays put after the change.
              aria-disabled rather than disabled while saving: a disabled button
              drops keyboard focus to the top of the page. */}
          <Button
            type="button"
            variant={done ? "ghost" : stepCount > 0 ? "outline" : "default"}
            className="min-h-12 px-5 text-base"
            onClick={() => onToggleDone(routine)}
            aria-disabled={pending || undefined}
          >
            {pending ? (
              <>
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Saving…
              </>
            ) : done ? (
              <>
                <Undo2 aria-hidden="true" />
                Undo<span className="sr-only">: mark {routine.title} as not done today</span>
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden="true" />
                Mark done<span className="sr-only">: {routine.title}</span>
              </>
            )}
          </Button>
        </div>
      </article>
    </li>
  );
};

export default TodayRoutineCard;
