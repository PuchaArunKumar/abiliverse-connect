import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Briefcase, CalendarDays, HandCoins, MapPin, type LucideIcon } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ExternalLinkButton from "@/components/community/ExternalLinkButton";
import FilterRadioGroup from "@/components/community/FilterRadioGroup";
import InlineLoading from "@/components/community/InlineLoading";
import LoadProblem from "@/components/community/LoadProblem";
import { plural } from "@/components/community/format";
import {
  daysUntil,
  loadRadarFeed,
  localToday,
  sortRadar,
  type RadarFeed,
  type RadarItem,
  type RadarKind,
} from "@/lib/radar";

type Filter = "all" | RadarKind;
type LoadState = "loading" | "ready" | "error";

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "job", label: "Jobs" },
  { value: "event", label: "Events" },
  { value: "grant", label: "Funding" },
] as const;

const GROUPS: { kind: RadarKind; heading: string; badge: string; icon: LucideIcon; empty: string }[] = [
  { kind: "job", heading: "Jobs in assistive technology", badge: "Job", icon: Briefcase, empty: "No open jobs this week." },
  { kind: "event", heading: "Events and deadlines", badge: "Event", icon: CalendarDays, empty: "No upcoming events this week." },
  { kind: "grant", heading: "Funding and programmes", badge: "Funding", icon: HandCoins, empty: "No open funding calls this week." },
];

const linkClass = "font-medium text-primary underline underline-offset-4";

function day(iso: string): string {
  return format(new Date(`${iso}T00:00:00`), "d MMM yyyy");
}

/** "Closes in 5 days" for anything due within three weeks, otherwise the date. */
function deadlineText(deadline: string, today: string): string {
  const days = daysUntil(deadline, today);
  if (days <= 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  if (days <= 21) return `Closes in ${days} days (${day(deadline)})`;
  return `Deadline ${day(deadline)}`;
}

const RadarCard = ({ item, today, badge, Icon }: { item: RadarItem; today: string; badge: string; Icon: LucideIcon }) => {
  const titleId = `radar-${item.id}-title`;
  const urgent = item.deadline !== undefined && daysUntil(item.deadline, today) <= 7;
  return (
    <article aria-labelledby={titleId}>
      <Card>
        <CardHeader>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{badge}</Badge>
            {item.deadline && (
              <Badge variant={urgent ? "destructive" : "outline"}>
                <time dateTime={item.deadline}>{deadlineText(item.deadline, today)}</time>
              </Badge>
            )}
          </div>
          <CardTitle id={titleId} className="flex items-start gap-2 text-xl leading-snug [overflow-wrap:anywhere]">
            <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">{item.title}</span>
          </CardTitle>
          {item.org && <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{item.org}</p>}
          {item.date && (
            <p className="mt-1 text-sm text-muted-foreground">
              <time dateTime={item.date}>{day(item.date)}</time>
              {item.dateEnd && item.dateEnd !== item.date && (
                <>
                  {" "}to <time dateTime={item.dateEnd}>{day(item.dateEnd)}</time>
                </>
              )}
            </p>
          )}
          {item.location && (
            <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">Location: </span>
              {item.location}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {item.summary && <p className="[overflow-wrap:anywhere]">{item.summary}</p>}
          {item.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" role="list" aria-label="Tags">
              {item.tags.map((tag) => (
                <li key={tag} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {tag}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <ExternalLinkButton href={item.url} size="sm">
              Open listing
              <span className="sr-only"> for {item.title}</span>
            </ExternalLinkButton>
          </div>
        </CardContent>
      </Card>
    </article>
  );
};

const Radar = () => {
  useDocumentTitle("Opportunity Radar");
  const [today] = useState(localToday);
  const [feed, setFeed] = useState<RadarFeed | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retrying, setRetrying] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      setFeed(await loadRadarFeed(today));
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async () => {
    setRetrying(true);
    await load();
    setRetrying(false);
  };

  const items = feed?.items ?? [];
  const groups = GROUPS.filter((group) => filter === "all" || group.kind === filter);

  return (
    <Layout>
      <section className="container max-w-4xl py-8">
        <div className="mb-6">
          <h1 className="font-heading text-3xl font-bold">Opportunity Radar</h1>
          <p className="text-muted-foreground">
            Jobs, events and funding calls in assistive technology, gathered every week.
          </p>
        </div>

        <p className="mb-6 max-w-prose text-sm text-muted-foreground">
          Every Monday an AI research agent searches the web for openings in assistive technology,
          opens each link to check that it is real and still open, and lists what it finds here. It
          can still get details wrong, so check the organiser's page before you apply. Know of
          something we missed? Share it on{" "}
          <Link to="/opportunities" className={linkClass}>
            Opportunities
          </Link>
          .
        </p>

        {loadState === "loading" ? (
          <InlineLoading label="Loading the radar…" />
        ) : loadState === "error" ? (
          <LoadProblem
            message="We could not load the radar. Check your connection and try again."
            onRetry={retry}
            retrying={retrying}
          />
        ) : (
          <>
            <p aria-live="polite" className="mb-4 text-sm text-muted-foreground">
              {plural(items.length, "open listing", "open listings")}
              {feed?.updated && <> · updated {day(feed.updated)}</>}
              {feed?.nextRun && <> · next update {feed.nextRun}</>}
            </p>

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-muted-foreground">
                The first weekly list has not been published yet. It is updated every Monday
                morning, India time.
              </p>
            ) : (
              <>
                <FilterRadioGroup<Filter>
                  legend="Show"
                  name="radar-filter"
                  value={filter}
                  options={FILTER_OPTIONS}
                  onChange={setFilter}
                  className="mb-6"
                />
                {groups.map((group) => {
                  const shown = sortRadar(items.filter((item) => item.kind === group.kind));
                  return (
                    <section key={group.kind} aria-labelledby={`radar-${group.kind}`} className="mb-10">
                      <h2 id={`radar-${group.kind}`} className="mb-4 font-heading text-xl font-semibold">
                        {group.heading} <span className="text-muted-foreground">({shown.length})</span>
                      </h2>
                      {shown.length === 0 ? (
                        <p className="text-muted-foreground">{group.empty}</p>
                      ) : (
                        <ul className="space-y-4" role="list">
                          {shown.map((item) => (
                            <li key={item.id}>
                              <RadarCard item={item} today={today} badge={group.badge} Icon={group.icon} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </>
            )}
          </>
        )}
      </section>
    </Layout>
  );
};

export default Radar;
