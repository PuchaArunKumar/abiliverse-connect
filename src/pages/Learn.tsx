import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { GraduationCap, Loader2, Plus, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Course {
  id: string; user_id: string; title: string; description: string; provider: string;
  url: string; level: "beginner"|"intermediate"|"advanced"; tags: string[]; created_at: string;
}

const Learn = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", provider: "", url: "", level: "beginner", tags: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setCourses((data ?? []) as Course[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!user) return;
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("courses").insert({
      user_id: user.id, title: form.title, description: form.description, provider: form.provider,
      url: form.url, level: form.level, tags,
    });
    if (error) return toast.error(error.message);
    toast.success("Course added");
    setOpen(false);
    setForm({ title: "", description: "", provider: "", url: "", level: "beginner", tags: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <Layout>
      <section className="container max-w-4xl py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold">Learning Hub</h1>
            <p className="text-muted-foreground">Courses, tutorials, and resources shared by the community.</p>
          </div>
          {user && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="min-h-11"><Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Share a resource</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Share a learning resource</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label htmlFor="c-title">Title</Label><Input id="c-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div><Label htmlFor="c-desc">Description</Label><Textarea id="c-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div><Label htmlFor="c-prov">Provider</Label><Input id="c-prov" placeholder="Coursera, YouTube, ..." value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
                  <div><Label htmlFor="c-url">URL</Label><Input id="c-url" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
                  <div>
                    <Label htmlFor="c-level">Level</Label>
                    <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                      <SelectTrigger id="c-level"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label htmlFor="c-tags">Tags (comma separated)</Label><Input id="c-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={submit} disabled={!form.title || !form.description}>Share</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : courses.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No resources yet.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2" role="list">
            {courses.map((c) => (
              <li key={c.id}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="flex items-start gap-2"><GraduationCap className="h-5 w-5 text-primary shrink-0 mt-1" aria-hidden="true" /> {c.title}</CardTitle>
                      {user?.id === c.user_id && (
                        <Button variant="ghost" size="icon" aria-label="Delete resource" onClick={() => remove(c.id)} className="min-h-11 min-w-11">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                    {c.provider && <p className="text-sm text-muted-foreground">{c.provider}</p>}
                  </CardHeader>
                  <CardContent>
                    <p className="mb-3 text-sm whitespace-pre-wrap">{c.description}</p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="capitalize">{c.level}</Badge>
                      {c.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                    </div>
                    {c.url && (
                      <Button asChild variant="outline" size="sm" className="min-h-11">
                        <a href={c.url} target="_blank" rel="noopener noreferrer">Open <ExternalLink className="h-4 w-4 ml-1" aria-hidden="true" /></a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
};

export default Learn;