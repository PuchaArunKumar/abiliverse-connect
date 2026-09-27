import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DAY_NAMES,
  DISPLAY_DAY_ORDER,
  EVERY_DAY,
  ROUTINE_FIELDS,
  ROUTINE_LIMITS,
  WEEKDAYS,
  draftFromRoutine,
  emptyDraft,
  normaliseDays,
  parseSteps,
  validateRoutine,
  type Routine,
  type RoutineDraft,
  type RoutineField,
  type RoutineValues,
} from "@/lib/companion";

interface RoutineFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The routine being edited, or null to create a new one. */
  routine: Routine | null;
  /** Saves the values; resolves to an error message, or null on success. */
  onSave: (values: RoutineValues) => Promise<string | null>;
  /** Radix returns focus only to a DialogTrigger; the page decides instead. */
  onCloseAutoFocus: (event: Event) => void;
}

/** Joins the ids that exist, so aria-describedby never points at nothing. */
const ids = (...values: (string | false | null | undefined)[]) =>
  values.filter(Boolean).join(" ") || undefined;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Create or edit a routine. The rules match the table's CHECK constraints, so
 * anything this form accepts the database accepts too, and every problem is
 * explained next to its field before anything is sent.
 */
const RoutineForm = ({ open, onOpenChange, routine, onSave, onCloseAutoFocus }: RoutineFormProps) => {
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-save would hide the result, including any error.
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg sm:max-w-xl"
      >
        <RoutineFormBody
          routine={routine}
          onSave={onSave}
          saving={saving}
          setSaving={setSaving}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

interface RoutineFormBodyProps {
  routine: Routine | null;
  onSave: (values: RoutineValues) => Promise<string | null>;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onCancel: () => void;
}

// Mounted fresh each time the dialog opens (DialogContent renders nothing while
// closed), so the draft always starts from the routine as it is now.
const RoutineFormBody = ({ routine, onSave, saving, setSaving, onCancel }: RoutineFormBodyProps) => {
  const [draft, setDraft] = useState<RoutineDraft>(() =>
    routine ? draftFromRoutine(routine) : emptyDraft(),
  );
  const [errors, setErrors] = useState<Partial<Record<RoutineField, string>>>({});
  const [summary, setSummary] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const stepsRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const firstDayRef = useRef<HTMLButtonElement>(null);

  const isNew = routine === null;
  const stepCount = parseSteps(draft.steps).length;

  const update = <K extends keyof RoutineDraft>(key: K, value: RoutineDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const toggleDay = (day: number, checked: boolean) => {
    setDraft((d) => ({
      ...d,
      days: normaliseDays(checked ? [...d.days, day] : d.days.filter((x) => x !== day)),
    }));
  };

  const focusField = (field: RoutineField) => {
    const target = {
      title: titleRef,
      steps: stepsRef,
      notes: notesRef,
      time: timeRef,
      days: firstDayRef,
    }[field].current;
    target?.focus();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    const result = validateRoutine(draft);
    setErrors(result.errors);
    setServerError(null);

    const invalid = ROUTINE_FIELDS.filter((f) => result.errors[f]);
    if (invalid.length > 0) {
      // Focus lands on the first field to fix, which reads out its own error;
      // the polite summary follows, so nobody wonders whether there are more.
      setSummary(
        invalid.length === 1
          ? "One thing needs changing before this can be saved."
          : `${invalid.length} things need changing before this can be saved.`,
      );
      focusField(invalid[0]);
      return;
    }
    setSummary("");

    savingRef.current = true;
    setSaving(true);
    const error = await onSave(result.values);
    savingRef.current = false;
    setSaving(false);
    if (error) setServerError(error);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl">
          {isNew ? "New routine" : "Edit routine"}
        </DialogTitle>
        <DialogDescription className="text-base">
          Break the routine into small steps. You can change it at any time.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} noValidate className="space-y-6 text-base">
        <div>
          <Label htmlFor="routine-title" className="text-base">
            Name
          </Label>
          <Input
            ref={titleRef}
            id="routine-title"
            className="mt-1 h-11 text-base"
            value={draft.title}
            onChange={(e) => update("title", e.target.value)}
            autoComplete="off"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={ids("routine-title-hint", errors.title && "routine-title-error")}
          />
          <p id="routine-title-hint" className="mt-1 text-sm text-muted-foreground">
            For example, “Morning medication”. Up to {ROUTINE_LIMITS.titleMax} characters.
          </p>
          {errors.title && (
            <p id="routine-title-error" className="mt-1 text-sm font-medium text-destructive">
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="routine-steps" className="text-base">
            Steps
          </Label>
          <Textarea
            ref={stepsRef}
            id="routine-steps"
            className="mt-1 text-base"
            rows={6}
            value={draft.steps}
            onChange={(e) => update("steps", e.target.value)}
            aria-invalid={errors.steps ? true : undefined}
            aria-describedby={ids(
              "routine-steps-hint",
              "routine-steps-count",
              errors.steps && "routine-steps-error",
            )}
          />
          <p id="routine-steps-hint" className="mt-1 text-sm text-muted-foreground">
            Write one step per line, in the order you do them. Short, simple steps are
            easiest to follow. Up to {ROUTINE_LIMITS.stepsMax} steps.
          </p>
          <p id="routine-steps-count" className="mt-1 text-sm text-muted-foreground">
            {stepCount === 0 ? "No steps yet." : `${plural(stepCount, "step", "steps")} so far.`}
          </p>
          {errors.steps && (
            <p id="routine-steps-error" className="mt-1 text-sm font-medium text-destructive">
              {errors.steps}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="routine-notes" className="text-base">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            ref={notesRef}
            id="routine-notes"
            className="mt-1 text-base"
            rows={3}
            value={draft.notes}
            onChange={(e) => update("notes", e.target.value)}
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={ids("routine-notes-hint", errors.notes && "routine-notes-error")}
          />
          <p id="routine-notes-hint" className="mt-1 text-sm text-muted-foreground">
            Anything that helps: where things are kept, who to call, or why this routine
            matters to you. Up to {ROUTINE_LIMITS.notesMax.toLocaleString("en")} characters.
          </p>
          {errors.notes && (
            <p id="routine-notes-error" className="mt-1 text-sm font-medium text-destructive">
              {errors.notes}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="routine-time" className="text-base">
            Time <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Input
              ref={timeRef}
              id="routine-time"
              type="time"
              className="h-11 w-40 text-base"
              value={draft.time}
              onChange={(e) => update("time", e.target.value)}
              aria-invalid={errors.time ? true : undefined}
              aria-describedby={ids("routine-time-hint", errors.time && "routine-time-error")}
            />
            {draft.time && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  update("time", "");
                  timeRef.current?.focus();
                }}
              >
                Clear time
              </Button>
            )}
          </div>
          <p id="routine-time-hint" className="mt-1 text-sm text-muted-foreground">
            Leave empty if it can happen any time of day. Reminders and the calendar file
            only include routines that have a time.
          </p>
          {errors.time && (
            <p id="routine-time-error" className="mt-1 text-sm font-medium text-destructive">
              {errors.time}
            </p>
          )}
        </div>

        <fieldset
          aria-describedby={ids(errors.days && "routine-days-error")}
          aria-invalid={errors.days ? true : undefined}
        >
          <legend className="text-base font-medium text-foreground">Days</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => update("days", [...EVERY_DAY])}
            >
              Every day
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => update("days", [...WEEKDAYS])}
            >
              Weekdays
            </Button>
          </div>
          <div className="mt-3 grid gap-1 sm:grid-cols-2">
            {DISPLAY_DAY_ORDER.map((day, index) => (
              <div key={day} className="flex items-center gap-3 rounded-md px-1">
                <Checkbox
                  ref={index === 0 ? firstDayRef : undefined}
                  id={`routine-day-${day}`}
                  className="h-6 w-6"
                  checked={draft.days.includes(day)}
                  onCheckedChange={(checked) => toggleDay(day, checked === true)}
                />
                <Label
                  htmlFor={`routine-day-${day}`}
                  className="flex min-h-11 flex-1 cursor-pointer items-center text-base font-normal"
                >
                  {DAY_NAMES[day]}
                </Label>
              </div>
            ))}
          </div>
          {errors.days && (
            <p id="routine-days-error" className="mt-1 text-sm font-medium text-destructive">
              {errors.days}
            </p>
          )}
        </fieldset>

        <div>
          <div className="flex items-center gap-3">
            <Switch
              id="routine-active"
              checked={draft.active}
              onCheckedChange={(checked) => update("active", checked)}
              aria-describedby="routine-active-hint"
            />
            <Label
              htmlFor="routine-active"
              className="flex min-h-11 cursor-pointer items-center text-base"
            >
              Active
            </Label>
          </div>
          <p id="routine-active-hint" className="text-sm text-muted-foreground">
            Turn this off to pause the routine. A paused routine stays in your list but is
            left out of Today, reminders and the calendar file.
          </p>
        </div>

        {/* Always rendered: a live region that appears together with its
            message is often not announced. Each field shows its own error. */}
        <p role="status" className="sr-only">
          {summary}
        </p>

        {serverError && (
          <p
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm font-medium text-destructive"
          >
            {serverError}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" className="min-h-11" aria-disabled={saving || undefined}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                Saving…
              </>
            ) : isNew ? (
              "Add routine"
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

export default RoutineForm;
