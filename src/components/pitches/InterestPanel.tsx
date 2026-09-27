import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/pitches/ConfirmDialog";
import InterestDialog, {
  INTEREST_COLUMNS,
  type InterestOutcome,
} from "@/components/pitches/InterestDialog";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/problems";
import {
  PITCH_NEED_LABELS,
  friendlyPitchError,
  type PitchDetailRow,
  type PitchInterest,
} from "@/lib/pitches";

interface InterestPanelProps {
  pitch: Pick<PitchDetailRow, "id" | "user_id" | "is_open" | "needs">;
  /** The signed-in visitor, or null. Never the founder: they get the inbox. */
  userId: string | null;
}

type OwnState = "loading" | "ready" | "error";

/**
 * A visitor's side of interest requests: send one, see the one you sent, or
 * withdraw it.
 */
const InterestPanel = ({ pitch, userId }: InterestPanelProps) => {
  const [own, setOwn] = useState<PitchInterest | null>(null);
  const [state, setState] = useState<OwnState>(userId ? "loading" : "ready");
  const [announcement, setAnnouncement] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sentRef = useRef<HTMLParagraphElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<"sent" | "trigger" | null>(null);

  const loadOwn = useCallback(async () => {
    if (!userId) return { ok: true as const, row: null };
    const { data, error } = await supabase
      .from("pitch_interests")
      .select(INTEREST_COLUMNS)
      .eq("pitch_id", pitch.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { ok: false as const, row: null };
    return { ok: true as const, row: data };
  }, [pitch.id, userId]);

  useEffect(() => {
    if (!userId) {
      setOwn(null);
      setState("ready");
      return;
    }
    let active = true;
    setState("loading");
    void loadOwn().then((result) => {
      if (!active) return;
      setOwn(result.row);
      setState(result.ok ? "ready" : "error");
    });
    return () => {
      active = false;
    };
  }, [loadOwn, userId, reloadTick]);

  // Focus moves once the element it points at has rendered.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target === "sent") sentRef.current?.focus();
    else (triggerRef.current ?? headingRef.current)?.focus();
  }, [own]);

  const onSent = async (outcome: InterestOutcome) => {
    if (outcome.kind === "sent") {
      pendingFocus.current = "sent";
      setOwn(outcome.interest);
      setAnnouncement("Your interest was sent to the founder.");
      return;
    }
    const result = await loadOwn();
    if (!result.row) {
      // It was withdrawn or dismissed in the meantime; say so plainly.
      setAnnouncement("Your interest could not be sent. Please try again.");
      triggerRef.current?.focus();
      return;
    }
    pendingFocus.current = "sent";
    setOwn(result.row);
    setAnnouncement(
      "You had already sent interest in this pitch. You can withdraw it below.",
    );
  };

  const withdraw = async (): Promise<string | null> => {
    if (!own) return null;
    const { error } = await supabase.from("pitch_interests").delete().eq("id", own.id);
    // No rows deleted means the founder already dismissed it: the outcome the
    // person wanted either way.
    if (error) return friendlyPitchError(error, "Your interest could not be withdrawn. Please try again.");
    return null;
  };

  return (
    <section aria-labelledby="pitch-interest-heading" className="space-y-3">
      <h2
        id="pitch-interest-heading"
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-xl font-semibold text-foreground outline-none"
      >
        Offer to help
      </h2>
      <p className="text-muted-foreground">
        Funders, mentors, testers and collaborators can send the founder a
        private message with a way to reach them. Abilitiverse does not process
        payments or hold money; any funding is arranged directly between you and
        the founder.
      </p>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {!userId ? (
        pitch.is_open ? (
          <p>
            <Link
              to={`/login?next=/pitches/${pitch.id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in to express interest
            </Link>
          </p>
        ) : (
          <p className="text-muted-foreground">
            This pitch is not taking new interest right now.
          </p>
        )
      ) : state === "loading" ? (
        <p className="text-sm text-muted-foreground">Checking whether you have sent interest…</p>
      ) : state === "error" ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm font-medium text-destructive">
            We could not check whether you have already sent interest.
          </p>
          <Button variant="outline" className="min-h-11" onClick={() => setReloadTick((t) => t + 1)}>
            Try again
          </Button>
        </div>
      ) : own ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
          <p ref={sentRef} tabIndex={-1} className="text-foreground outline-none">
            You sent interest on {formatDate(own.created_at)}, offering{" "}
            {PITCH_NEED_LABELS[own.offering].toLowerCase()}. Only the founder can
            see it.
          </p>
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="min-h-11">
                Withdraw interest
              </Button>
            }
            title="Withdraw your interest?"
            description="The founder will no longer see your message or contact details. You can send a new request later while the pitch is open."
            confirmLabel="Withdraw"
            busyLabel="Withdrawing…"
            onConfirm={withdraw}
            onDone={() => {
              pendingFocus.current = "trigger";
              setOwn(null);
              setAnnouncement("Your interest was withdrawn.");
            }}
          />
        </div>
      ) : pitch.is_open ? (
        <InterestDialog
          pitchId={pitch.id}
          userId={userId}
          founderNeeds={pitch.needs}
          triggerRef={triggerRef}
          onDone={(outcome) => void onSent(outcome)}
        />
      ) : (
        <p className="text-muted-foreground">
          This pitch is not taking new interest right now.
        </p>
      )}
    </section>
  );
};

export default InterestPanel;
