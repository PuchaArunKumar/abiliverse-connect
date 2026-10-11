import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

// The page needs no Supabase data, but Layout's navbar reads the auth state.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, mfaRequired: false, signOut: async () => ({ error: null }) }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import Radar from "@/pages/Radar";
import { RADAR_FEED_URLS, daysUntil, isClosed, localToday, parseRadarFeed, sortRadar } from "@/lib/radar";

const TODAY = "2026-10-11";

/** An ISO date n days from the real today, for tests that render the page. */
function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localToday(d);
}

const FEED = {
  schema: 1,
  updated: "2026-10-11",
  next_run: "Mon 19 Oct 2026, 07:53 IST",
  items: [
    { id: "j1", kind: "job", title: "Accessibility ML Engineer", org: "AT Co", url: "https://at.example.com/jobs/1", location: "Bengaluru", summary: "Build ML features for screen-reader users.", tags: ["ML", "a11y"], added: "2026-10-11" },
    { id: "e1", kind: "event", title: "CSUN AT Conference", org: "CSUN", url: "https://csun.example.edu/at", date: "2027-03-08", date_end: "2027-03-12", location: "Anaheim, USA", summary: "The largest AT conference." },
    { id: "g1", kind: "grant", title: "AT Innovation Grant", org: "Fund", url: "https://fund.example.org/call", deadline: "2026-12-01", summary: "Grants for AT start-ups." },
    { id: "bad1", kind: "job", title: "Unsafe link", url: "javascript:alert(1)" },
    { id: "bad2", kind: "connection", title: "Private contact", url: "https://example.com/person" },
    { id: "old", kind: "grant", title: "Closed call", url: "https://fund.example.org/old", deadline: "2026-01-01" },
  ],
};

function respond(body: unknown, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) } as Response);
}

function renderRadar() {
  return render(
    <MemoryRouter initialEntries={["/radar"]}>
      <AccessibilityProvider>
        <Radar />
      </AccessibilityProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    });
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseRadarFeed", () => {
  it("keeps valid items and drops unsafe, unknown and closed ones", () => {
    const feed = parseRadarFeed(FEED, TODAY);
    expect(feed.items.map((i) => i.id)).toEqual(["j1", "e1", "g1"]);
    expect(feed.updated).toBe("2026-10-11");
    expect(feed.nextRun).toBe("Mon 19 Oct 2026, 07:53 IST");
    expect(feed.items[1]).toMatchObject({ date: "2027-03-08", dateEnd: "2027-03-12" });
  });

  it("survives malformed input", () => {
    expect(parseRadarFeed(null, TODAY)).toEqual({ updated: null, nextRun: null, items: [] });
    expect(parseRadarFeed({ items: "nope" }, TODAY).items).toEqual([]);
    const feed = parseRadarFeed(
      { items: [{ kind: "event", title: "  ", url: "https://a.example.com" }, { kind: "event", title: "Bad date", url: "https://b.example.com", date: "2026-02-30", tags: [1, " x ", ""] }, { id: "d", kind: "job", title: "Dup", url: "https://c.example.com" }, { id: "d", kind: "job", title: "Dup again", url: "https://d.example.com" }] },
      TODAY,
    );
    expect(feed.items.map((i) => i.title)).toEqual(["Bad date", "Dup"]);
    expect(feed.items[0].date).toBeUndefined();
    expect(feed.items[0].tags).toEqual(["x"]);
  });

  it("closes items by deadline first, then by the event's last day", () => {
    expect(isClosed({ deadline: "2026-10-10", date: "2027-01-01" }, TODAY)).toBe(true);
    expect(isClosed({ date: "2026-10-09", dateEnd: "2026-10-12" }, TODAY)).toBe(false);
    expect(isClosed({}, TODAY)).toBe(false);
    expect(daysUntil("2026-10-18", TODAY)).toBe(7);
  });

  it("sorts events by date, funding by deadline and jobs newest first", () => {
    const items = parseRadarFeed(
      { items: [
        { id: "a", kind: "job", title: "Old job", url: "https://a.example.com", added: "2026-10-01" },
        { id: "b", kind: "job", title: "New job", url: "https://b.example.com", added: "2026-10-11" },
        { id: "c", kind: "grant", title: "Rolling", url: "https://c.example.com" },
        { id: "d", kind: "grant", title: "Soon", url: "https://d.example.com", deadline: "2026-10-20" },
      ] },
      TODAY,
    ).items;
    expect(sortRadar(items.filter((i) => i.kind === "job")).map((i) => i.title)).toEqual(["New job", "Old job"]);
    expect(sortRadar(items.filter((i) => i.kind === "grant")).map((i) => i.title)).toEqual(["Soon", "Rolling"]);
  });
});

describe("Radar page", () => {
  it("lists the feed in groups, links out safely and has no axe violations", async () => {
    const fetchMock = vi.fn(() => respond(FEED));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderRadar();

    expect(await screen.findByRole("heading", { level: 2, name: /Jobs in assistive technology/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Opportunity Radar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Accessibility ML Engineer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "CSUN AT Conference" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "AT Innovation Grant" })).toBeInTheDocument();
    expect(screen.queryByText("Unsafe link")).not.toBeInTheDocument();
    expect(screen.queryByText("Private contact")).not.toBeInTheDocument();
    expect(screen.getByText(/3 open listings/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(RADAR_FEED_URLS[0], { cache: "no-cache" });

    const link = screen.getByRole("link", { name: /Open listing for Accessibility ML Engineer/ });
    expect(link).toHaveAttribute("href", "https://at.example.com/jobs/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");

    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } })).toHaveNoViolations();
  });

  it("filters to one kind", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respond(FEED)));
    renderRadar();
    await screen.findByRole("heading", { level: 2, name: /Jobs in assistive technology/ });
    fireEvent.click(screen.getByRole("radio", { name: "Funding" }));
    expect(screen.queryByRole("heading", { level: 2, name: /Jobs in assistive technology/ })).not.toBeInTheDocument();
    const funding = screen.getByRole("region", { name: /Funding and programmes/ });
    expect(within(funding).getByRole("heading", { level: 3, name: "AT Innovation Grant" })).toBeInTheDocument();
  });

  it("flags a deadline within a week", async () => {
    const soon = inDays(3);
    vi.stubGlobal("fetch", vi.fn(() => respond({ items: [{ id: "s", kind: "grant", title: "Closing soon", url: "https://s.example.org", deadline: soon }] })));
    renderRadar();
    expect(await screen.findByText(/Closes in 3 days/)).toBeInTheDocument();
  });

  it("falls back to the site's own copy when the canonical feed fails", async () => {
    const fetchMock = vi.fn((url: string) => (url === RADAR_FEED_URLS[0] ? Promise.reject(new TypeError("offline")) : respond(FEED)));
    vi.stubGlobal("fetch", fetchMock);
    renderRadar();
    expect(await screen.findByRole("heading", { level: 3, name: "CSUN AT Conference" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(RADAR_FEED_URLS[1], { cache: "no-cache" });
  });

  it("says so when the feed cannot be loaded, and retries", async () => {
    let fail = true;
    vi.stubGlobal("fetch", vi.fn(() => (fail ? respond(null, false) : respond(FEED))));
    renderRadar();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load the radar/);
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 3, name: "AT Innovation Grant" })).toBeInTheDocument();
  });

  it("explains an empty feed instead of showing empty groups", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respond({ schema: 1, updated: "2026-10-11", items: [] })));
    renderRadar();
    expect(await screen.findByText(/first weekly list has not been published yet/)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
