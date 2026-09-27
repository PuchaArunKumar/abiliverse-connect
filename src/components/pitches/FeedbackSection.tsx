import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "@/components/pitches/ConfirmDialog";
import { fetchDisplayNames } from "@/components/pitches/profile-names";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/problems";
import {
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABELS,
  PITCH_LIMITS,
  displayNameOr,
  feedbackKindLabel,
  friendlyPitchError,
  isFeedbackKind,
  validateFeedback,
  type FeedbackKind,
  type PitchFeedback,
} from "@/lib/pitches";

const FEEDBACK_COLUMNS = "id, pitch_id, user_id, kind, body, created_at";

interface FeedbackSectionProps {
  pitchId: string;
  /** The signed-in user, or null. */
  userId: string | null;
  isModerator: boolean;
  /** Called after a post or delete, so the page can re-read its counters. */
  onChanged: () => void;
}

type ListState = "loading" | "ready" | "error";

/**
 * Public feedback on a pitch. Anyone can read it; signed-in people can post,
 * and remove their own. The founder cannot delete criticism of their pitch;
 * moderators can remove abuse.
 */
const FeedbackSection = ({ pitchId, userId, isModerator, onChanged }: FeedbackSectionProps) => {
  const [items, setItems] = useState<PitchFeedback[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [state, setState] = useState<ListState>("loading");
  const [reloadTick, setReloadTick] = useState(0);
  const [kind, setKind] = useState<FeedbackKind>("suggestion");
  const [body, setBody] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const postingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    setState("loading");
    void (async () => {
      const { data, error } = await supabase
        .from("pitch_feedback")
        .select(FEEDBACK_COLUMNS)
        .eq("pitch_id", pitchId)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) {
        setState("error");
        return;
      }
      const rows = data ?? [];
      // Names are for signed-in readers only (profiles is not public).
      const found = userId ? await fetchDisplayNames(rows.map((r) => r.user_id)) : {};
      if (!active) return;
      setItems(rows);
      setNames(found);
      setState("ready");
    })();
    return () => {
      active = false;
    };
  }, [pitchId, userId, reloadTick]);

  // Once the text is valid again, the old error is no longer true.
  useEffect(() => {
    setBodyError((prev) => (prev ? validateFeedback(body) : prev));
  }, [body]);

  const post = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId || postingRef.current) return;
    setPostError(null);
    const invalid = validateFeedback(body);
    if (invalid) {
      setBodyError(invalid);
      bodyRef.current?.focus();
      return;
    }
    postingRef.current = true;
    setPosting(true);
    const { data, error } = await supabase
      .from("pitch_feedback")
      .insert({ pitch_id: pitchId, user_id: userId, kind, body: body.trim() })
      .select(FEEDBACK_COLUMNS)
      .single();
    postingRef.current = false;
    setPosting(false);
    if (error || !data) {
      setPostError(friendlyPitchError(error, "Your feedback could not be posted. Please try again."));
      return;
    }
    setItems((prev) => [...prev, data]);
    if (!names[userId]) {
      void fetchDisplayNames([userId]).then((found) =>
        setNames((prev) => ({ ...prev, ...found })),
      );
    }
    setBody("");
    setAnnouncement("Your feedback is posted.");
    onChanged();
  };

  const remove = async (id: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("pitch_feedback")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) return friendlyPitchError(error, "The feedback could not be deleted. Please try again.");
    // Row-level security turns a refused delete into zero rows, not an error.
    if (!data || data.length === 0) {
      return "The feedback could not be deleted. It may already have been removed.";
    }
    return null;
  };

  const heading = state === "ready" ? `Feedback (${items.length.toLocaleString()})` : "Feedback";

  return (
    <section aria-labelledby="pitch-feedback-heading" className="space-y-4">
      <h2
        id="pitch-feedback-heading"
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-xl font-semibold text-foreground outline-none"
      >
        {heading}
      </h2>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {userId ? (
        <form onSubmit={post} noValidate className="space-y-4">
          <div className="max-w-xs">
            <Label htmlFor="pitch-feedback-kind">Kind of feedback</Label>
            <Select
              value={kind}
              onValueChange={(v) => {
                if (isFeedbackKind(v)) setKind(v);
              }}
            >
              <SelectTrigger id="pitch-feedback-kind" className="mt-1 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {FEEDBACK_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pitch-feedback-body">Your feedback</Label>
            <Textarea
              ref={bodyRef}
              id="pitch-feedback-body"
              className="mt-1"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-invalid={bodyError ? true : undefined}
              aria-describedby={
                bodyError
                  ? "pitch-feedback-hint pitch-feedback-error"
                  : "pitch-feedback-hint"
              }
            />
            <p id="pitch-feedback-hint" className="mt-1 text-sm text-muted-foreground">
              Be specific and kind. Up to {PITCH_LIMITS.feedbackMax.toLocaleString()}{" "}
              characters. Feedback is public; you can delete your own later.
            </p>
            {bodyError && (
              <p id="pitch-feedback-error" className="mt-1 text-sm font-medium text-destructive">
                <span className="sr-only">Error: </span>
                {bodyError}
              </p>
            )}
          </div>
          <div role="alert">
            {postError && <p className="text-sm font-medium text-destructive">{postError}</p>}
          </div>
          <Button type="submit" className="min-h-11" aria-disabled={posting}>
            {posting ? (
              <>
                <Loader2
                  className="mr-1 h-4 w-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Posting…
              </>
            ) : (
              "Post feedback"
            )}
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground">
          <Link
            to={`/login?next=/pitches/${pitchId}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>{" "}
          to leave feedback.
        </p>
      )}

      {state === "loading" ? (
        <p className="text-sm text-muted-foreground">Loading feedback…</p>
      ) : state === "error" ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm font-medium text-destructive">Feedback could not be loaded.</p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => setReloadTick((t) => t + 1)}
          >
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">No feedback yet.</p>
      ) : (
        <ul className="space-y-4" role="list">
          {items.map((item) => {
            const own = item.user_id === userId;
            return (
              <li key={item.id}>
                <Card>
                  <CardContent className="space-y-2 pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="min-w-0 text-sm text-foreground [overflow-wrap:anywhere]">
                        <span className="font-medium">
                          {own ? "You" : displayNameOr(names[item.user_id])}
                        </span>
                        <span className="text-muted-foreground"> · {formatDate(item.created_at)}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{feedbackKindLabel(item.kind)}</Badge>
                        {(own || isModerator) && (
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" className="min-h-11">
                                <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                                Delete
                                <span className="sr-only">
                                  {own ? " your feedback" : " this feedback"}
                                </span>
                              </Button>
                            }
                            title={own ? "Delete your feedback?" : "Remove this feedback?"}
                            description="This cannot be undone."
                            confirmLabel="Delete"
                            busyLabel="Deleting…"
                            onConfirm={() => remove(item.id)}
                            onDone={() => {
                              setItems((prev) => prev.filter((i) => i.id !== item.id));
                              setAnnouncement("Feedback deleted.");
                              headingRef.current?.focus();
                              onChanged();
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
                      {item.body}
                    </p>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default FeedbackSection;
