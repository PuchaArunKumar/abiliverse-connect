import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "@/components/layout/Layout";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { isMissingSchemaError } from "@/lib/supabase-errors";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Heart, Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import ConfirmDeleteDialog from "@/components/community/ConfirmDeleteDialog";
import Field from "@/components/community/Field";
import InlineLoading from "@/components/community/InlineLoading";
import LoadProblem from "@/components/community/LoadProblem";
import { friendlyError, isDuplicateError } from "@/components/community/errors";
import { displayName, initialOf, plural } from "@/components/community/format";
import { elementOrFallback, neighbourId } from "@/components/community/list";
import { useFocusRequest } from "@/components/community/useFocusRequest";
import { usePendingSet } from "@/components/community/usePendingSet";
import { LIMITS, commentBodyError, postBodyError } from "@/components/community/validation";

// Counts come from PostgREST's embedded count, worked out by the database.
// Downloading every like and comment row to count them in the browser was
// silently cut off at the API's row limit (1,000 by default) once the feed got
// busy, so counts came out low and a post you had liked could show as not.
const POST_COLUMNS =
  "id, user_id, body, created_at, post_likes(count), post_comments(count)";
const COMMENT_COLUMNS = "id, post_id, user_id, body, created_at";

interface Post {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: string;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: string;
}

type Thread =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; comments: Comment[] };

type LoadState = "loading" | "ready" | "error" | "unavailable";

const LIST_HEADING_ID = "feed-posts-heading";
const COMPOSER_ID = "post-body";
const postId = (id: string) => `post-${id}`;
const threadId = (id: string) => `post-${id}-comments`;
const commentFieldId = (id: string) => `post-${id}-comment`;

async function fetchNames(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (userIds.length === 0) return names;
  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", userIds);
  (data ?? []).forEach((p) => names.set(p.user_id, displayName(p.display_name)));
  return names;
}

const timeAgo = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

const Feed = () => {
  useDocumentTitle("Community Feed");
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const requestFocus = useFocusRequest();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retrying, setRetrying] = useState(false);
  // The viewer's own name, so a post or comment they have just written shows
  // who wrote it straight away instead of a placeholder.
  const [myName, setMyName] = useState<string>(displayName(null));

  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | undefined>();
  const [posting, setPosting] = useState(false);
  const postingRef = useRef(false);

  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const threadRequests = useRef<Record<string, number>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const commenting = usePendingSet();
  const liking = usePendingSet();

  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const focusAfterDelete = useRef<string | null>(null);

  // Only the newest request may write to state, so a slow response cannot
  // replace a newer feed.
  const requestId = useRef(0);

  const load = useCallback(async (): Promise<boolean> => {
    const id = ++requestId.current;
    const { data, error } = await supabase
      .from("posts")
      .select(POST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (id !== requestId.current) return false;
    if (error) {
      setRetrying(false);
      setLoadState(isMissingSchemaError(error) ? "unavailable" : "error");
      return false;
    }

    const rows = data ?? [];
    const ids = rows.map((p) => p.id);
    const authorIds = new Set(rows.map((p) => p.user_id));
    if (userId) authorIds.add(userId);

    const [names, likedRes] = await Promise.all([
      fetchNames(Array.from(authorIds)),
      // Only the viewer's own likes, and at most one per post shown.
      userId && ids.length
        ? supabase.from("post_likes").select("post_id").eq("user_id", userId).in("post_id", ids)
        : Promise.resolve({ data: [] as { post_id: string }[] }),
    ]);
    if (id !== requestId.current) return false;

    const liked = new Set((likedRes.data ?? []).map((l) => l.post_id));
    setPosts(
      rows.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        body: p.body,
        created_at: p.created_at,
        author: names.get(p.user_id) ?? displayName(null),
        like_count: p.post_likes[0]?.count ?? 0,
        liked_by_me: liked.has(p.id),
        comment_count: p.post_comments[0]?.count ?? 0,
      })),
    );
    if (userId) setMyName(names.get(userId) ?? displayName(null));
    setRetrying(false);
    setLoadState("ready");
    return true;
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const retry = () => {
    setRetrying(true);
    void load().then((ok) => {
      if (ok) requestFocus(LIST_HEADING_ID);
    });
  };

  // ------------------------------------------------------------------ post

  const submitPost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || postingRef.current) return;
    const body = draft.trim();
    const error = postBodyError(body);
    setDraftError(error);
    if (error) {
      document.getElementById(COMPOSER_ID)?.focus();
      return;
    }

    postingRef.current = true;
    setPosting(true);
    const { data, error: insertError } = await supabase
      .from("posts")
      .insert({ user_id: user.id, body })
      .select("id, user_id, body, created_at")
      .single();
    postingRef.current = false;
    setPosting(false);
    if (insertError) {
      setDraftError(friendlyError(insertError, "Your post could not be published. Please try again."));
      document.getElementById(COMPOSER_ID)?.focus();
      return;
    }
    setPosts((prev) => [
      { ...data, author: myName, like_count: 0, liked_by_me: false, comment_count: 0 },
      ...prev,
    ]);
    setDraft("");
    toast.success("Your post is published");
  };

  // ------------------------------------------------------------------ like

  // Sets a post's like state from whatever the latest state is, so applying
  // the same change twice (an optimistic update, then a rollback, or a
  // repeated result) never counts a like twice.
  const setLiked = (id: string, liked: boolean) =>
    setPosts((prev) =>
      prev.map((p) =>
        p.id !== id || p.liked_by_me === liked
          ? p
          : {
              ...p,
              liked_by_me: liked,
              like_count: Math.max(0, p.like_count + (liked ? 1 : -1)),
            },
      ),
    );

  const toggleLike = async (post: Post) => {
    if (!user || !liking.start(post.id)) return;
    const like = !post.liked_by_me;
    setLiked(post.id, like);

    const { error } = like
      ? await supabase.from("post_likes").insert({ post_id: post.id, user_id: user.id })
      : await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    liking.finish(post.id);

    // A duplicate like means it was already saved: the state we wanted.
    if (error && !(like && isDuplicateError(error))) {
      setLiked(post.id, !like);
      toast.error(
        friendlyError(error, like ? "Your like was not saved. Please try again." : "Your like could not be removed. Please try again."),
      );
    }
  };

  // -------------------------------------------------------------- comments

  const toggleThread = async (id: string) => {
    const request = (threadRequests.current[id] ?? 0) + 1;
    threadRequests.current[id] = request;
    if (threads[id]) {
      // Closing also retires any request still in flight for this thread.
      setThreads((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setThreads((prev) => ({ ...prev, [id]: { status: "loading" } }));

    const { data, error } = await supabase
      .from("post_comments")
      .select(COMMENT_COLUMNS)
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    if (threadRequests.current[id] !== request) return;
    if (error) {
      setThreads((prev) => ({
        ...prev,
        [id]: {
          status: "error",
          message: friendlyError(error, "The comments could not be loaded. Close them and try again."),
        },
      }));
      return;
    }

    const names = await fetchNames(Array.from(new Set((data ?? []).map((c) => c.user_id))));
    if (threadRequests.current[id] !== request) return;
    const comments = (data ?? []).map((c) => ({
      ...c,
      author: names.get(c.user_id) ?? displayName(null),
    }));
    setThreads((prev) => ({ ...prev, [id]: { status: "ready", comments } }));
    // The thread is the fresher count; the feed's may be a minute old.
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, comment_count: comments.length } : p)),
    );
  };

  const submitComment = async (event: React.FormEvent, post: Post) => {
    event.preventDefault();
    if (!user) return;
    const body = (commentDrafts[post.id] ?? "").trim();
    const error = commentBodyError(body);
    if (error) {
      setCommentErrors((prev) => ({ ...prev, [post.id]: error }));
      document.getElementById(commentFieldId(post.id))?.focus();
      return;
    }
    if (!commenting.start(post.id)) return;
    setCommentErrors((prev) => {
      const next = { ...prev };
      delete next[post.id];
      return next;
    });

    const { data, error: insertError } = await supabase
      .from("post_comments")
      .insert({ post_id: post.id, user_id: user.id, body })
      .select(COMMENT_COLUMNS)
      .single();
    commenting.finish(post.id);
    if (insertError) {
      setCommentErrors((prev) => ({
        ...prev,
        [post.id]: friendlyError(insertError, "Your comment could not be posted. Please try again."),
      }));
      document.getElementById(commentFieldId(post.id))?.focus();
      return;
    }

    const comment: Comment = { ...data, author: myName };
    setCommentDrafts((prev) => ({ ...prev, [post.id]: "" }));
    setThreads((prev) => {
      const thread = prev[post.id];
      // The thread was closed meanwhile: the comment is saved and shows next
      // time it is opened.
      if (!thread || thread.status !== "ready") return prev;
      return { ...prev, [post.id]: { status: "ready", comments: [...thread.comments, comment] } };
    });
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, comment_count: p.comment_count + 1 } : p)),
    );
    toast.success("Comment posted");
  };

  // ---------------------------------------------------------------- delete

  const confirmDelete = async (): Promise<string | null> => {
    const target = deleteTarget;
    if (!target) return null;
    const { error } = await supabase.from("posts").delete().eq("id", target.id);
    if (error) {
      return friendlyError(error, "The post could not be deleted. Please try again.");
    }
    const next = neighbourId(
      posts.map((p) => p.id),
      target.id,
    );
    focusAfterDelete.current = next ? postId(next) : null;
    setPosts((prev) => prev.filter((p) => p.id !== target.id));
    setThreads((prev) => {
      const copy = { ...prev };
      delete copy[target.id];
      return copy;
    });
    toast.success("Post deleted");
    return null;
  };

  // ---------------------------------------------------------------- render

  const renderThread = (post: Post) => {
    const thread = threads[post.id];
    if (!thread) return null;
    const sending = commenting.pending.has(post.id);
    return (
      <div id={threadId(post.id)} className="mt-4 space-y-3 border-t pt-3">
        {thread.status === "loading" ? (
          <InlineLoading label="Loading comments…" className="py-4" />
        ) : thread.status === "error" ? (
          <p role="alert" className="text-sm font-medium text-destructive dark:text-red-300">
            {thread.message}
          </p>
        ) : thread.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-3" role="list" aria-label={`Comments on ${post.author}'s post`}>
            {thread.comments.map((c) => (
              <li key={c.id} className="flex gap-2">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold"
                  aria-hidden="true"
                >
                  {initialOf(c.author)}
                </div>
                <div className="min-w-0 flex-1 rounded-lg bg-muted px-3 py-2">
                  <p className="text-sm font-medium [overflow-wrap:anywhere]">
                    {c.author}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · <time dateTime={c.created_at}>{timeAgo(c.created_at)}</time>
                    </span>
                  </p>
                  <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {user && thread.status !== "error" && (
          <form onSubmit={(e) => void submitComment(e, post)} noValidate className="flex items-start gap-2">
            <Field
              id={commentFieldId(post.id)}
              label={<span className="sr-only">Add a comment</span>}
              hint={`Up to ${LIMITS.commentBody.max.toLocaleString("en")} characters.`}
              error={commentErrors[post.id]}
              className="min-w-0 flex-1 [&>div]:mt-0"
            >
              {(control) => (
                <Textarea
                  {...control}
                  placeholder="Add a comment…"
                  rows={1}
                  value={commentDrafts[post.id] ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCommentDrafts((prev) => ({ ...prev, [post.id]: value }));
                  }}
                  className="min-h-11"
                />
              )}
            </Field>
            <Button
              type="submit"
              size="icon"
              aria-label={sending ? "Sending comment" : "Send comment"}
              aria-disabled={sending || undefined}
              className="min-h-11 min-w-11 shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </form>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <section className="container max-w-2xl py-8">
        <h1 className="mb-2 font-heading text-3xl font-bold">Community Feed</h1>
        <p className="mb-6 text-muted-foreground">
          Share knowledge, ask questions, and support each other. Posts are visible to
          signed-in members.
        </p>

        {loadState === "unavailable" ? (
          <FeatureUnavailable feature="The community feed" headingLevel="h2" />
        ) : (
          <>
            {user && (
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <form onSubmit={submitPost} noValidate>
                    <Field
                      id={COMPOSER_ID}
                      label="Write a post"
                      hint={`Up to ${LIMITS.postBody.max.toLocaleString("en")} characters.`}
                      error={draftError}
                    >
                      {(control) => (
                        <Textarea
                          {...control}
                          placeholder="Share something with the community…"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          rows={3}
                        />
                      )}
                    </Field>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="submit"
                        aria-disabled={posting || undefined}
                        className="min-h-11"
                      >
                        {posting ? (
                          <>
                            <Loader2
                              className="h-4 w-4 animate-spin motion-reduce:animate-none"
                              aria-hidden="true"
                            />
                            Posting…
                          </>
                        ) : (
                          "Post"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <h2
              id={LIST_HEADING_ID}
              tabIndex={-1}
              className="mb-4 font-heading text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Recent posts
            </h2>

            {loadState === "loading" ? (
              <InlineLoading label="Loading posts…" />
            ) : loadState === "error" ? (
              <LoadProblem
                message="We could not load the feed. Check your connection and try again."
                onRetry={retry}
                retrying={retrying}
              />
            ) : posts.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">No posts yet. Be the first!</p>
            ) : (
              <ul className="space-y-4" role="list">
                {posts.map((p) => {
                  const expanded = threads[p.id] !== undefined;
                  return (
                    <li key={p.id}>
                      <article
                        id={postId(p.id)}
                        tabIndex={-1}
                        aria-labelledby={`${postId(p.id)}-author`}
                        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <div
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground"
                                  aria-hidden="true"
                                >
                                  {initialOf(p.author)}
                                </div>
                                <div className="min-w-0">
                                  <h3
                                    id={`${postId(p.id)}-author`}
                                    className="font-medium [overflow-wrap:anywhere]"
                                  >
                                    {p.author}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">
                                    <time dateTime={p.created_at}>{timeAgo(p.created_at)}</time>
                                  </p>
                                </div>
                              </div>
                              {userId === p.user_id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Delete your post"
                                  onClick={() => {
                                    setDeleteTarget(p);
                                    setDeleteOpen(true);
                                  }}
                                  className="min-h-11 min-w-11 shrink-0"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{p.body}</p>
                            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                              {/* One stable name; aria-pressed carries liked or
                                  not, so the state is not announced twice. */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void toggleLike(p)}
                                aria-pressed={p.liked_by_me}
                                aria-label={`Like, ${plural(p.like_count, "like", "likes")}`}
                                className="min-h-11"
                              >
                                <Heart
                                  className={`mr-1 h-4 w-4 ${p.liked_by_me ? "fill-primary text-primary" : ""}`}
                                  aria-hidden="true"
                                />
                                {p.like_count.toLocaleString("en")}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void toggleThread(p.id)}
                                aria-expanded={expanded}
                                aria-controls={threadId(p.id)}
                                aria-label={`Comments (${p.comment_count.toLocaleString("en")}), ${expanded ? "hide" : "show"}`}
                                className="min-h-11"
                              >
                                <MessageCircle className="mr-1 h-4 w-4" aria-hidden="true" />
                                {p.comment_count.toLocaleString("en")}
                              </Button>
                            </div>
                            {renderThread(p)}
                          </CardContent>
                        </Card>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete your post?"
          description="Its comments and likes will also be removed, for everyone. This cannot be undone."
          confirmLabel="Delete post"
          onConfirm={confirmDelete}
          focusAfterDelete={() =>
            elementOrFallback(focusAfterDelete.current, LIST_HEADING_ID) ??
            document.getElementById(COMPOSER_ID)
          }
        />
      </section>
    </Layout>
  );
};

export default Feed;
