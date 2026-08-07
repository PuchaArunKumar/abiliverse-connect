import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowBigUp,
  ArrowLeft,
  Bookmark,
  History,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AGE_GROUP_LABELS,
  DISABILITY_TYPE_LABELS,
  PROBLEM_STATUS_LABELS,
  SEVERITY_LABELS,
  STATUS_VARIANTS,
  formatDate,
  type Problem,
} from "@/lib/problems";

const DETAIL_COLUMNS =
  "id, user_id, title, description, disability_types, category, country, age_groups, severity, status, existing_solutions, related_research, tags, image_urls, video_urls, document_urls, vote_count, comment_count, created_at, updated_at";

type Detail = Omit<Problem, "search_vector">;

interface Comment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
}

const ProblemDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [problem, setProblem] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [voted, setVoted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [revisionCount, setRevisionCount] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("problems")
      .select(DETAIL_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      setLoading(false);
      setProblem(null);
      if (error) toast.error(error.message);
      return;
    }
    const detail = data as Detail;
    setProblem(detail);

    const [{ data: commentRows }, { count: revisions }] = await Promise.all([
      supabase
        .from("problem_comments")
        .select("id, user_id, body, created_at")
        .eq("problem_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("problem_revisions")
        .select("id", { count: "exact", head: true })
        .eq("problem_id", id),
    ]);

    const rows = (commentRows ?? []) as Comment[];
    setComments(rows);
    setRevisionCount(revisions ?? 0);

    // profiles is readable only to signed-in users, so anonymous visitors see
    // attribution fall back to "Community member".
    if (user) {
      const ids = Array.from(
        new Set([detail.user_id, ...rows.map((c) => c.user_id)]),
      );
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      for (const p of profiles ?? []) {
        if (p.display_name) map[p.user_id] = p.display_name;
      }
      setNames(map);

      const [{ data: vote }, { data: bookmark }] = await Promise.all([
        supabase
          .from("problem_votes")
          .select("problem_id")
          .eq("problem_id", id)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("problem_bookmarks")
          .select("problem_id")
          .eq("problem_id", id)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      setVoted(Boolean(vote));
      setBookmarked(Boolean(bookmark));
    }

    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  const requireAuth = () => {
    toast.error("Sign in to do that.");
    navigate(`/login?next=/problems/${id}`);
  };

  const toggleVote = async () => {
    if (!user) return requireAuth();
    if (!problem) return;

    // Optimistic: the counter is maintained by a trigger, so mirror it locally
    // and roll back if the write fails.
    const next = !voted;
    setVoted(next);
    setProblem({
      ...problem,
      vote_count: problem.vote_count + (next ? 1 : -1),
    });

    const { error } = next
      ? await supabase
          .from("problem_votes")
          .insert({ problem_id: problem.id, user_id: user.id })
      : await supabase
          .from("problem_votes")
          .delete()
          .eq("problem_id", problem.id)
          .eq("user_id", user.id);

    if (error) {
      setVoted(!next);
      setProblem({
        ...problem,
        vote_count: problem.vote_count + (next ? -1 : 1),
      });
      toast.error(error.message);
    }
  };

  const toggleBookmark = async () => {
    if (!user) return requireAuth();
    if (!problem) return;
    const next = !bookmarked;
    setBookmarked(next);

    const { error } = next
      ? await supabase
          .from("problem_bookmarks")
          .insert({ problem_id: problem.id, user_id: user.id })
      : await supabase
          .from("problem_bookmarks")
          .delete()
          .eq("problem_id", problem.id)
          .eq("user_id", user.id);

    if (error) {
      setBookmarked(!next);
      toast.error(error.message);
    } else {
      toast.success(next ? "Saved to your bookmarks" : "Removed from bookmarks");
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !problem) return;
    setPosting(true);
    const { data, error } = await supabase
      .from("problem_comments")
      .insert({
        problem_id: problem.id,
        user_id: user.id,
        body: newComment.trim(),
      })
      .select("id, user_id, body, created_at")
      .single();
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComments((prev) => [...prev, data as Comment]);
    setProblem({ ...problem, comment_count: problem.comment_count + 1 });
    setNewComment("");
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from("problem_comments")
      .delete()
      .eq("id", commentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    if (problem) {
      setProblem({
        ...problem,
        comment_count: Math.max(problem.comment_count - 1, 0),
      });
    }
  };

  const nameFor = (userId: string) => names[userId] ?? "Community member";

  if (loading) {
    return (
      <Layout>
        <section className="container max-w-3xl space-y-4 py-8">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-40 w-full" />
        </section>
      </Layout>
    );
  }

  if (!problem) {
    return (
      <Layout>
        <section className="container max-w-2xl py-16 text-center">
          <h1 className="mb-3 font-heading text-2xl font-bold">
            Problem not found
          </h1>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/problems">Back to all problems</Link>
          </Button>
        </section>
      </Layout>
    );
  }

  const meta = [problem.category, problem.country].filter(Boolean).join(" · ");

  return (
    <Layout>
      <article className="container max-w-3xl py-8">
        <Link
          to="/problems"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All problems
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-3xl font-bold text-foreground">
            {problem.title}
          </h1>
          <Badge variant={STATUS_VARIANTS[problem.status]}>
            {PROBLEM_STATUS_LABELS[problem.status]}
          </Badge>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Reported by {nameFor(problem.user_id)} on{" "}
          {formatDate(problem.created_at)}
          {meta && ` · ${meta}`}
          {problem.severity && ` · ${SEVERITY_LABELS[problem.severity]} severity`}
        </p>

        {revisionCount > 0 && (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <History className="h-4 w-4" aria-hidden="true" />
            Edited {revisionCount} {revisionCount === 1 ? "time" : "times"}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {problem.disability_types.map((d) => (
            <Badge key={d} variant="secondary">
              {DISABILITY_TYPE_LABELS[d]}
            </Badge>
          ))}
          {problem.age_groups.map((a) => (
            <Badge key={a} variant="outline">
              {AGE_GROUP_LABELS[a]}
            </Badge>
          ))}
          {problem.tags.map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={toggleVote}
            variant={voted ? "default" : "outline"}
            className="min-h-11"
            aria-pressed={voted}
          >
            <ArrowBigUp className="mr-1 h-4 w-4" aria-hidden="true" />
            {voted ? "This affects me" : "This affects me too"} (
            {problem.vote_count})
          </Button>
          <Button
            onClick={toggleBookmark}
            variant="outline"
            className="min-h-11"
            aria-pressed={bookmarked}
          >
            <Bookmark
              className={`mr-1 h-4 w-4 ${bookmarked ? "fill-current" : ""}`}
              aria-hidden="true"
            />
            {bookmarked ? "Saved" : "Save"}
          </Button>
        </div>

        <Separator className="my-8" />

        <div className="prose prose-slate max-w-none dark:prose-invert">
          <h2 className="font-heading text-xl font-semibold">The problem</h2>
          <p className="whitespace-pre-wrap">{problem.description}</p>

          {problem.existing_solutions && (
            <>
              <h2 className="font-heading text-xl font-semibold">
                Existing solutions
              </h2>
              <p className="whitespace-pre-wrap">{problem.existing_solutions}</p>
            </>
          )}
        </div>

        <Separator className="my-8" />

        <section aria-labelledby="discussion-heading">
          <h2
            id="discussion-heading"
            className="font-heading text-xl font-semibold text-foreground"
          >
            Discussion ({problem.comment_count})
          </h2>

          {user ? (
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
                  maxLength={5000}
                />
              </div>
              <Button
                type="submit"
                className="min-h-11"
                disabled={!newComment.trim() || posting}
              >
                {posting ? (
                  <>
                    <Loader2
                      className="mr-1 h-4 w-4 animate-spin"
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
                to={`/login?next=/problems/${problem.id}`}
                className="text-primary hover:underline"
              >
                Sign in
              </Link>{" "}
              to join the discussion.
            </p>
          )}

          {comments.length > 0 && (
            <ul className="mt-6 space-y-4" role="list">
              {comments.map((c) => (
                <li key={c.id}>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">
                          {nameFor(c.user_id)}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {formatDate(c.created_at)}
                          </span>
                        </p>
                        {user?.id === c.user_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete comment"
                            className="min-h-11 min-w-11"
                            onClick={() => deleteComment(c.id)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-foreground">
                        {c.body}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </Layout>
  );
};

export default ProblemDetail;
