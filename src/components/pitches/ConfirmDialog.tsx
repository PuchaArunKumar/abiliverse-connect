import { useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  /** The button that opens the dialog. */
  trigger: ReactElement;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  /**
   * Performs the action. Resolve to a sentence explaining a failure, which is
   * shown and announced inside the dialog, or to null on success.
   */
  onConfirm: () => Promise<string | null>;
  /**
   * Runs once the dialog has fully closed after a success. Remove the deleted
   * item and move focus here: the trigger usually disappears with the item, and
   * focus left on a removed element drops a keyboard user back at the top of
   * the page.
   */
  onDone: () => void;
}

/**
 * Confirmation for a destructive action. The dialog stays open while the
 * request runs, so a failure is reported where the person is looking rather
 * than in a toast they may miss.
 */
const ConfirmDialog = ({
  trigger,
  title,
  description,
  confirmLabel,
  busyLabel,
  onConfirm,
  onDone,
}: ConfirmDialogProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const succeededRef = useRef(false);

  const confirm = async (event: MouseEvent<HTMLButtonElement>) => {
    // Radix closes the dialog on Action by default; keep it open until the
    // request settles.
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    let failure: string | null;
    try {
      failure = await onConfirm();
    } catch {
      failure = "Something went wrong. Please try again.";
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (failure) {
      setError(failure);
      return;
    }
    succeededRef.current = true;
    setOpen(false);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busyRef.current) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent
        className="max-w-[calc(100vw-2rem)] motion-reduce:animate-none sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          if (!succeededRef.current) return;
          event.preventDefault();
          succeededRef.current = false;
          onDone();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="[overflow-wrap:anywhere]">{title}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* Always mounted, so the message is announced when it appears. */}
        <div role="alert">
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <AlertDialogFooter>
          {/* aria-disabled rather than disabled: disabling the focused button
              would drop keyboard focus out of the dialog. */}
          <AlertDialogCancel className="min-h-11" aria-disabled={busy}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "destructive" }), "min-h-11")}
            onClick={confirm}
            aria-disabled={busy}
          >
            {busy ? (
              <>
                <Loader2
                  className="mr-1 h-4 w-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                {busyLabel}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmDialog;
