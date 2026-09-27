import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ConfirmDialog from "@/components/pitches/ConfirmDialog";
import { INTEREST_COLUMNS } from "@/components/pitches/InterestDialog";
import { fetchDisplayNames } from "@/components/pitches/profile-names";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/problems";
import {
  PITCH_NEED_LABELS,
  displayNameOr,
  friendlyPitchError,
  pluralise,
  type PitchInterest,
} from "@/lib/pitches";
import { useFocusAfterReload } from "@/hooks/useFocusAfterReload";

interface InterestInboxProps {
  pitchId: string;
  isOpen: boolean;
}

type InboxState = "loading" | "ready" | "error";

/**
 * The founder's view of interest requests. Row-level security returns every
 * request on the founder's own pitch, and nothing here is shown to anyone else.
 */
const InterestInbox = ({ pitchId, isOpen }: InterestInboxProps) => {
  const [interests, setInterests] = useState<PitchInterest[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [state, setState] = useState<InboxState>("loading");
  const [announcement, setAnnouncement] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterReload = useFocusAfterReload(state === "loading", headingRef);

  useEffect(() => {
    let active = true;
    setState("loading");
    void (async () => {
      const { data, error } = await supabase
        .from("pitch_interests")
        .select(INTEREST_COLUMNS)
        .eq("pitch_id", pitchId)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setState("error");
        return;
      }
      const rows = data ?? [];
      const found = await fetchDisplayNames(rows.map((r) => r.user_id));
      if (!active) return;
      setInterests(rows);
      setNames(found);
      setState("ready");
    })();
    return () => {
      active = false;
    };
  }, [pitchId, reloadTick]);

  const dismiss = async (id: string): Promise<string | null> => {
    const { error } = await supabase.from("pitch_interests").delete().eq("id", id);
    if (error) {
      return friendlyPitchError(error, "The request could not be dismissed. Please try again.");
    }
    return null;
  };

  return (
    <section aria-labelledby="pitch-inbox-heading" className="space-y-3">
      <h2
        id="pitch-inbox-heading"
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-xl font-semibold text-foreground outline-none"
      >
        Interest received
      </h2>
      <p className="text-muted-foreground">
        Only you can see these requests and the contact details in them.
        Abilitiverse does not process payments or hold money; follow up with
        people directly.
      </p>
      {!isOpen && (
        <p className="text-sm text-muted-foreground">
          Your pitch is closed to new interest. You can reopen it from{" "}
          <Link
            to={`/pitches/${pitchId}/edit`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Edit pitch
          </Link>
          .
        </p>
      )}

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {state === "loading" ? (
        <p className="text-sm text-muted-foreground">Loading interest requests…</p>
      ) : state === "error" ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm font-medium text-destructive">
            Interest requests could not be loaded.
          </p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              focusAfterReload();
              setReloadTick((t) => t + 1);
            }}
          >
            Try again
          </Button>
        </div>
      ) : interests.length === 0 ? (
        <p className="text-muted-foreground">
          No one has sent interest yet. When someone does, their message and how
          to reach them will appear here.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {pluralise(interests.length, "request", "requests")}
          </p>
          <ul className="space-y-4" role="list">
            {interests.map((interest) => {
              const name = displayNameOr(names[interest.user_id]);
              return (
                <li key={interest.id}>
                  <Card>
                    <CardContent className="space-y-3 pt-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-heading font-semibold text-foreground [overflow-wrap:anywhere]">
                            {name}, offering {PITCH_NEED_LABELS[interest.offering].toLowerCase()}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Sent {formatDate(interest.created_at)}
                          </p>
                        </div>
                        <ConfirmDialog
                          trigger={
                            <Button variant="outline" className="min-h-11">
                              <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                              Dismiss
                              <span className="sr-only"> the request from {name}</span>
                            </Button>
                          }
                          title="Dismiss this request?"
                          description={`The request from ${name} will be deleted for both of you. Note their contact details first if you want to reply.`}
                          confirmLabel="Dismiss"
                          busyLabel="Dismissing…"
                          onConfirm={() => dismiss(interest.id)}
                          onDone={() => {
                            setInterests((prev) => prev.filter((i) => i.id !== interest.id));
                            setAnnouncement("Request dismissed.");
                            headingRef.current?.focus();
                          }}
                        />
                      </div>
                      <p className="whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
                        {interest.message}
                      </p>
                      <p className="text-sm text-foreground [overflow-wrap:anywhere]">
                        <span className="font-medium">How to reach them: </span>
                        {interest.contact}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
};

export default InterestInbox;
