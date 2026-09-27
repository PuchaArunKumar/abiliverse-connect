import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/layout/Layout";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ExampleRoutines from "@/components/companion/ExampleRoutines";
import GuidedSteps from "@/components/companion/GuidedSteps";
import RemindersPanel from "@/components/companion/RemindersPanel";
import RoutineForm from "@/components/companion/RoutineForm";
import RoutineListItem from "@/components/companion/RoutineListItem";
import TodayRoutineCard from "@/components/companion/TodayRoutineCard";
import { describeCompanionError } from "@/components/companion/errors";
import {
  ADD_ROUTINE_BUTTON_ID,
  GET_STARTED_HEADING_ID,
  MAKE_OWN_BUTTON_ID,
  MY_ROUTINES_HEADING_ID,
  deleteButtonId,
  editButtonId,
  startButtonId,
} from "@/components/companion/ids";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { supabase } from "@/integrations/supabase/client";
import { isMissingSchemaError } from "@/lib/supabase-errors";
import {
  COMPLETION_WINDOW_DAYS,
  ROUTINE_COLUMNS,
  addLocalDays,
  compareByTime,
  completionKey,
  groupCompletions,
  localDateString,
  messageForDate,
  msUntilNextLocalDay,
  routinesForDay,
  streakDetails,
  weekSummary,
  type ExampleRoutine,
  type Routine,
  type RoutineValues,
} from "@/lib/companion";

type LoadState = "loading" | "ready" | "missing" | "error";

interface Completion {
  routine_id: string;
  completed_on: string;
}

/** Where focus goes (element ids), and what is announced, once a dialog has closed. */
interface AfterClose {
  focus: string | null;
  /** Used when `focus` is no longer on the page. */
  fallback?: string;
  announce?: string;
}

const NO_DATES: ReadonlySet<string> = new Set();

const headingClass = "font-heading text-2xl font-bold text-foreground outline-none";

const Companion = () => {
  useDocumentTitle("Companion");
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [load, setLoad] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [historyStart, setHistoryStart] = useState<Date | null>(null);
  const [today, setToday] = useState(() => new Date());
  const [announcement, setAnnouncement] = useState({ id: 0, text: "" });

  // Routine ids with a mark-done or undo on its way. The ref is the guard (it
  // updates synchronously, so a double click cannot slip through); the state
  // only drives the "Saving…" label.
  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [guided, setGuided] = useState<Routine | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletingRef = useRef(false);
  const [addingExample, setAddingExample] = useState<string | null>(null);
  const addingRef = useRef(false);

  const h1Ref = useRef<HTMLHeadingElement>(null);
  const afterCloseRef = useRef<AfterClose>({ focus: null });
  const focusRequestRef = useRef<string | null>(null);

  const announce = useCallback((text: string) => {
    setAnnouncement((a) => ({ id: a.id + 1, text }));
  }, []);

  // --- Loading --------------------------------------------------------------

  useEffect(() => {
    if (!userId) return;
    // A per-run flag, so a slow response for an earlier user or an earlier
    // "Try again" can never overwrite a newer one.
    let cancelled = false;
    setLoad("loading");
    const start = addLocalDays(new Date(), -COMPLETION_WINDOW_DAYS);

    void (async () => {
      const [routinesResult, completionsResult] = await Promise.all([
        supabase
          .from("companion_routines")
          .select(ROUTINE_COLUMNS)
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        supabase
          .from("companion_completions")
          .select("routine_id, completed_on")
          .eq("user_id", userId)
          .gte("completed_on", localDateString(start)),
      ]);
      if (cancelled) return;
      const error = routinesResult.error ?? completionsResult.error;
      if (error) {
        if (isMissingSchemaError(error)) {
          setLoad("missing");
        } else {
          setLoadError(describeCompanionError(error, "load your routines"));
          setLoad("error");
        }
        return;
      }
      setRoutines(routinesResult.data ?? []);
      setCompletions(completionsResult.data ?? []);
      setHistoryStart(start);
      setLoad("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  // "Today" has to follow the person's own clock past midnight, and after a
  // laptop wakes up, when a timer set yesterday may not have fired yet.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const now = new Date();
      setToday((prev) => (localDateString(prev) === localDateString(now) ? prev : now));
    };
    // Aimed just past midnight, but never more than an hour out, so a clock
    // change or a timer that fired early is corrected soon after.
    const schedule = () => {
      const wait = Math.min(msUntilNextLocalDay(new Date()) + 1000, 3_600_000);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, wait);
    };
    schedule();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Moves focus to an element that only exists once the list has re-rendered,
  // such as the Edit button of a routine that was just added.
  useEffect(() => {
    const id = focusRequestRef.current;
    if (!id) return;
    const element = document.getElementById(id);
    if (element) {
      focusRequestRef.current = null;
      element.focus();
    }
  }, [routines]);

  // --- Derived --------------------------------------------------------------

  const todayKey = localDateString(today);
  const doneKeys = useMemo(
    () => new Set(completions.map((c) => completionKey(c.routine_id, c.completed_on))),
    [completions],
  );
  const datesByRoutine = useMemo(() => groupCompletions(completions), [completions]);
  const todays = useMemo(() => routinesForDay(routines, today), [routines, today]);
  const sortedRoutines = useMemo(() => [...routines].sort(compareByTime), [routines]);
  const todaysDone = todays.filter((r) => doneKeys.has(completionKey(r.id, todayKey))).length;

  const streakFor = (routine: Routine) =>
    streakDetails(routine, datesByRoutine.get(routine.id) ?? NO_DATES, today, historyStart);

  // --- Dialog focus ---------------------------------------------------------

  const rememberOpener = (openerId: string) => {
    afterCloseRef.current = { focus: openerId };
  };

  // Radix hands focus back only to a DialogTrigger, and these dialogs are
  // opened from buttons that may since have moved or gone, so the page decides.
  const restoreFocus = useCallback(
    (event: Event) => {
      event.preventDefault();
      const { focus, fallback, announce: text } = afterCloseRef.current;
      afterCloseRef.current = { focus: null };
      const byId = (id: string | null | undefined) => (id ? document.getElementById(id) : null);
      (byId(focus) ?? byId(fallback) ?? h1Ref.current)?.focus();
      if (text) announce(text);
    },
    [announce],
  );

  // --- Completions ----------------------------------------------------------

  const setCompletion = async (
    routine: Routine,
    date: string,
    makeDone: boolean,
  ): Promise<string | null> => {
    if (!userId) return "Your sign-in has ended. Sign in again, then try once more.";
    if (pendingRef.current.has(routine.id)) {
      return "Still saving the last change. Try again in a moment.";
    }
    pendingRef.current.add(routine.id);
    setPending(new Set(pendingRef.current));

    const { error } = makeDone
      ? await supabase
          .from("companion_completions")
          .insert({ routine_id: routine.id, user_id: userId, completed_on: date })
      : await supabase
          .from("companion_completions")
          .delete()
          .eq("routine_id", routine.id)
          .eq("completed_on", date);

    pendingRef.current.delete(routine.id);
    setPending(new Set(pendingRef.current));

    // 23505: it was already recorded, from another tab or device. That is
    // the state asked for, so it counts as success.
    if (error && !(makeDone && error.code === "23505")) {
      if (isMissingSchemaError(error)) setLoad("missing");
      return describeCompanionError(
        error,
        makeDone ? "mark it as done" : "undo it",
      );
    }
    // Applied to the latest list, not a snapshot taken before the request.
    setCompletions((prev) => {
      const others = prev.filter(
        (c) => !(c.routine_id === routine.id && c.completed_on === date),
      );
      return makeDone ? [...others, { routine_id: routine.id, completed_on: date }] : others;
    });
    return null;
  };

  const toggleDone = async (routine: Routine) => {
    if (pendingRef.current.has(routine.id)) return;
    const date = todayKey;
    const makeDone = !doneKeys.has(completionKey(routine.id, date));
    const error = await setCompletion(routine, date, makeDone);
    if (error) {
      toast.error(error);
      return;
    }
    announce(
      makeDone
        ? `“${routine.title}” is marked as done for today.`
        : `“${routine.title}” is no longer marked as done today.`,
    );
  };

  // --- Guided mode ----------------------------------------------------------

  const startGuided = (routine: Routine) => {
    rememberOpener(startButtonId(routine.id));
    setGuided(routine);
    setGuidedOpen(true);
  };

  const finishGuided = async (): Promise<string | null> =>
    guided ? setCompletion(guided, todayKey, true) : null;

  // --- Create and edit ------------------------------------------------------

  const openCreate = () => {
    rememberOpener(routines.length === 0 ? MAKE_OWN_BUTTON_ID : ADD_ROUTINE_BUTTON_ID);
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (routine: Routine) => {
    rememberOpener(editButtonId(routine.id));
    setEditing(routine);
    setFormOpen(true);
  };

  const saveRoutine = async (values: RoutineValues): Promise<string | null> => {
    if (!userId) return "Your sign-in has ended. Sign in again, then save.";
    const existing = editing;

    const result = existing
      ? await supabase
          .from("companion_routines")
          .update(values)
          .eq("id", existing.id)
          .select(ROUTINE_COLUMNS)
          .single()
      : await supabase
          .from("companion_routines")
          .insert({ ...values, user_id: userId })
          .select(ROUTINE_COLUMNS)
          .single();

    if (result.error || !result.data) {
      if (isMissingSchemaError(result.error)) {
        setFormOpen(false);
        setLoad("missing");
        return null;
      }
      return describeCompanionError(result.error, "save the routine");
    }

    const saved = result.data;
    setRoutines((prev) =>
      existing ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved],
    );
    afterCloseRef.current = existing
      ? { focus: editButtonId(saved.id), announce: `Saved your changes to “${saved.title}”.` }
      : {
          // Back to "Add a routine"; when the first routine was created from
          // the empty state, that button has gone, so its Edit button instead.
          focus: afterCloseRef.current.focus,
          fallback: editButtonId(saved.id),
          announce: `Added “${saved.title}”.`,
        };
    setFormOpen(false);
    return null;
  };

  const addExample = async (example: ExampleRoutine) => {
    if (!userId || addingRef.current) return;
    addingRef.current = true;
    setAddingExample(example.key);
    const { key: _key, ...values } = example;
    const { data, error } = await supabase
      .from("companion_routines")
      .insert({ ...values, user_id: userId })
      .select(ROUTINE_COLUMNS)
      .single();
    addingRef.current = false;
    setAddingExample(null);

    if (error || !data) {
      if (isMissingSchemaError(error)) setLoad("missing");
      else toast.error(describeCompanionError(error, "add the routine"));
      return;
    }
    // The example card that had focus is gone with the empty state.
    focusRequestRef.current = editButtonId(data.id);
    setRoutines((prev) => [...prev, data]);
    announce(`Added “${data.title}”. You can change it with Edit under My routines.`);
  };

  // --- Delete ---------------------------------------------------------------

  const askDelete = (routine: Routine) => {
    rememberOpener(deleteButtonId(routine.id));
    setDeleteTarget(routine);
    setDeleteError(null);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    const routine = deleteTarget;
    if (!routine || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.from("companion_routines").delete().eq("id", routine.id);
    deletingRef.current = false;
    setDeleting(false);

    if (error) {
      if (isMissingSchemaError(error)) {
        setDeleteOpen(false);
        setLoad("missing");
        return;
      }
      setDeleteError(describeCompanionError(error, "delete the routine"));
      return;
    }

    setRoutines((prev) => prev.filter((r) => r.id !== routine.id));
    setCompletions((prev) => prev.filter((c) => c.routine_id !== routine.id));
    // The button that opened this dialog went with the routine.
    const othersLeft = routines.some((r) => r.id !== routine.id);
    afterCloseRef.current = {
      focus: othersLeft ? MY_ROUTINES_HEADING_ID : GET_STARTED_HEADING_ID,
      announce: `Deleted “${routine.title}”.`,
    };
    setDeleteOpen(false);
  };

  // --- Render ---------------------------------------------------------------

  const motivation = messageForDate(today);
  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const renderBody = () => {
    if (authLoading || (userId && load === "loading")) {
      return (
        <p role="status" className="flex items-center gap-2 py-8 text-lg text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Loading your routines…
        </p>
      );
    }
    if (load === "missing") {
      return (
        <div className="py-8">
          <FeatureUnavailable feature="Companion" headingLevel="h2" />
        </div>
      );
    }
    if (load === "error" || !userId) {
      return (
        <div role="alert" className="rounded-xl border border-destructive/50 p-5">
          <p className="text-lg text-foreground">
            {userId ? (
              loadError
            ) : (
              <>
                <Link
                  to="/login?next=/companion"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  Sign in
                </Link>{" "}
                to see your routines.
              </>
            )}
          </p>
          {userId && (
            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11"
              onClick={() => setReloadToken((t) => t + 1)}
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          )}
        </div>
      );
    }

    if (routines.length === 0) {
      return (
        <section aria-labelledby={GET_STARTED_HEADING_ID} className="mt-10">
          <h2 id={GET_STARTED_HEADING_ID} tabIndex={-1} className={headingClass}>
            Get started
          </h2>
          <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
            A routine is something you do regularly, broken into small steps. Add one of these
            examples and change it to suit you, or make your own from scratch.
          </p>
          <div className="mt-6">
            <ExampleRoutines adding={addingExample} onAdd={addExample} />
          </div>
          <Button
            id={MAKE_OWN_BUTTON_ID}
            type="button"
            className="mt-6 min-h-12 px-5 text-base"
            onClick={openCreate}
          >
            <Plus aria-hidden="true" />
            Make my own routine
          </Button>
        </section>
      );
    }

    return (
      <>
        <section aria-labelledby="companion-today" className="mt-10">
          <h2 id="companion-today" className={headingClass}>
            Today
          </h2>
          <p className="mt-1 text-lg text-muted-foreground">{todayLabel}</p>
          {todays.length === 0 ? (
            <p className="mt-4 max-w-2xl text-lg text-foreground">
              Nothing is planned for today. Your other routines are listed under My routines.
            </p>
          ) : (
            <>
              <p className="mt-2 text-lg text-foreground">
                {todaysDone === todays.length
                  ? `All ${todays.length === 1 ? "of today's routines" : `${todays.length} of today's routines`} done.`
                  : `${todaysDone} of ${todays.length} done so far.`}
              </p>
              <ul className="mt-4 grid gap-4 lg:grid-cols-2" role="list">
                {todays.map((routine) => (
                  <TodayRoutineCard
                    key={routine.id}
                    routine={routine}
                    done={doneKeys.has(completionKey(routine.id, todayKey))}
                    pending={pending.has(routine.id)}
                    streak={streakFor(routine)}
                    onStart={startGuided}
                    onToggleDone={toggleDone}
                  />
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-labelledby="companion-reminders" className="mt-12">
          <h2 id="companion-reminders" className={headingClass}>
            Reminders
          </h2>
          <div className="mt-4">
            <RemindersPanel routines={routines} done={doneKeys} />
          </div>
        </section>

        <section aria-labelledby={MY_ROUTINES_HEADING_ID} className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={MY_ROUTINES_HEADING_ID} tabIndex={-1} className={headingClass}>
              My routines
            </h2>
            <Button
              id={ADD_ROUTINE_BUTTON_ID}
              type="button"
              className="min-h-11"
              onClick={openCreate}
            >
              <Plus aria-hidden="true" />
              Add a routine
            </Button>
          </div>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">
            In each week view, a tick means done, a dash means a planned day that was not done,
            and a circle means planned for today or later.
          </p>
          <ul className="mt-4 grid gap-4 lg:grid-cols-2" role="list">
            {sortedRoutines.map((routine) => (
              <RoutineListItem
                key={routine.id}
                routine={routine}
                streak={streakFor(routine)}
                week={weekSummary(routine, datesByRoutine.get(routine.id) ?? NO_DATES, today, {
                  since: new Date(routine.created_at),
                })}
                onEdit={openEdit}
                onDelete={askDelete}
              />
            ))}
          </ul>
        </section>
      </>
    );
  };

  return (
    <Layout>
      <section className="container max-w-5xl py-8 md:py-12">
        <h1
          ref={h1Ref}
          tabIndex={-1}
          className="font-heading text-3xl font-bold text-foreground outline-none md:text-4xl"
        >
          Companion
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Plan your daily routines as small, clear steps, go through them one step at a time,
          and keep track of what you have done. Useful for anyone who finds structure helps,
          and for the people who support them.
        </p>

        <div className="mt-6 max-w-2xl rounded-xl bg-secondary p-5 text-secondary-foreground">
          <p className="text-sm font-semibold uppercase tracking-wide">A thought for today</p>
          <p className="mt-1 text-xl">{motivation}</p>
        </div>

        {renderBody()}

        {/* Announces what just happened, e.g. "marked as done", without moving
            focus. Keyed content so the same message twice is still read. */}
        <div role="status" aria-live="polite" className="sr-only">
          <span key={announcement.id}>{announcement.text}</span>
        </div>
      </section>

      <RoutineForm
        open={formOpen}
        onOpenChange={setFormOpen}
        routine={editing}
        onSave={saveRoutine}
        onCloseAutoFocus={restoreFocus}
      />

      <GuidedSteps
        open={guidedOpen}
        onOpenChange={setGuidedOpen}
        routine={guided}
        doneToday={guided ? doneKeys.has(completionKey(guided.id, todayKey)) : false}
        onFinish={finishGuided}
        onCloseAutoFocus={restoreFocus}
        encouragement={motivation}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteOpen(open);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={restoreFocus}
          className="w-[calc(100%-2rem)] rounded-lg"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl [overflow-wrap:anywhere]">
              Delete “{deleteTarget?.title}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              This removes the routine and the record of the days it was done. It cannot be
              undone. To take a break from it instead, edit it and turn off Active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm font-medium text-destructive"
            >
              {deleteError}
            </p>
          )}
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="min-h-11" disabled={deleting}>
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                // Stay open until the delete has finished, so a failure can be
                // shown here rather than after the dialog has gone.
                e.preventDefault();
                void confirmDelete();
              }}
              aria-disabled={deleting || undefined}
            >
              {deleting ? (
                <>
                  <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Deleting…
                </>
              ) : (
                "Delete routine"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Companion;
