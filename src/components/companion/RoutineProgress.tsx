import { Check, Circle, CircleDashed, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DAY_NAMES,
  DAY_SHORT_NAMES,
  type StreakDetails,
  type WeekDayStatus,
  type WeekSummary,
} from "@/lib/companion";

const STATUS_TEXT: Record<WeekDayStatus, string> = {
  done: "done",
  "not-done": "not done",
  "to-do": "planned, not done yet",
  upcoming: "planned",
  "not-planned": "not planned",
};

// Shape and icon carry the meaning as well as colour, so the strip reads the
// same in high contrast and for anyone who cannot tell the colours apart.
const STATUS_STYLE: Record<WeekDayStatus, string> = {
  done: "border-primary bg-primary text-primary-foreground",
  "not-done": "border-border bg-muted text-muted-foreground",
  "to-do": "border-primary text-primary",
  upcoming: "border-dashed border-border text-muted-foreground",
  "not-planned": "border-transparent text-muted-foreground",
};

const StatusIcon = ({ status }: { status: WeekDayStatus }) => {
  const className = "h-4 w-4";
  switch (status) {
    case "done":
      return <Check className={className} aria-hidden="true" />;
    case "not-done":
      return <Minus className={className} aria-hidden="true" />;
    case "to-do":
      return <Circle className={className} aria-hidden="true" />;
    case "upcoming":
      return <CircleDashed className={className} aria-hidden="true" />;
    default:
      return <span className="h-4 w-4" aria-hidden="true" />;
  }
};

export const StreakText = ({ streak }: { streak: StreakDetails }) => {
  // No run is simply not mentioned: a zero on screen reads as a telling-off.
  if (streak.count === 0) return null;
  const days = streak.count === 1 ? "planned day" : "planned days";
  return (
    <p className="text-base text-foreground">
      Done {streak.atLeast ? "at least " : ""}
      <strong>{streak.count}</strong> {days} in a row.
    </p>
  );
};

const dayCount = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

function describeWeek(week: WeekSummary): string {
  const extra =
    week.extra > 0 ? ` Also done on ${dayCount(week.extra)} it was not planned for.` : "";
  if (week.planned === 0) return `Nothing planned this week.${extra}`;
  return `This week: done on ${week.done} of ${week.planned} planned ${
    week.planned === 1 ? "day" : "days"
  }.${extra}`;
}

interface RoutineProgressProps {
  streak: StreakDetails;
  week: WeekSummary;
}

/** Streak plus the current week, day by day. */
const RoutineProgress = ({ streak, week }: RoutineProgressProps) => (
  <div className="space-y-2">
    <StreakText streak={streak} />
    <p className="text-base text-foreground">{describeWeek(week)}</p>
    <ol className="flex flex-wrap gap-1" aria-label="This week, day by day">
      {week.days.map((day) => (
        <li
          key={day.date}
          className={cn(
            "flex w-11 flex-col items-center gap-1 rounded-md border py-1 text-sm",
            STATUS_STYLE[day.status],
            day.isToday && "ring-2 ring-ring ring-offset-1 ring-offset-background",
          )}
        >
          <span aria-hidden="true">{DAY_SHORT_NAMES[day.weekday]}</span>
          <StatusIcon status={day.status} />
          <span className="sr-only">
            {DAY_NAMES[day.weekday]}
            {day.isToday ? " (today)" : ""}: {STATUS_TEXT[day.status]}
          </span>
        </li>
      ))}
    </ol>
  </div>
);

export default RoutineProgress;
