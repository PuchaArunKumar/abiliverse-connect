import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Heart, MessageCircle, Loader2, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Profile { display_name: string; avatar_url: string }
interface Post {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: Profile;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
}
interface Comment {
  id: string; post_id: string; user_id: string; body: string; created_at: string; profile?: Profile;
}

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, Comment[] | undefined>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data: postRows, error } = await supabase
      .from("posts").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) { toast.error("Could not load posts"); setLoading(false); return; }
    const ids = (postRows ?? []).map((p) => p.id);
    const userIds = Array.from(new Set((postRows ?? []).map((p) => p.user_id)));

    const [profilesRes, likesRes, commentsCountRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("user_id,display_name,avatar_url").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabase.from("post_likes").select("post_id,user_id").in("post_id", ids) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabase.from("post_comments").select("post_id").in("post_id", ids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const profileMap = new Map<string, Profile>();
    (profilesRes.data ?? []).forEach((p: any) => profileMap.set(p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }));
    const likesByPost = new Map<string, string[]>();
    (likesRes.data ?? []).forEach((l: any) => {
      const arr = likesByPost.get(l.post_id) ?? [];
      arr.push(l.user_id);
      likesByPost.set(l.post_id, arr);
    });
    const commentsByPost = new Map<string, number>();
    (commentsCountRes.data ?? []).forEach((c: any) => {
      commentsByPost.set(c.post_id, (commentsByPost.get(c.post_id) ?? 0) + 1);
    });

    const hydrated: Post[] = (postRows ?? []).map((p) => ({
      ...p,
      profile: profileMap.get(p.user_id),
      like_count: (likesByPost.get(p.id) ?? []).length,
      liked_by_me: !!user && (likesByPost.get(p.id) ?? []).includes(user.id),
      comment_count: commentsByPost.get(p.id) ?? 0,
    }));
    setPosts(hydrated);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const submitPost = async () => {
    if (!user) return;
    const body = draft.trim();
    if (!body) return;
    setSubmitting(true);
    const { error } = await supabase.from("posts").insert({ user_id: user.id, body });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setDraft("");
    load();
  };

  const toggleLike = async (p: Post) => {
    if (!user) return;
    if (p.liked_by_me) {
      await supabase.from("post_likes").delete().eq("post_id", p.id).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ post_id: p.id, user_id: user.id });
    }
    setPosts((prev) => prev.map((x) => x.id === p.id
      ? { ...x, liked_by_me: !p.liked_by_me, like_count: x.like_count + (p.liked_by_me ? -1 : 1) }
      : x));
  };

  const deletePost = async (id: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const openComment = async (postId: string) => {
    if (openComments[postId] !== undefined) {
      setOpenComments((s) => ({ ...s, [postId]: undefined }));
      return;
    }
    const { data } = await supabase.from("post_comments").select("*").eq("post_id", postId).order("created_at");
    const userIds = Array.from(new Set((data ?? []).map((c: any) => c.user_id)));
    let profileMap = new Map<string, Profile>();
    if (userIds.length) {
      const { data: pr } = await supabase.from("profiles").select("user_id,display_name,avatar_url").in("user_id", userIds);
      (pr ?? []).forEach((p: any) => profileMap.set(p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }));
    }
    setOpenComments((s) => ({ ...s, [postId]: (data ?? []).map((c: any) => ({ ...c, profile: profileMap.get(c.user_id) })) }));
  };

  const submitComment = async (postId: string) => {
    if (!user) return;
    const body = (commentDraft[postId] ?? "").trim();
    if (!body) return;
    const { data, error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, body }).select().single();
    if (error) return toast.error(error.message);
    setCommentDraft((s) => ({ ...s, [postId]: "" }));
    setOpenComments((s) => ({ ...s, [postId]: [...(s[postId] ?? []), data as Comment] }));
    setPosts((prev) => prev.map((x) => x.id === postId ? { ...x, comment_count: x.comment_count + 1 } : x));
  };

  return (
    <Layout>
      <section className="container max-w-2xl py-8">
        <h1 className="mb-2 font-heading text-3xl font-bold">Community Feed</h1>
        <p className="mb-6 text-muted-foreground">Share knowledge, ask questions, and support each other.</p>

        {user && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <label htmlFor="post-body" className="sr-only">Write a post</label>
              <Textarea
                id="post-body"
                placeholder="Share something with the community..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={5000}
              />
              <div className="mt-3 flex justify-end">
                <Button onClick={submitPost} disabled={submitting || !draft.trim()} className="min-h-11">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : posts.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No posts yet. Be the first!</p>
        ) : (
          <ul className="space-y-4" role="list">
            {posts.map((p) => {
              const name = p.profile?.display_name || "Community member";
              const comments = openComments[p.id];
              return (
                <li key={p.id}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        {user?.id === p.user_id && (
                          <Button variant="ghost" size="icon" aria-label="Delete post" onClick={() => deletePost(p.id)} className="min-h-11 min-w-11">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap">{p.body}</p>
                      <div className="mt-4 flex items-center gap-2 border-t pt-3">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => toggleLike(p)}
                          aria-pressed={p.liked_by_me}
                          aria-label={`${p.liked_by_me ? "Unlike" : "Like"} post. ${p.like_count} likes.`}
                          className="min-h-11"
                        >
                          <Heart className={`h-4 w-4 mr-1 ${p.liked_by_me ? "fill-primary text-primary" : ""}`} aria-hidden="true" />
                          {p.like_count}
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => openComment(p.id)}
                          aria-expanded={comments !== undefined}
                          className="min-h-11"
                        >
                          <MessageCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                          {p.comment_count}
                        </Button>
                      </div>

                      {comments !== undefined && (
                        <div className="mt-4 space-y-3 border-t pt-3">
                          {comments.map((c) => (
                            <div key={c.id} className="flex gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-sm">
                                {(c.profile?.display_name || "?").charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 rounded-lg bg-muted px-3 py-2">
                                <p className="text-sm font-medium">{c.profile?.display_name || "Member"}</p>
                                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                              </div>
                            </div>
                          ))}
                          {user && (
                            <div className="flex gap-2">
                              <label htmlFor={`c-${p.id}`} className="sr-only">Add a comment</label>
                              <Textarea
                                id={`c-${p.id}`}
                                placeholder="Add a comment..."
                                rows={1}
                                value={commentDraft[p.id] ?? ""}
                                onChange={(e) => setCommentDraft((s) => ({ ...s, [p.id]: e.target.value }))}
                                className="min-h-11"
                              />
                              <Button
                                size="icon"
                                aria-label="Send comment"
                                onClick={() => submitComment(p.id)}
                                disabled={!(commentDraft[p.id] ?? "").trim()}
                                className="min-h-11 min-w-11"
                              >
                                <Send className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Layout>
  );
};

export default Feed;
