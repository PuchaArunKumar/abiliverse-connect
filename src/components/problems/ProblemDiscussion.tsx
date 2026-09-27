import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "@/components/problems/ConfirmDialog";
import { COMMENT_MAX, formatDate, friendlyWriteError } from "@/lib/problems";

export interface ProblemComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export const COMMENT_COLUMNS = "id, user_id, body, created_at";

interface ProblemDiscussionProps {
  problemId: string;
  commentCount: number;
  comments: ProblemComment[];
  /** Null when the comments could not be loaded; shown instead of the list. */
  loadError: string | null;
  currentUserId: string | null;
  /** Auth is still settling: show neither the form nor a sign-in prompt yet. */
  authLoading: boolean;
  nameFor: (userId: string) => string;
  onAdded: (comment: ProblemComment) => void;
  onDeleted: (commentId: string) => void;
}

/** Comments on a problem, with posting and (own comments only) deleting. */
const ProblemDiscussion = ({
  problemId,
  commentCount,
  comments,
  loadError,
  currentUserId,
  authLoading,
  nameFor,
  onAdded,
  onDeleted,
}: ProblemDiscussionProps) => {
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProblemComment | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const postingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const addComment = async (event: FormEvent) => {
    event.preventDefault();
    const body = newComment.trim();
    if (!currentUserId || postingRef.current) return;
    if (!body) {
      setPostError("Write a comment before posting.");
      return;
    }
    postingRef.current = true;
    setPosting(true);
    setPostError(null);
    const { data, error } = await supabase
      .from("problem_comments")
      .insert({ problem_id: problemId, user_id: currentUserId, body })
      .select(COMMENT_COLUMNS)
      .single();
    postingRef.current = false;
    setPosting(false);
    if (error || !data) {
      setPostError(friendlyWriteError(error, "Your comment could not be posted. Please try again."));
      return;
    }
    onAdded(data as ProblemComment);
    setNewComment("");
    setStatus("Comment posted.");
  };

  const deleteComment = async (): Promise<string | null> => {
    if (!deleteTarget) return null;
    const { data, error } = await supabase
      .from("problem_comments")
      .delete()
      .eq("id", deleteTarget.id)
      .select("id");
    if (error) {
      return friendlyWriteError(error, "The comment could not be deleted. Please try again.");
    }
    // RLS turns a refused delete into "0 rows" rather than an error.
    if (!data || data.length === 0) return "The comment could not be deleted. It may already have been removed.";
    onDeleted(deleteTarget.id);
    return null;
  };

  const commentErrorId = "new-comment-error";

  return (
    <section aria-labelledby="discussion-heading">
      <h2
        ref={headingRef}
        id="discussion-heading"
        tabIndex={-1}
        className="font-heading text-xl font-semibold text-foreground focus:outline-none"
      >
        Discussion ({commentCount})
      </h2>

      <p role="status" className="sr-only">
        {status}
      </p>

      {authLoading ? null : currentUserId ? (
        <form onSubmit={addComment} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="new-comment">Add a comment</Label>
            <Textarea
              id="new-comment"
              className="mt-1"
              rows={3}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share context, a workaround, or an existing solution."
              maxLength={COMMENT_MAX}
              aria-invalid={postError ? true : undefined}
              aria-describedby={postError ? commentErrorId : undefined}
            />
            <div role="alert">
              {postError && (
                <p id={commentErrorId} className="mt-1 text-sm font-medium text-destructive">
                  {postError}
                </p>
              )}
            </div>
          </div>
          <Button
            type="submit"
            className="min-h-11"
            aria-disabled={posting}
          >
            {posting ? (
              <>
                <Loader2
                  className="mr-1 h-4 w-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Posting...
              </>
            ) : (
              "Post comment"
            )}
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-muted-foreground">
          <Link
            to={`/login?next=${encodeURIComponent(`/problems/${problemId}`)}`}
            className="text-primary underline underline-offset-2"
          >
            Sign in
          </Link>{" "}
          to join the discussion.
        </p>
      )}

      {loadError ? (
        <p className="mt-6 text-sm text-muted-foreground">{loadError}</p>
      ) : (
        comments.length > 0 && (
          <ul className="mt-6 space-y-4" role="list">
            {comments.map((c) => (
              <li key={c.id}>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                        {nameFor(c.user_id)}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {formatDate(c.created_at)}
                        </span>
                      </p>
                      {currentUserId === c.user_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete your comment from ${formatDate(c.created_at)}`}
                          className="min-h-11 min-w-11 shrink-0"
                          onClick={(event) => {
                            returnFocusRef.current = event.currentTarget;
                            setDeleteTarget(c);
                            setConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-foreground [overflow-wrap:anywhere]">
                      {c.body}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this comment?"
        description={
          deleteTarget
            ? `Your comment from ${formatDate(deleteTarget.created_at)} will be removed from the discussion. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete comment"
        busyLabel="Deleting..."
        cancelLabel="Keep comment"
        onConfirm={deleteComment}
        onClosed={(confirmed) => {
          if (confirmed) {
            // The deleted comment and its button are gone: land on the
            // discussion heading and say what happened.
            headingRef.current?.focus();
            setStatus("Comment deleted.");
            toast.success("Comment deleted");
          } else {
            returnFocusRef.current?.focus();
          }
          setDeleteTarget(null);
        }}
      />
    </section>
  );
};

export default ProblemDiscussion;
