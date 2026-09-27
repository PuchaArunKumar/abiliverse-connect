import { useEffect, useRef, useState, type FormEvent, type Ref } from "react";
import { flushSync } from "react-dom";
import { HandHeart, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  PITCH_LIMITS,
  PITCH_NEEDS,
  PITCH_NEED_LABELS,
  friendlyInterestError,
  validateInterest,
  type InterestErrors,
  type InterestValues,
  type PitchInterest,
  type PitchNeed,
} from "@/lib/pitches";

export const INTEREST_COLUMNS =
  "id, pitch_id, user_id, offering, message, contact, created_at";

export type InterestOutcome =
  | { kind: "sent"; interest: PitchInterest }
  | { kind: "duplicate" };

interface InterestDialogProps {
  pitchId: string;
  userId: string;
  /** What the founder asked for; marked in the list of offers. */
  founderNeeds: PitchNeed[];
  triggerRef?: Ref<HTMLButtonElement>;
  /**
   * Runs once the dialog has fully closed after a send. The trigger is
   * replaced by the "you sent interest" message, so the caller moves focus.
   */
  onDone: (outcome: InterestOutcome) => void;
}

const offeringId = (need: PitchNeed) => `interest-offering-${need}`;

/** Where focus goes for each field's error, in the order they appear. */
const FIELD_FOCUS: Record<keyof InterestValues, string> = {
  offering: offeringId(PITCH_NEEDS[0]),
  message: "interest-message",
  contact: "interest-contact",
};

/** The private "I can help" request a visitor sends a founder. */
const InterestDialog = ({
  pitchId,
  userId,
  founderNeeds,
  triggerRef,
  onDone,
}: InterestDialogProps) => {
  const [open, setOpen] = useState(false);
  // Nothing is preselected, so what the founder reads is a choice the sender
  // actually made.
  const [values, setValues] = useState<InterestValues>({
    offering: "",
    message: "",
    contact: "",
  });
  const [errors, setErrors] = useState<InterestErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const outcomeRef = useRef<InterestOutcome | null>(null);

  const set = (key: keyof InterestValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  // After a failed send, drop each error as soon as its field is fixed. New
  // errors wait for the next send, rather than appearing mid-sentence.
  useEffect(() => {
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const fresh = validateInterest(values);
      const kept: InterestErrors = {};
      for (const field of Object.keys(prev) as (keyof InterestValues)[]) {
        if (fresh[field]) kept[field] = fresh[field];
      }
      return kept;
    });
  }, [values]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (sendingRef.current) return;
    const found = validateInterest(values);
    // Render the errors before focus moves, so the field is already marked
    // invalid and described by its error when a screen reader announces it.
    flushSync(() => {
      setErrors(found);
      setServerError(null);
    });
    const firstInvalid = (Object.keys(FIELD_FOCUS) as (keyof InterestValues)[]).find(
      (field) => found[field],
    );
    if (firstInvalid) {
      // The field's error is tied to it by aria-describedby, so focusing it
      // reads the reason aloud.
      document.getElementById(FIELD_FOCUS[firstInvalid])?.focus();
      return;
    }

    sendingRef.current = true;
    setSending(true);
    const { data, error } = await supabase
      .from("pitch_interests")
      .insert({
        pitch_id: pitchId,
        user_id: userId,
        offering: values.offering as PitchNeed,
        message: values.message.trim(),
        contact: values.contact.trim(),
      })
      .select(INTEREST_COLUMNS)
      .single();
    sendingRef.current = false;
    setSending(false);

    if (error?.code === "23505") {
      // Sent before, perhaps from another tab: show that request instead.
      outcomeRef.current = { kind: "duplicate" };
      setOpen(false);
      return;
    }
    if (error || !data) {
      setServerError(friendlyInterestError(error));
      return;
    }
    outcomeRef.current = { kind: "sent", interest: data };
    setOpen(false);
  };

  const describedBy = (field: keyof InterestValues, hintId?: string) =>
    [hintId, errors[field] && `interest-${field}-error`].filter(Boolean).join(" ") ||
    undefined;

  const fieldError = (field: keyof InterestValues) =>
    errors[field] ? (
      <p id={`interest-${field}-error`} className="mt-1 text-sm font-medium text-destructive">
        <span className="sr-only">Error: </span>
        {errors[field]}
      </p>
    ) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (sendingRef.current) return;
        setOpen(next);
        if (!next) setServerError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button ref={triggerRef} className="min-h-11">
          <HandHeart className="mr-1 h-4 w-4" aria-hidden="true" />
          Express interest
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto motion-reduce:animate-none sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          const outcome = outcomeRef.current;
          if (!outcome) return;
          event.preventDefault();
          outcomeRef.current = null;
          onDone(outcome);
        }}
      >
        <DialogHeader>
          <DialogTitle>Express interest</DialogTitle>
          <DialogDescription>
            Only the founder can see your message and contact details. Abilitiverse
            does not process payments or hold money; anything you agree is
            arranged directly between the two of you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={send} noValidate className="space-y-5">
          <div>
            <p id="interest-offering-label" className="text-sm font-medium text-foreground">
              What you are offering
            </p>
            <RadioGroup
              className="mt-2 gap-0"
              value={values.offering}
              onValueChange={(v) => set("offering", v)}
              aria-labelledby="interest-offering-label"
              aria-describedby={describedBy("offering")}
              aria-required="true"
            >
              {PITCH_NEEDS.map((need) => {
                const id = offeringId(need);
                const requested = founderNeeds.includes(need);
                return (
                  <div key={need} className="flex min-h-11 items-center gap-3">
                    <RadioGroupItem id={id} value={need} />
                    <Label
                      htmlFor={id}
                      className="cursor-pointer py-3 font-normal"
                    >
                      {PITCH_NEED_LABELS[need]}
                      {requested && (
                        <span className="text-muted-foreground"> (the founder asked for this)</span>
                      )}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
            {fieldError("offering")}
          </div>

          <div>
            <Label htmlFor="interest-message">Message to the founder</Label>
            <Textarea
              id="interest-message"
              className="mt-1"
              rows={5}
              value={values.message}
              onChange={(e) => set("message", e.target.value)}
              aria-required="true"
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={describedBy("message", "interest-message-hint")}
            />
            <p id="interest-message-hint" className="mt-1 text-sm text-muted-foreground">
              Who you are and how you could help. {PITCH_LIMITS.interestMessageMin} to{" "}
              {PITCH_LIMITS.interestMessageMax.toLocaleString()} characters.
            </p>
            {fieldError("message")}
          </div>

          <div>
            <Label htmlFor="interest-contact">How the founder can reach you</Label>
            <Input
              id="interest-contact"
              className="mt-1 min-h-11"
              value={values.contact}
              onChange={(e) => set("contact", e.target.value)}
              autoComplete="email"
              aria-required="true"
              aria-invalid={errors.contact ? true : undefined}
              aria-describedby={describedBy("contact", "interest-contact-hint")}
            />
            <p id="interest-contact-hint" className="mt-1 text-sm text-muted-foreground">
              An email address, phone number or profile link. Only the founder
              will see it.
            </p>
            {fieldError("contact")}
          </div>

          {/* Always mounted, so a failed send is announced when it appears. */}
          <div role="alert">
            {serverError && (
              <p className="text-sm font-medium text-destructive">{serverError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
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
                  Sending…
                </>
              ) : (
                "Send to the founder"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InterestDialog;
