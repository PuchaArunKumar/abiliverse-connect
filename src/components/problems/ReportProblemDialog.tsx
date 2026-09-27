import { useEffect, useRef, useState, type FormEvent } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  REPORT_REASON_MAX,
  friendlyWriteError,
  validateReportReason,
} from "@/lib/problems";

interface ReportProblemDialogProps {
  problemId: string;
  userId: string;
  /** This person has reported the problem before (their own reports are readable). */
  alreadyReported: boolean;
  onReported: () => void;
}

/** Flags a problem for moderators. One report per person per problem. */
const ReportProblemDialog = ({
  problemId,
  userId,
  alreadyReported,
  onReported,
}: ReportProblemDialogProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const reportedHere = useRef(false);

  // Sending replaces the Report button (the dialog's return target) with this
  // notice, so focus goes to the notice instead of falling to the page body.
  useEffect(() => {
    if (alreadyReported && reportedHere.current) noticeRef.current?.focus();
  }, [alreadyReported]);

  if (alreadyReported) {
    return (
      <p
        ref={noticeRef}
        tabIndex={-1}
        className="flex min-h-11 items-center gap-1 text-sm text-muted-foreground focus:outline-none"
      >
        <Flag className="h-4 w-4" aria-hidden="true" />
        You have reported this problem. A moderator will review it.
      </p>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sendingRef.current) return;
    const problem = validateReportReason(reason);
    if (problem) {
      setError(problem);
      fieldRef.current?.focus();
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setError(null);
    const { error: insertError } = await supabase
      .from("problem_reports")
      .insert({ problem_id: problemId, user_id: userId, reason: reason.trim() });
    sendingRef.current = false;
    setSending(false);

    if (insertError?.code === "23505") {
      toast.info("You have already reported this problem.");
      reportedHere.current = true;
      setOpen(false);
      onReported();
      return;
    }
    if (insertError) {
      setError(friendlyWriteError(insertError, "Your report could not be sent. Please try again."));
      return;
    }
    toast.success("Thank you. A moderator will review this problem.");
    reportedHere.current = true;
    setOpen(false);
    setReason("");
    onReported();
  };

  const errorId = "report-reason-error";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (sendingRef.current) return;
        if (!next) setError(null);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" className="min-h-11">
          <Flag className="mr-1 h-4 w-4" aria-hidden="true" />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] motion-reduce:animate-none sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Report this problem</DialogTitle>
            <DialogDescription>
              Tell moderators what is wrong, for example spam, personal details
              or disrespectful language. The author is not told who reported it.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Label htmlFor="report-reason">Reason (required)</Label>
            <Textarea
              ref={fieldRef}
              id="report-reason"
              className="mt-1"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={REPORT_REASON_MAX}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            {/* Always mounted, so a message is announced when it appears. */}
            <div role="alert">
              {error && (
                <p id={errorId} className="mt-1 text-sm font-medium text-destructive">
                  {error}
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              aria-disabled={sending}
              onClick={() => {
                if (!sendingRef.current) setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" aria-disabled={sending}>
              {sending ? (
                <>
                  <Loader2
                    className="mr-1 h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Sending...
                </>
              ) : (
                "Send report"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportProblemDialog;
