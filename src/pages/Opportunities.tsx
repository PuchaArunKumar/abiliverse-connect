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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Loader2, Plus, ExternalLink, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Kind = "event" | "opportunity" | "guidance";
interface EventItem {
  id: string; user_id: string; kind: Kind; title: string; description: string;
  starts_at: string | null; location: string; link: string; created_at: string;
}

const kindLabel: Record<Kind, string> = { event: "Event", opportunity: "Opportunity", guidance: "Guidance" };

const Opportunities = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "event" as Kind, title: "", description: "", starts_at: "", location: "", link: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data ?? []) as EventItem[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!user) return;
    const { error } = await supabase.from("events").insert({
      user_id: user.id, kind: form.kind, title: form.title, description: form.description,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      location: form.location, link: form.link,
    });
    if (error) return toast.error(error.message);
    toast.success("Shared with the community");
    setOpen(false);
    setForm({ kind: "event", title: "", description: "", starts_at: "", location: "", link: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((e) => e.id !== id));
  };

  const shown = filter === "all" ? items : items.filter((i) => i.kind === filter);

  return (
    <Layout>
      <section className="container max-w-4xl py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold">Events, Opportunities & Guidance</h1>
            <p className="text-muted-foreground">Share meetups, scholarships, mentorship offers, and helpful advice.</p>
          </div>
          {user && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="min-h-11"><Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Share</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Share with the community</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="e-kind">Type</Label>
                    <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Kind })}>
                      <SelectTrigger id="e-kind"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="event">Event / Meetup</SelectItem>
                        <SelectItem value="opportunity">Opportunity</SelectItem>
                        <SelectItem value="guidance">Guidance / Advice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label htmlFor="e-title">Title</Label><Input id="e-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div><Label htmlFor="e-desc">Description</Label><Textarea id="e-desc" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  {form.kind === "event" && (
                    <>
                      <div><Label htmlFor="e-date">Date & time</Label><Input id="e-date" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                      <div><Label htmlFor="e-loc">Location</Label><Input id="e-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                    </>
                  )}
                  <div><Label htmlFor="e-link">Link (optional)</Label><Input id="e-link" placeholder="https://..." value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={submit} disabled={!form.title || !form.description}>Share</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="event">Events</TabsTrigger>
            <TabsTrigger value="opportunity">Opportunities</TabsTrigger>
            <TabsTrigger value="guidance">Guidance</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : shown.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="space-y-4" role="list">
            {shown.map((e) => (
              <li key={e.id}>
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Badge className="mb-2" variant="secondary">{kindLabel[e.kind]}</Badge>
                        <CardTitle className="flex items-start gap-2">
                          <Calendar className="h-5 w-5 text-primary shrink-0 mt-1" aria-hidden="true" />
                          {e.title}
                        </CardTitle>
                        {e.starts_at && <p className="mt-1 text-sm text-muted-foreground">{format(new Date(e.starts_at), "PPp")}</p>}
                        {e.location && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden="true" /> {e.location}</p>}
                      </div>
                      {user?.id === e.user_id && (
                        <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(e.id)} className="min-h-11 min-w-11">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{e.description}</p>
                    {e.link && (
                      <div className="mt-4">
                        <Button asChild variant="outline" size="sm" className="min-h-11">
                          <a href={e.link} target="_blank" rel="noopener noreferrer">Open link <ExternalLink className="h-4 w-4 ml-1" aria-hidden="true" /></a>
                        </Button>
                      </div>
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

export default Opportunities;