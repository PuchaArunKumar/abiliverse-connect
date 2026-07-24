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
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Briefcase, MapPin, Loader2, Plus, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Job {
  id: string; user_id: string; title: string; company: string; location: string;
  description: string; accessibility_tags: string[]; apply_url: string; remote: boolean; created_at: string;
}

const Jobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [openPost, setOpenPost] = useState(false);
  const [form, setForm] = useState({ title: "", company: "", location: "", description: "", apply_url: "", tags: "", remote: false });
  const [applying, setApplying] = useState<string | null>(null);
  const [coverNote, setCoverNote] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setJobs(data ?? []);
    if (user) {
      const { data: apps } = await supabase.from("job_applications").select("job_id").eq("user_id", user.id);
      setApplied(new Set((apps ?? []).map((a) => a.job_id)));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const submitJob = async () => {
    if (!user) return;
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("jobs").insert({
      user_id: user.id, title: form.title, company: form.company, location: form.location,
      description: form.description, apply_url: form.apply_url, accessibility_tags: tags, remote: form.remote,
    });
    if (error) return toast.error(error.message);
    toast.success("Job posted");
    setOpenPost(false);
    setForm({ title: "", company: "", location: "", description: "", apply_url: "", tags: "", remote: false });
    load();
  };

  const submitApplication = async (jobId: string) => {
    if (!user) return;
    const { error } = await supabase.from("job_applications").insert({ job_id: jobId, user_id: user.id, cover_note: coverNote });
    if (error) return toast.error(error.message);
    toast.success("Application submitted");
    setApplied((s) => new Set(s).add(jobId));
    setApplying(null);
    setCoverNote("");
  };

  const deleteJob = async (id: string) => {
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  return (
    <Layout>
      <section className="container max-w-4xl py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold">Jobs & Opportunities</h1>
            <p className="text-muted-foreground">Accessibility-friendly roles from inclusive employers.</p>
          </div>
          {user && (
            <Dialog open={openPost} onOpenChange={setOpenPost}>
              <DialogTrigger asChild>
                <Button className="min-h-11"><Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Post a job</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Post a job</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label htmlFor="j-title">Title</Label><Input id="j-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div><Label htmlFor="j-company">Company</Label><Input id="j-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                  <div><Label htmlFor="j-loc">Location</Label><Input id="j-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                  <div><Label htmlFor="j-desc">Description</Label><Textarea id="j-desc" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div><Label htmlFor="j-url">Apply URL (optional)</Label><Input id="j-url" placeholder="https://..." value={form.apply_url} onChange={(e) => setForm({ ...form, apply_url: e.target.value })} /></div>
                  <div><Label htmlFor="j-tags">Accessibility tags (comma separated)</Label><Input id="j-tags" placeholder="screen-reader-friendly, wheelchair-accessible" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
                  <div className="flex items-center gap-2"><Switch id="j-remote" checked={form.remote} onCheckedChange={(v) => setForm({ ...form, remote: v })} /><Label htmlFor="j-remote">Remote</Label></div>
                </div>
                <DialogFooter><Button onClick={submitJob} disabled={!form.title || !form.company || !form.description}>Post</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : jobs.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No jobs posted yet.</p>
        ) : (
          <ul className="space-y-4" role="list">
            {jobs.map((j) => (
              <li key={j.id}>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" aria-hidden="true" /> {j.title}</CardTitle>
                        <p className="mt-1 text-muted-foreground">{j.company}</p>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" aria-hidden="true" /> {j.location || "—"} {j.remote && <Badge variant="secondary" className="ml-1">Remote</Badge>}
                        </p>
                      </div>
                      {user?.id === j.user_id && (
                        <Button variant="ghost" size="icon" aria-label="Delete job" onClick={() => deleteJob(j.id)} className="min-h-11 min-w-11">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{j.description}</p>
                    {j.accessibility_tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {j.accessibility_tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {j.apply_url && (
                        <Button asChild variant="outline" className="min-h-11">
                          <a href={j.apply_url} target="_blank" rel="noopener noreferrer">External <ExternalLink className="h-4 w-4 ml-1" aria-hidden="true" /></a>
                        </Button>
                      )}
                      {user && (
                        applied.has(j.id)
                          ? <Button disabled className="min-h-11">Applied</Button>
                          : applying === j.id ? (
                            <div className="w-full space-y-2">
                              <Label htmlFor={`cn-${j.id}`}>Short note to the poster (optional)</Label>
                              <Textarea id={`cn-${j.id}`} rows={3} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} />
                              <div className="flex gap-2">
                                <Button onClick={() => submitApplication(j.id)} className="min-h-11">Submit</Button>
                                <Button variant="outline" onClick={() => { setApplying(null); setCoverNote(""); }} className="min-h-11">Cancel</Button>
                              </div>
                            </div>
                          ) : <Button onClick={() => setApplying(j.id)} className="min-h-11">Easy apply</Button>
                      )}
                    </div>
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

export default Jobs;