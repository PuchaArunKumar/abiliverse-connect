import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Search } from "lucide-react";
import Layout from "@/components/layout/Layout";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import PitchCard from "@/components/pitches/PitchCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mergeById, nextPageRange } from "@/lib/problems";
import { isMissingSchemaError } from "@/lib/supabase-errors";
import {
  PITCHES_PAGE_SIZE,
  PITCH_LIST_COLUMNS,
  PITCH_NEEDS,
  PITCH_NEED_LABELS,
  PITCH_SORTS,
  PITCH_SORT_COLUMNS,
  PITCH_SORT_LABELS,
  PITCH_STAGES,
  PITCH_STAGE_LABELS,
  friendlyPitchError,
  hasMorePitches,
  isPitchNeed,
  isPitchStage,
  pitchResultsSummary,
  pitchTitleId,
  type ListedPitch,
  type PitchNeed,
  type PitchSort,
  type PitchStage,
} from "@/lib/pitches";

type LoadState = "loading" | "ready" | "error" | "missing";

const PITCH_SORT_SET = new Set<string>(PITCH_SORTS);

const Pitches = () => {
  useDocumentTitle("Pitch Platform");
  const { user, loading: authLoading } = useAuth();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stage, setStage] = useState<PitchStage | "all">("all");
  const [need, setNeed] = useState<PitchNeed | "all">("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState<PitchSort>("newest");

  const [pitches, setPitches] = useState<ListedPitch[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Every first-page load takes a new id; a response whose id is no longer the
  // latest belongs to filters the person has since changed and is dropped.
  const requestRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const focusPitchAfterLoad = useRef<string | null>(null);
  const focusResultsAfterLoad = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const buildQuery = useCallback(
    (from: number, to: number) => {
      let query = supabase
        .from("pitches")
        .select(PITCH_LIST_COLUMNS, { count: "exact" });
      if (debouncedSearch) {
        // Rides the GIN index on search_vector rather than scanning with ILIKE.
        query = query.textSearch("search_vector", debouncedSearch, {
          type: "websearch",
          config: "english",
        });
      }
      if (stage !== "all") query = query.eq("stage", stage);
      if (need !== "all") query = query.contains("needs", [need]);
      if (openOnly) query = query.eq("is_open", true);
      query = query.order(PITCH_SORT_COLUMNS[sort], { ascending: false });
      // Tie-breakers keep the order stable between pages, so "Load more"
      // neither repeats nor skips pitches with equal counts.
      if (sort !== "newest") query = query.order("created_at", { ascending: false });
      return query.order("id", { ascending: false }).range(from, to);
    },
    [debouncedSearch, stage, need, openOnly, sort],
  );

  useEffect(() => {
    const requestId = ++requestRef.current;
    setState("loading");
    setMoreError(null);
    loadingMoreRef.current = false;
    setLoadingMore(false);
    void (async () => {
      const { data, error, count } = await buildQuery(0, PITCHES_PAGE_SIZE - 1);
      if (requestId !== requestRef.current) return;
      if (error) {
        setPitches([]);
        setTotal(null);
        setState(isMissingSchemaError(error) ? "missing" : "error");
        return;
      }
      setPitches(data ?? []);
      setTotal(count ?? null);
      setState("ready");
    })();
  }, [buildQuery, reloadTick]);

  // Focus moves only after the rows it points at have rendered.
  useEffect(() => {
    if (focusPitchAfterLoad.current) {
      document.getElementById(pitchTitleId(focusPitchAfterLoad.current))?.focus();
      focusPitchAfterLoad.current = null;
    }
  }, [pitches]);

  useEffect(() => {
    if (state === "loading" || !focusResultsAfterLoad.current) return;
    focusResultsAfterLoad.current = false;
    resultsRef.current?.focus();
  }, [state]);

  const loadMore = async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setMoreError(null);
    const requestId = requestRef.current;
    const [from, to] = nextPageRange(pitches.length, PITCHES_PAGE_SIZE);
    const { data, error, count } = await buildQuery(from, to);
    // The filters changed while this page loaded; the new first page wins.
    if (requestId !== requestRef.current) return;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    if (error) {
      setMoreError(
        friendlyPitchError(error, "More pitches could not be loaded. Please try again."),
      );
      return;
    }
    const incoming = data ?? [];
    const shown = new Set(pitches.map((p) => p.id));
    const firstNew = incoming.find((row) => !shown.has(row.id));
    // Move focus to the first new pitch, so a keyboard or screen reader user
    // carries on reading where the list grew instead of back at the button.
    if (firstNew) focusPitchAfterLoad.current = firstNew.id;
    setPitches((prev) => mergeById(prev, incoming));
    if (count !== null && count !== undefined) setTotal(count);
  };

  const retry = () => {
    focusResultsAfterLoad.current = true;
    setReloadTick((t) => t + 1);
  };

  const filtersActive =
    Boolean(debouncedSearch) || stage !== "all" || need !== "all" || openOnly;

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStage("all");
    setNeed("all");
    setOpenOnly(false);
    // The "Clear filters" button disappears with the empty state.
    searchRef.current?.focus();
  };

  if (state === "missing") {
    return (
      <Layout>
        <section className="container py-16">
          <FeatureUnavailable feature="The Pitch Platform" headingLevel="h1" />
        </section>
      </Layout>
    );
  }

  const statusText =
    state === "loading"
      ? "Loading pitches"
      : state === "ready"
        ? pitchResultsSummary(pitches.length, total)
        : "";

  return (
    <Layout>
      <section className="container max-w-5xl py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold text-foreground">
              Pitch Platform
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Assistive technology ideas from the community. Back the ones you
              would use, leave feedback, or offer funding, mentoring or testing.
              Abilitiverse introduces people to each other; it does not process
              payments.
            </p>
          </div>
          {user ? (
            <Button asChild className="min-h-11">
              <Link to="/pitches/new">
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                Submit a pitch
              </Link>
            </Button>
          ) : authLoading ? null : (
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/login?next=/pitches/new">Sign in to submit a pitch</Link>
            </Button>
          )}
        </div>

        <div
          role="search"
          aria-label="Search and filter pitches"
          className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="sm:col-span-2 lg:col-span-4">
            <Label htmlFor="pitch-search">Search pitches</Label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={searchRef}
                id="pitch-search"
                type="search"
                className="min-h-11 pl-9"
                placeholder="e.g. screen reader for maths"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pitch-filter-stage">Stage</Label>
            <Select
              value={stage}
              onValueChange={(v) => setStage(isPitchStage(v) ? v : "all")}
            >
              <SelectTrigger id="pitch-filter-stage" className="mt-1 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any stage</SelectItem>
                {PITCH_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PITCH_STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pitch-filter-need">Looking for</Label>
            <Select
              value={need}
              onValueChange={(v) => setNeed(isPitchNeed(v) ? v : "all")}
            >
              <SelectTrigger id="pitch-filter-need" className="mt-1 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anything</SelectItem>
                {PITCH_NEEDS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {PITCH_NEED_LABELS[n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pitch-sort">Sort by</Label>
            <Select
              value={sort}
              onValueChange={(v) => {
                if (PITCH_SORT_SET.has(v)) setSort(v as PitchSort);
              }}
            >
              <SelectTrigger id="pitch-sort" className="mt-1 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PITCH_SORTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PITCH_SORT_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-h-11 items-center gap-3 self-end">
            <Checkbox
              id="pitch-open-only"
              checked={openOnly}
              onCheckedChange={(checked) => setOpenOnly(checked === true)}
            />
            <Label htmlFor="pitch-open-only" className="cursor-pointer py-3 font-normal">
              Only pitches open to new interest
            </Label>
          </div>
        </div>

        <p role="status" className="sr-only">
          {statusText}
        </p>

        {/* Focus lands here after "Try again", whose button may not survive
            the reload. */}
        <div ref={resultsRef} tabIndex={-1} className="outline-none">
          {state === "loading" ? (
            <div className="space-y-4" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </div>
          ) : state === "error" ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/50 px-6 py-10 text-center"
            >
              <p className="font-medium text-foreground">
                Pitches could not be loaded. Check your connection and try again.
              </p>
              <Button variant="outline" className="mt-4 min-h-11" onClick={retry}>
                Try again
              </Button>
            </div>
          ) : pitches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
              <p className="text-muted-foreground">
                {filtersActive
                  ? "No pitches match these filters."
                  : "No pitches have been shared yet."}
              </p>
              {filtersActive ? (
                <Button variant="outline" className="mt-4 min-h-11" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : user ? (
                <Button asChild variant="outline" className="mt-4 min-h-11">
                  <Link to="/pitches/new">Share the first pitch</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <ul className="space-y-4" role="list">
                {pitches.map((pitch) => (
                  <li key={pitch.id}>
                    <PitchCard pitch={pitch} />
                  </li>
                ))}
              </ul>

              {hasMorePitches(pitches.length, total) && (
                <div className="mt-6 flex flex-col items-center gap-2">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={loadMore}
                    aria-disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2
                          className="mr-1 h-4 w-4 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                        Loading more pitches…
                      </>
                    ) : (
                      "Load more pitches"
                    )}
                  </Button>
                  <div role="alert">
                    {moreError && (
                      <p className="text-sm font-medium text-destructive">{moreError}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Pitches;
