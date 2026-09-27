import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
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
import { ArrowBigUp, Loader2, MessageSquare, Plus, RotateCw, Search } from "lucide-react";
import {
  DISABILITY_TYPES,
  DISABILITY_TYPE_LABELS,
  PROBLEM_SCOPE_LABELS,
  PROBLEM_STATUSES,
  PROBLEM_STATUS_LABELS,
  STATUS_VARIANTS,
  classifyLoadError,
  formatDate,
  mergeById,
  nextPageRange,
  resultsSummary,
  type DisabilityType,
  type Problem,
  type ProblemScope,
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

type Phase = "loading" | "ready" | "error" | "missing";

const SORT_COLUMNS: Record<SortKey, "created_at" | "vote_count" | "comment_count"> = {
  recent: "created_at",
  votes: "vote_count",
  discussed: "comment_count",
};

const Problems = () => {
  useDocumentTitle("Problem repository");
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [problems, setProblems] = useState<ListedProblem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [disability, setDisability] = useState<DisabilityType | "all">("all");
  const [status, setStatus] = useState<ProblemStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [scope, setScope] = useState<ProblemScope>("all");

  // Each full load gets a number; a response whose number is no longer the
  // latest belongs to filters the person has already changed, and is dropped.
  const generation = useRef(0);
  const savedIds = useRef<string[] | null>(null);
  const loadingMoreRef = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);
  const focusIndex = useRef<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // "Saved" and "Mine" only mean something while signed in.
  useEffect(() => {
    if (!authLoading && !userId) setScope("all");
  }, [authLoading, userId]);

  // Only "Saved" and "Mine" depend on who is signed in. Keeping the account out
  // of the "All" query means auth settling on page load does not refetch it.
  const scopeUserId = scope === "all" ? null : userId;
  const waitForAuth = scope !== "all" && (authLoading || !userId);

  const fetchPage = useCallback(
    (from: number, ids: string[] | null) => {
      let query = supabase.from("problems").select(LIST_COLUMNS, { count: "exact" });

      if (debouncedSearch) {
        // Rides the GIN index on search_vector rather than scanning with ILIKE.
        query = query.textSearch("search_vector", debouncedSearch, {
          type: "websearch",
          config: "english",
        });
      }
      if (disability !== "all") query = query.contains("disability_types", [disability]);
      if (status !== "all") query = query.eq("status", status);
      if (scope === "mine" && scopeUserId) query = query.eq("user_id", scopeUserId);
      if (scope === "saved" && ids) query = query.in("id", ids);

      // The id tiebreak keeps the order stable between pages when many rows
      // share a count, so "Load more" neither repeats nor skips them.
      const [start, end] = nextPageRange(from);
      return query
        .order(SORT_COLUMNS[sort], { ascending: false })
        .order("id", { ascending: false })
        .range(start, end);
    },
    [debouncedSearch, disability, status, sort, scope, scopeUserId],
  );

  useEffect(() => {
    if (waitForAuth) return;
    const gen = ++generation.current;
    setPhase("loading");
    setLoadMoreError(null);

    (async () => {
      let ids: string[] | null = null;
      if (scope === "saved" && scopeUserId) {
        const { data, error } = await supabase
          .from("problem_bookmarks")
          .select("problem_id")
          .eq("user_id", scopeUserId);
        if (gen !== generation.current) return;
        if (error) {
          setProblems([]);
          setTotal(null);
          setPhase(classifyLoadError(error) === "missing" ? "missing" : "error");
          return;
        }
        ids = (data ?? []).map((row) => row.problem_id);
        if (ids.length === 0) {
          savedIds.current = ids;
          setProblems([]);
          setTotal(0);
          setPhase("ready");
          return;
        }
      }
      savedIds.current = ids;

      const { data, error, count } = await fetchPage(0, ids);
      if (gen !== generation.current) return;
      if (error) {
        setProblems([]);
        setTotal(null);
        setPhase(classifyLoadError(error) === "missing" ? "missing" : "error");
        return;
      }
      setProblems((data ?? []) as ListedProblem[]);
      setTotal(count ?? null);
      setPhase("ready");
    })();

    return () => {
      // Unmounting or refiltering: whatever is in flight is now stale.
      generation.current += 1;
    };
  }, [fetchPage, scope, scopeUserId, waitForAuth, reloadKey]);

  const loadMore = async () => {
    if (loadingMoreRef.current) return;
    const gen = generation.current;
    const from = problems.length;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    const { data, error, count } = await fetchPage(from, savedIds.current);
    loadingMoreRef.current = false;
    setLoadingMore(false);
    if (gen !== generation.current) return;
    if (error) {
      setLoadMoreError("More problems could not be loaded. Please try again.");
      return;
    }
    focusIndex.current = from;
    setProblems((prev) => mergeById(prev, (data ?? []) as ListedProblem[]));
    if (count !== null && count !== undefined) setTotal(count);
  };

  // After "Load more", move focus to the first new problem so keyboard and
  // screen reader users carry on reading where the list grew.
  useEffect(() => {
    const index = focusIndex.current;
    if (index === null) return;
    focusIndex.current = null;
    const item = listRef.current?.children[index];
    item?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [problems]);

  const filtered = Boolean(debouncedSearch) || disability !== "all" || status !== "all";
  const hasMore = phase === "ready" && total !== null && problems.length < total;

  const emptyState = () => {
    if (filtered) {
      return <p className="text-muted-foreground">No problems match these filters.</p>;
    }
    if (scope === "saved") {
      return (
        <p className="text-muted-foreground">
          You have not saved any problems yet. Use Save on a problem to keep it here.
        </p>
      );
    }
    if (scope === "mine") {
      return (
        <>
          <p className="text-muted-foreground">You have not reported any problems yet.</p>
          <Button asChild variant="outline" className="mt-4 min-h-11">
            <Link to="/problems/new">Report a problem</Link>
          </Button>
        </>
      );
    }
    return (
      <>
        <p className="text-muted-foreground">No problems documented yet.</p>
        {user && (
          <Button asChild variant="outline" className="mt-4 min-h-11">
            <Link to="/problems/new">Report the first one</Link>
          </Button>
        )}
      </>
    );
  };

  return (
    <Layout>
      <section className="container max-w-5xl py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">
              Problem repository
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Disability challenges documented by the community, in one place.
              Search before you build — someone may already be working on this.
            </p>
          </div>
          {phase !== "missing" &&
            (user ? (
              <Button asChild className="min-h-11">
                <Link to="/problems/new">
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                  Report a problem
                </Link>
              </Button>
            ) : (
              !authLoading && (
                <Button asChild variant="outline" className="min-h-11">
                  <Link to={`/login?next=${encodeURIComponent("/problems/new")}`}>
                    Sign in to report a problem
                  </Link>
                </Button>
              )
            ))}
        </div>

        {phase === "missing" ? (
          <FeatureUnavailable feature="The problem repository" headingLevel="h2" />
        ) : (
          <>
            <div
              className={`mb-6 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 ${
                user ? "lg:grid-cols-5" : "lg:grid-cols-4"
              }`}
            >
              <div className="sm:col-span-2 lg:col-span-1">
                <Label htmlFor="problem-search">Search</Label>
                <div className="relative mt-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="problem-search"
                    type="search"
                    className="min-h-11 pl-9"
                    placeholder="e.g. wheelchair ramp"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {user && (
                <div>
                  <Label htmlFor="filter-scope">Show</Label>
                  <Select value={scope} onValueChange={(v) => setScope(v as ProblemScope)}>
                    <SelectTrigger id="filter-scope" className="mt-1 min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PROBLEM_SCOPE_LABELS) as ProblemScope[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {PROBLEM_SCOPE_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="filter-disability">Disability</Label>
                <Select
                  value={disability}
                  onValueChange={(v) => setDisability(v as DisabilityType | "all")}
                >
                  <SelectTrigger id="filter-disability" className="mt-1 min-h-11">
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
                  <SelectTrigger id="filter-status" className="mt-1 min-h-11">
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
                  <SelectTrigger id="filter-sort" className="mt-1 min-h-11">
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
              {phase === "loading"
                ? "Loading problems"
                : phase === "ready"
                  ? resultsSummary(problems.length, total)
                  : ""}
            </p>

            {phase === "loading" ? (
              <div className="space-y-4" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-xl" />
                ))}
              </div>
            ) : phase === "error" ? (
              <div
                role="alert"
                className="rounded-xl border border-destructive/50 py-12 text-center"
              >
                <p className="font-medium text-foreground">The problems could not be loaded.</p>
                <p className="mt-1 text-muted-foreground">
                  Check your connection and try again.
                </p>
                <Button
                  variant="outline"
                  className="mt-4 min-h-11"
                  onClick={() => setReloadKey((k) => k + 1)}
                >
                  <RotateCw className="mr-1 h-4 w-4" aria-hidden="true" />
                  Try again
                </Button>
              </div>
            ) : problems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-16 text-center">
                {emptyState()}
              </div>
            ) : (
              <>
                {total !== null && total > problems.length && (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Showing {problems.length} of {total}
                  </p>
                )}
                <ul ref={listRef} className="space-y-4" role="list">
                  {problems.map((p) => (
                    <li key={p.id}>
                      <Card className="transition-shadow hover:shadow-md motion-reduce:transition-none">
                        <CardHeader className="pb-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <CardTitle className="min-w-0 break-words text-lg [overflow-wrap:anywhere]">
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
                          <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                            {[p.category, p.country].filter(Boolean).join(" · ") ||
                              "Uncategorised"}{" "}
                            · {formatDate(p.created_at)}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <p className="line-clamp-3 whitespace-pre-wrap break-words text-foreground [overflow-wrap:anywhere]">
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
                                <Badge key={t} variant="outline" className="break-all">
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

                <div className="mt-6 flex flex-col items-center gap-2">
                  <div role="alert">
                    {loadMoreError && (
                      <p className="text-sm font-medium text-destructive">{loadMoreError}</p>
                    )}
                  </div>
                  {hasMore && (
                    <Button
                      variant="outline"
                      className="min-h-11"
                      aria-disabled={loadingMore}
                      onClick={() => void loadMore()}
                    >
                      {loadingMore ? (
                        <>
                          <Loader2
                            className="mr-1 h-4 w-4 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                          Loading more...
                        </>
                      ) : (
                        `Load more (${(total ?? 0) - problems.length} more)`
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </Layout>
  );
};

export default Problems;
