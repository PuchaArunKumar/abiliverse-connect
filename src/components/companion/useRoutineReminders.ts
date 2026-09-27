import { useEffect, useRef, useState } from "react";
import { nextReminder, type ReminderRoutine, type UpcomingReminder } from "@/lib/companion";

// Re-check at least this often rather than trusting one long timer: a laptop
// that sleeps, or a clock that changes, would otherwise leave a timer aimed at
// the wrong moment. A check is a few comparisons, so once a minute costs nothing.
const MAX_WAIT_MS = 60_000;

// A reminder more than this late (the device was asleep, the tab frozen) is
// dropped rather than shown out of the blue long after it made sense.
const LATE_LIMIT_MS = 15 * 60_000;

interface Options<T extends ReminderRoutine> {
  enabled: boolean;
  routines: readonly T[];
  /** Completion keys (see completionKey); done occurrences are not reminded. */
  done: ReadonlySet<string>;
  onDue: (due: UpcomingReminder<T>) => void;
}

/**
 * While `enabled` and the page stays open, calls `onDue` when a routine's time
 * comes, and returns the next one coming up.
 *
 * Browsers give a web page no way to wake itself once it is closed, so this
 * is a convenience on top of the calendar file, never a replacement for it.
 */
export function useRoutineReminders<T extends ReminderRoutine>({
  enabled,
  routines,
  done,
  onDue,
}: Options<T>): UpcomingReminder<T> | null {
  const [next, setNext] = useState<UpcomingReminder<T> | null>(null);
  // The moment reminders were last checked, so each one fires exactly once
  // even when a timer runs late or the routines change in between.
  const lastCheckRef = useRef<Date | null>(null);
  const onDueRef = useRef(onDue);

  useEffect(() => {
    onDueRef.current = onDue;
  }, [onDue]);

  useEffect(() => {
    if (!enabled) {
      lastCheckRef.current = null;
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = () => {
      if (cancelled) return;
      const now = new Date();
      let from = lastCheckRef.current ?? now;
      // Everything that came due since the last check, oldest first. The cap
      // only matters after a very long sleep, when most would be too late anyway.
      for (let i = 0; i < 50; i++) {
        const due = nextReminder(routines, from, { done });
        if (!due || due.at.getTime() > now.getTime()) break;
        if (now.getTime() - due.at.getTime() <= LATE_LIMIT_MS) onDueRef.current(due);
        from = due.at;
      }
      lastCheckRef.current = now;

      const upcoming = nextReminder(routines, now, { done });
      setNext(upcoming);
      const wait = upcoming
        ? Math.min(upcoming.at.getTime() - now.getTime(), MAX_WAIT_MS)
        : MAX_WAIT_MS;
      timer = setTimeout(check, Math.max(wait, 250));
    };

    check();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [enabled, routines, done]);

  return enabled ? next : null;
}
