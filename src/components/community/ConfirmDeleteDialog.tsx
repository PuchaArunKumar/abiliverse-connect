import { useEffect, useRef, useState } from "react";
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

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Names the action, e.g. "Delete post" — never a bare "OK". */
  confirmLabel: string;
  busyLabel?: string;
  /** Performs the delete. Resolves to an error message, or null on success. */
  onConfirm: () => Promise<string | null>;
  /**
   * Where focus goes after a successful delete. The button that opened the
   * dialog belonged to the removed item and no longer exists, so returning
   * focus to it would drop keyboard users at the top of the page.
   */
  focusAfterDelete: () => HTMLElement | null;
}

/**
 * Confirmation for removing something permanently (WCAG 3.3.4). Rendered
 * once per page rather than inside each list item, so it survives the item
 * it deletes and can still hand focus somewhere sensible afterwards.
 */
const ConfirmDeleteDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busyLabel = "Deleting…",
  onConfirm,
  focusAfterDelete,
}: ConfirmDeleteDialogProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const deleted = useRef(false);

  useEffect(() => {
    if (open) {
      setError(null);
      deleted.current = false;
    }
  }, [open]);

  const confirm = async (event: React.MouseEvent) => {
    // Keep the dialog open until the delete has actually finished, so a
    // failure can be reported where the person is looking.
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const message = await onConfirm();
    busyRef.current = false;
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    deleted.current = true;
    onOpenChange(false);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-request would hide the outcome of a delete that is
        // still going ahead.
        if (!busyRef.current) onOpenChange(next);
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (!deleted.current) return;
          event.preventDefault();
          focusAfterDelete()?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="[overflow-wrap:anywhere]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div aria-live="assertive">
          {error && (
            <p className="text-sm font-medium text-destructive dark:text-red-300">
              {error}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          {/* aria-disabled rather than disabled: a disabled button drops the
              keyboard focus that is sitting on it. */}
          <AlertDialogCancel
            className="min-h-11"
            aria-disabled={busy || undefined}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            aria-disabled={busy || undefined}
            className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? (
              <>
                <Loader2
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
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

export default ConfirmDeleteDialog;
