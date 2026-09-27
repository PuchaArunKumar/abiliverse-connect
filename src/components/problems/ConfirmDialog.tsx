import { useRef, useState, type ReactNode } from "react";
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
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  cancelLabel?: string;
  /** Runs the action. Resolve null to close, or a sentence to show in the dialog. */
  onConfirm: () => Promise<string | null>;
  /**
   * Called once the dialog has closed, with whether the action went through.
   * The caller moves focus: back to the button that opened the dialog after a
   * cancel, somewhere that still exists after a delete.
   */
  onClosed: (confirmed: boolean) => void;
}

/**
 * Confirmation for destructive actions (WCAG 3.3.4). Stays open while the
 * action runs, so a failure is reported where the person is looking rather
 * than after the dialog has gone.
 */
const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busyLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onClosed,
}: ConfirmDialogProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const confirmedRef = useRef(false);

  const confirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const problem = await onConfirm();
      if (problem) {
        setError(problem);
      } else {
        confirmedRef.current = true;
        onOpenChange(false);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busyRef.current) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        className="max-w-[calc(100vw-2rem)] motion-reduce:animate-none sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const confirmed = confirmedRef.current;
          confirmedRef.current = false;
          onClosed(confirmed);
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="break-words [overflow-wrap:anywhere]">
            {description}
          </AlertDialogDescription>
          {/* Always mounted, so the message is announced when it appears. */}
          <div role="alert">
            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11" aria-disabled={busy}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "destructive" }), "min-h-11")}
            aria-disabled={busy}
            onClick={(event) => {
              // Keep the dialog open until the action has finished.
              event.preventDefault();
              void confirm();
            }}
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
