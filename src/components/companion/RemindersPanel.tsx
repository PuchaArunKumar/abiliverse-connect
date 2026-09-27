import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  buildIcs,
  calendarRoutineCount,
  describeWhen,
  type Routine,
  type UpcomingReminder,
} from "@/lib/companion";
import { useRoutineReminders } from "./useRoutineReminders";

const STORAGE_KEY = "abilitiverse.companion.reminders";
const ICS_FILE_NAME = "abilitiverse-routines.ics";

type Permission = NotificationPermission | "unsupported";

// Browser storage can be blocked or throw (private windows, strict settings).
// The preference is a convenience, so failing to remember it is harmless.
function readStoredPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function storePreference(on: boolean) {
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "on");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not remembered next visit; reminders still work for this one.
  }
}

function currentPermission(): Permission {
  return typeof window !== "undefined" && "Notification" in window
    ? window.Notification.permission
    : "unsupported";
}

function statusFor(permission: Permission): string {
  switch (permission) {
    case "granted":
      return "Reminders are on. While this page is open, a notification will appear at each routine's time.";
    case "denied":
      return "Reminders are on, but notifications are blocked for this site in your browser settings. Reminders will appear on this page instead, while it is open.";
    case "unsupported":
      return "Reminders are on. This browser cannot show notifications, so reminders will appear on this page instead, while it is open.";
    default:
      return "Reminders are on, and will appear on this page while it is open. To get them as notifications too, choose Allow notifications.";
  }
}

interface RemindersPanelProps {
  routines: readonly Routine[];
  /** Completion keys; a routine already done today is not reminded. */
  done: ReadonlySet<string>;
}

const RemindersPanel = ({ routines, done }: RemindersPanelProps) => {
  const [enabled, setEnabled] = useState(readStoredPreference);
  const [permission, setPermission] = useState<Permission>(currentPermission);
  const [asking, setAsking] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState("");
  const pendingUrlRef = useRef<string | null>(null);

  const timed = calendarRoutineCount(routines);

  const onDue = useCallback((due: UpcomingReminder<Routine>) => {
    const names = due.routines.map((r) => r.title);
    const title =
      names.length === 1 ? `Time for “${names[0]}”` : `Time for ${names.length} routines`;
    const first = due.routines[0];
    const stepCount = first.steps.filter((s) => s.trim()).length;
    const body =
      names.length > 1
        ? names.join(", ")
        : stepCount > 0
          ? `${stepCount} ${stepCount === 1 ? "step" : "steps"}. Open Companion to go through them one at a time.`
          : "Open Companion to mark it done.";

    // The toast stays until dismissed: a reminder that vanishes after a few
    // seconds is easy to miss, especially for the people this is built for.
    toast(title, {
      description: body,
      duration: Infinity,
      action: { label: "OK", onClick: () => {} },
    });

    if (currentPermission() === "granted") {
      try {
        const notification = new window.Notification(title, {
          body,
          tag: `companion-${first.id}-${due.at.getTime()}`,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch {
        // Some mobile browsers allow notifications only from a service
        // worker; the toast above has already shown the reminder.
      }
    }
  }, []);

  const next = useRoutineReminders({ enabled, routines, done, onDue });

  useEffect(
    () => () => {
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    },
    [],
  );

  // Browsers only show the permission prompt in response to a click, so this
  // runs from a button: Turn on reminders, or Allow notifications later.
  const askPermission = async (): Promise<Permission> => {
    let result = currentPermission();
    if (result === "default") {
      setAsking(true);
      try {
        // Older Safari returns undefined and only calls back; re-read after.
        result = (await window.Notification.requestPermission()) ?? currentPermission();
      } catch {
        result = currentPermission();
      }
      setAsking(false);
    }
    setPermission(result);
    return result;
  };

  const turnOn = async () => {
    if (asking) return;
    await askPermission();
    setEnabled(true);
    storePreference(true);
  };

  const allowNotifications = async () => {
    if (asking) return;
    await askPermission();
  };

  const turnOff = () => {
    setEnabled(false);
    storePreference(false);
  };

  const downloadCalendar = () => {
    if (timed === 0) {
      setCalendarMessage(
        "None of your active routines has a time yet. Give a routine a time with Edit, then download the calendar file.",
      );
      return;
    }
    const ics = buildIcs(routines, { now: new Date() });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    // Kept until the next download or leaving the page: revoking straight
    // after click() cancels the download in some browsers.
    pendingUrlRef.current = url;
    const link = document.createElement("a");
    link.href = url;
    link.download = ICS_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setCalendarMessage(
      `Downloaded ${ICS_FILE_NAME} with ${timed} ${timed === 1 ? "routine" : "routines"}. Open the file to add ${timed === 1 ? "it" : "them"} to your calendar app.`,
    );
  };

  const status = enabled
    ? statusFor(permission)
    : "Reminders on this page are off.";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading text-xl font-semibold text-foreground">
          Reminders while this page is open
        </h3>
        <p className="mt-2 text-base text-muted-foreground">
          Companion can remind you at each routine's time, but only while this page is open
          in your browser. Websites cannot wake themselves up once they are closed.
        </p>
        <p role="status" className="mt-3 text-base font-medium text-foreground">
          {status}
        </p>
        {next && (
          <p className="mt-1 text-base text-foreground">
            Next reminder:{" "}
            <span className="[overflow-wrap:anywhere]">
              {next.routines.map((r) => r.title).join(", ")}
            </span>
            , {describeWhen(next.at, new Date())}.
          </p>
        )}
        {enabled && timed === 0 && (
          <p className="mt-1 text-base text-muted-foreground">
            None of your active routines has a time yet, so there is nothing to remind you
            about.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          {enabled ? (
            <>
              {permission === "default" && (
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={allowNotifications}
                  aria-disabled={asking || undefined}
                >
                  <Bell aria-hidden="true" />
                  Allow notifications
                </Button>
              )}
              <Button type="button" variant="outline" className="min-h-11" onClick={turnOff}>
                <BellOff aria-hidden="true" />
                Turn off reminders
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="min-h-11"
              onClick={turnOn}
              aria-disabled={asking || undefined}
            >
              <Bell aria-hidden="true" />
              Turn on reminders
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading text-xl font-semibold text-foreground">
          Reminders from your calendar
        </h3>
        <p className="mt-2 text-base text-muted-foreground">
          For reminders you can count on, even when this site is closed, add your routines to
          the calendar on your phone or computer. This downloads a calendar file with a
          repeating event and alert for each active routine that has a time. Open it with
          your calendar app, such as Google Calendar, Apple Calendar or Outlook.
        </p>
        <p className="mt-2 text-base text-muted-foreground">
          If you change your routines later, download the file again. Some calendar apps
          update the events; others add a second copy, which you can delete.
        </p>
        <div className="mt-4">
          <Button type="button" variant="outline" className="min-h-11" onClick={downloadCalendar}>
            <CalendarPlus aria-hidden="true" />
            Add to my calendar
          </Button>
        </div>
        {/* Always rendered, so the first message is announced too. */}
        <p role="status" className="mt-3 text-base text-foreground">
          {calendarMessage}
        </p>
      </div>
    </div>
  );
};

export default RemindersPanel;
