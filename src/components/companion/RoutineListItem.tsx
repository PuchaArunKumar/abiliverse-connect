import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  describeDays,
  formatClockTime,
  type Routine,
  type StreakDetails,
  type WeekSummary,
} from "@/lib/companion";
import RoutineProgress from "./RoutineProgress";
import { deleteButtonId, editButtonId } from "./ids";

interface RoutineListItemProps {
  routine: Routine;
  streak: StreakDetails;
  week: WeekSummary;
  onEdit: (routine: Routine) => void;
  onDelete: (routine: Routine) => void;
}

const RoutineListItem = ({ routine, streak, week, onEdit, onDelete }: RoutineListItemProps) => {
  const titleId = `routine-${routine.id}-title`;
  const stepCount = routine.steps.filter((s) => s.trim()).length;

  return (
    <li>
      <article aria-labelledby={titleId} className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            id={titleId}
            className="font-heading text-xl font-semibold text-foreground [overflow-wrap:anywhere]"
          >
            {routine.title}
          </h3>
          {!routine.active && <Badge variant="secondary">Paused</Badge>}
        </div>
        <p className="mt-1 text-base text-muted-foreground">
          {describeDays(routine.days)} · {formatClockTime(routine.remind_at)} ·{" "}
          {stepCount === 0 ? "no steps" : `${stepCount} ${stepCount === 1 ? "step" : "steps"}`}
        </p>

        {routine.active && (
          <div className="mt-3">
            <RoutineProgress streak={streak} week={week} />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            id={editButtonId(routine.id)}
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onEdit(routine)}
          >
            <Pencil aria-hidden="true" />
            Edit<span className="sr-only"> {routine.title}</span>
          </Button>
          <Button
            id={deleteButtonId(routine.id)}
            type="button"
            variant="outline"
            className="min-h-11 text-destructive hover:text-destructive"
            onClick={() => onDelete(routine)}
          >
            <Trash2 aria-hidden="true" />
            Delete<span className="sr-only"> {routine.title}</span>
          </Button>
        </div>
      </article>
    </li>
  );
};

export default RoutineListItem;
