import { isSafeHttpUrl } from "@/lib/safe-url";

/**
 * The Opportunity Radar's public feed: assistive-technology jobs, events and
 * funding calls that a weekly research run finds and checks.
 *
 * The run replaces public/radar-community.json; nobody edits it by hand, and
 * it comes from web research, so it is treated as untrusted input. Unknown
 * kinds, links that are not plain http(s), malformed dates and anything that
 * has already closed are dropped here rather than rendered.
 */

export const RADAR_KINDS = ["job", "event", "grant"] as const;
export type RadarKind = (typeof RADAR_KINDS)[number];

export interface RadarItem {
  id: string;
  kind: RadarKind;
  title: string;
  url: string;
  org?: string;
  location?: string;
  /** Event start, YYYY-MM-DD. */
  date?: string;
  dateEnd?: string;
  /** Application or submission deadline, YYYY-MM-DD. */
  deadline?: string;
  summary?: string;
  tags: string[];
  added?: string;
  source?: string;
}

export interface RadarFeed {
  updated: string | null;
  nextRun: string | null;
  items: RadarItem[];
}

/**
 * Where the feed is read from, in order. The weekly run updates the GitHub
 * Pages copy, which allows cross-origin reads, so the Lovable-hosted site
 * (which only changes when it is republished) still shows this week's list.
 * The site's own copy is the fallback.
 */
export const RADAR_FEED_URLS = [
  "https://puchaarunkumar.github.io/abiliverse-connect/radar-community.json",
  `${import.meta.env.BASE_URL}radar-community.json`,
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const day = value.slice(0, 10);
  if (!ISO_DATE.test(day)) return undefined;
  // Rejects dates such as 2026-02-30, which Date would roll into March.
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(day) ? day : undefined;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** Today in the viewer's time zone, as YYYY-MM-DD. */
export function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Whole days from today to an ISO date; negative once it has passed. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** Closed once the deadline, or without one the event's last day, is before today. */
export function isClosed(item: Pick<RadarItem, "deadline" | "date" | "dateEnd">, today: string): boolean {
  if (item.deadline) return item.deadline < today;
  const lastDay = item.dateEnd ?? item.date;
  return lastDay ? lastDay < today : false;
}

export function parseRadarFeed(raw: unknown, today: string): RadarFeed {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const entries = Array.isArray(data.items) ? data.items : [];
  const items: RadarItem[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const title = text(e.title, 200);
    const url = typeof e.url === "string" ? e.url.trim() : "";
    if (!RADAR_KINDS.includes(e.kind as RadarKind) || !title || !isSafeHttpUrl(url)) continue;
    const item: RadarItem = {
      id: text(e.id, 40) ?? url,
      kind: e.kind as RadarKind,
      title,
      url,
      org: text(e.org, 120),
      location: text(e.location, 120),
      date: isoDate(e.date),
      dateEnd: isoDate(e.date_end),
      deadline: isoDate(e.deadline),
      summary: text(e.summary, 400),
      tags: Array.isArray(e.tags)
        ? e.tags.map((tag) => text(tag, 40)).filter((tag): tag is string => !!tag).slice(0, 6)
        : [],
      added: isoDate(e.added),
      source: text(e.source, 80),
    };
    if (seen.has(item.id) || isClosed(item, today)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return {
    updated: isoDate(data.updated) ?? null,
    nextRun: text(data.next_run, 60) ?? null,
    items,
  };
}

/** Events by start date, funding by deadline (rolling calls last), jobs newest first. */
export function sortRadar(items: RadarItem[]): RadarItem[] {
  const key = (item: RadarItem) =>
    item.kind === "event"
      ? item.date ?? "9999"
      : item.kind === "grant"
        ? item.deadline ?? "9999"
        : // Newest first: invert the date so it sorts ascending with the others.
          String(99999999 - Number((item.added ?? "0000-00-00").replace(/-/g, "")));
  return [...items].sort((a, b) => key(a).localeCompare(key(b)) || a.title.localeCompare(b.title));
}

export async function loadRadarFeed(today: string, fetchImpl: typeof fetch = fetch): Promise<RadarFeed> {
  let lastError: unknown = null;
  for (const url of RADAR_FEED_URLS) {
    try {
      const response = await fetchImpl(url, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return parseRadarFeed(await response.json(), today);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The radar feed could not be loaded");
}
