import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowBigUp, MessageSquare, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import {
  DISABILITY_TYPES,
  DISABILITY_TYPE_LABELS,
  PROBLEM_STATUSES,
  PROBLEM_STATUS_LABELS,
  STATUS_VARIANTS,
  formatDate,
  type DisabilityType,
  type Problem,
  type ProblemStatus,
} from "@/lib/problems";

type ListedProblem = Pick<
  Problem,
  | "id"
  | "title"
  | "description"
  | "disability_types"
  | "category"
  | "country"
  | "status"
  | "tags"
  | "vote_count"
  | "comment_count"
  | "created_at"
>;

// Explicit column list: `select("*")` would also ship the tsvector search
// column to the browser on every row.
const LIST_COLUMNS =
  "id, title, description, disability_types, category, country, status, tags, vote_count, comment_count, created_at";

type SortKey = "recent" | "votes" | "discussed";

const Problems = () => {
  const { user } = useAuth();
  const [problems, setProblems] = useState<ListedProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [disability, setDisability] = useState<DisabilityType | "all">("all");
  const [status, setStatus] = useState<ProblemStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("problems").select(LIST_COLUMNS).limit(50);

    if (debouncedSearch) {
      // Rides the GIN index on search_vector rather than scanning with ILIKE.
      query = query.textSearch("search_vector", debouncedSearch, {
        type: "websearch",
        config: "english",
      });
    }
    if (disability !== "all") {
      query = query.contains("disability_types", [disability]);
    }
    if (status !== "all") {
      query = query.eq("status", status);
    }

    const column =
      sort === "votes"
        ? "vote_count"
        : sort === "discussed"
          ? "comment_count"
          : "created_at";
    query = query.order(column, { ascending: false });

    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      setProblems([]);
    } else {
      setProblems((data ?? []) as ListedProblem[]);
    }
    setLoading(false);
  }, [debouncedSearch, disability, status, sort]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Layout>
      <section className="container max-w-5xl py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">
              Problem repository
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Every documented disability challenge, in one place. Search before
              you build — someone may already be working on this.
            </p>
          </div>
          {user && (
            <Button asChild className="min-h-11">
              <Link to="/problems/new">
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                Report a problem
              </Link>
            </Button>
          )}
        </div>

        <div className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Label htmlFor="problem-search">Search</Label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="problem-search"
                className="pl-9"
                placeholder="e.g. wheelchair ramp"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="filter-disability">Disability</Label>
            <Select
              value={disability}
              onValueChange={(v) => setDisability(v as DisabilityType | "all")}
            >
              <SelectTrigger id="filter-disability" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All disabilities</SelectItem>
                {DISABILITY_TYPES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DISABILITY_TYPE_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ProblemStatus | "all")}
            >
              <SelectTrigger id="filter-status" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {PROBLEM_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PROBLEM_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-sort">Sort by</Label>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger id="filter-sort" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="votes">Most affected</SelectItem>
                <SelectItem value="discussed">Most discussed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {loading
            ? "Loading problems"
            : `${problems.length} problem${problems.length === 1 ? "" : "s"} found`}
        </p>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : problems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-muted-foreground">
              {debouncedSearch || disability !== "all" || status !== "all"
                ? "No problems match these filters."
                : "No problems documented yet."}
            </p>
            {user && (
              <Button asChild variant="outline" className="mt-4 min-h-11">
                <Link to="/problems/new">Report the first one</Link>
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-4" role="list">
            {problems.map((p) => (
              <li key={p.id}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-lg">
                        <Link
                          to={`/problems/${p.id}`}
                          className="hover:underline focus-visible:underline"
                        >
                          {p.title}
                        </Link>
                      </CardTitle>
                      <Badge variant={STATUS_VARIANTS[p.status]}>
                        {PROBLEM_STATUS_LABELS[p.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[p.category, p.country].filter(Boolean).join(" · ") ||
                        "Uncategorised"}{" "}
                      · {formatDate(p.created_at)}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 whitespace-pre-wrap text-foreground">
                      {p.description}
                    </p>

                    {(p.disability_types.length > 0 || p.tags.length > 0) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.disability_types.map((d) => (
                          <Badge key={d} variant="secondary">
                            {DISABILITY_TYPE_LABELS[d]}
                          </Badge>
                        ))}
                        {p.tags.slice(0, 4).map((t) => (
                          <Badge key={t} variant="outline">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ArrowBigUp className="h-4 w-4" aria-hidden="true" />
                        {p.vote_count} affected
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" aria-hidden="true" />
                        {p.comment_count}{" "}
                        {p.comment_count === 1 ? "comment" : "comments"}
                      </span>
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

export default Problems;
