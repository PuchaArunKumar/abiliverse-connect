import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

interface Result {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number;
}

// Shared with the hoisted mocks below, so each test can set what the
// "database" returns and inspect what the page sent.
const db = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  rpcResult: { data: null, error: null } as Result,
  rpc: null as null | ((name: string, args: unknown) => void),
  user: null as null | { id: string },
}));

/**
 * A stand-in for the PostgREST query builder: every filter returns the same
 * builder, and awaiting it (or .single()) yields the table's rows. Enough for
 * the chained calls the community pages make, without reaching the network.
 */
function builder(table: string) {
  const result = (): Result => ({ data: db.tables[table] ?? [], error: null, count: 0 });
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "order", "eq", "in", "limit", "insert", "delete", "update"]) {
    chain[method] = () => chain;
  }
  chain.single = () => Promise.resolve({ data: (db.tables[table] ?? [])[0] ?? null, error: null });
  chain.maybeSingle = chain.single;
  chain.then = (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(resolve, reject);
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: (name: string, args: unknown) => {
      db.rpc?.(name, args);
      return Promise.resolve(db.rpcResult);
    },
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
  },
}));

// The pages only read useAuth(); mocking it keeps these tests independent of
// how the auth context resolves sessions and assurance levels.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    session: null,
    user: db.user,
    loading: false,
    mfaRequired: false,
    signOut: async () => ({ error: null }),
  }),
}));

import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import Opportunities from "@/pages/Opportunities";
import Contact from "@/pages/Contact";
import Feed from "@/pages/Feed";
import Jobs from "@/pages/Jobs";
import Learn from "@/pages/Learn";

function renderPage(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AccessibilityProvider>{ui}</AccessibilityProvider>
    </MemoryRouter>,
  );
}

const EVENTS = [
  {
    id: "e1",
    user_id: "u1",
    kind: "event",
    title: "Screen reader meetup",
    description: "Monthly, online.",
    starts_at: "2026-10-12T12:30:00.000Z",
    location: "Online",
    link: "https://example.org/meetup",
    created_at: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "e2",
    user_id: "u2",
    kind: "guidance",
    title: "Asking for reasonable adjustments",
    description: "What worked for me.",
    starts_at: null,
    location: "",
    // Stored before links were validated: must not become a link.
    link: "javascript:alert(1)",
    created_at: "2026-08-01T00:00:00.000Z",
  },
];

beforeEach(() => {
  db.tables = {};
  db.rpcResult = { data: null, error: null };
  db.rpc = null;
  db.user = null;
});

describe("Opportunities", () => {
  it("has no axe violations, with a real filter control instead of panel-less tabs", async () => {
    db.tables.events = EVENTS;
    db.user = { id: "u1" };
    const { container } = renderPage(<Opportunities />);
    await screen.findByText("Screen reader meetup");

    expect(screen.queryByRole("tablist")).toBeNull();
    const group = screen.getByRole("group", { name: "Show" });
    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(4);

    // Every aria-controls must point at something that exists (the bug was
    // tabs controlling panels that were never rendered).
    container.querySelectorAll("[aria-controls]").forEach((el) => {
      const id = el.getAttribute("aria-controls") ?? "";
      if (el.getAttribute("aria-expanded") !== "false") {
        expect(document.getElementById(id)).not.toBeNull();
      }
    });

    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("filters with the radios and announces the result", async () => {
    db.tables.events = EVENTS;
    renderPage(<Opportunities />);
    await screen.findByText("Screen reader meetup");

    fireEvent.click(screen.getByRole("radio", { name: "Guidance" }));
    expect(screen.getByRole("radio", { name: "Guidance" })).toBeChecked();
    expect(screen.queryByText("Screen reader meetup")).toBeNull();
    expect(screen.getByText("Asking for reasonable adjustments")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 2 listings/)).toBeInTheDocument();
  });

  it("links only http(s) addresses and names the delete button after the item", async () => {
    db.tables.events = EVENTS;
    db.user = { id: "u1" };
    renderPage(<Opportunities />);
    await screen.findByText("Screen reader meetup");

    const main = screen.getByRole("main");
    const links = Array.from(main.querySelectorAll("a[target=_blank]"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["https://example.org/meetup"]);
    expect(main.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(screen.getByRole("button", { name: 'Delete "Screen reader meetup"' })).toBeInTheDocument();
    // Only the author gets a delete button.
    expect(screen.queryByRole("button", { name: /Delete "Asking/ })).toBeNull();
  });

  it("sets the document title", async () => {
    renderPage(<Opportunities />);
    await screen.findByText("Nothing here yet.");
    expect(document.title).toMatch(/^Events, opportunities and guidance/);
  });
});

describe("Contact", () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: " Asha " } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "asha@example.org" } });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Hello, I have a question about captions." },
    });
  };

  it("has no axe violations and identifies the sender's own fields", async () => {
    const { container } = renderPage(<Contact />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("sends through send_contact_message and says it was received", async () => {
    const calls: [string, unknown][] = [];
    db.rpc = (name, args) => calls.push([name, args]);
    renderPage(<Contact />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    expect(await screen.findByText(/Your message was received/)).toBeInTheDocument();
    expect(calls).toEqual([
      [
        "send_contact_message",
        {
          _name: "Asha",
          _email: "asha@example.org",
          _topic: "",
          _message: "Hello, I have a question about captions.",
        },
      ],
    ]);
  });

  it("does not send an invalid form, and moves focus to the first problem", async () => {
    const calls: unknown[] = [];
    db.rpc = (name) => calls.push(name);
    renderPage(<Contact />);
    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    const name = screen.getByLabelText("Name");
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("says when the form is not available yet and keeps the message", async () => {
    db.rpcResult = {
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.send_contact_message" },
    };
    renderPage(<Contact />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/not available yet/);
    expect(alert.querySelector('a[href^="mailto:"]')).not.toBeNull();
    expect(screen.queryByText(/Your message was received/)).toBeNull();
    expect(screen.getByLabelText("Message")).toHaveValue("Hello, I have a question about captions.");
  });
});

describe("Feed, Jobs and Learn", () => {
  it("Feed: counts come from embedded aggregates and every button says what it does", async () => {
    db.user = { id: "u1" };
    db.tables.posts = [
      {
        id: "p1",
        user_id: "u2",
        body: "https://example.org/a-very-long-address-that-must-wrap-at-320-pixels-without-scrolling",
        created_at: "2026-09-01T00:00:00.000Z",
        post_likes: [{ count: 1200 }],
        post_comments: [{ count: 3 }],
      },
    ];
    db.tables.profiles = [{ user_id: "u2", display_name: "" }];
    db.tables.post_likes = [{ post_id: "p1" }];
    const { container } = renderPage(<Feed />);

    const comments = await screen.findByRole("button", { name: "Comments (3), show" });
    expect(comments).toHaveAttribute("aria-expanded", "false");
    const like = screen.getByRole("button", { name: "Like, 1,200 likes" });
    expect(like).toHaveAttribute("aria-pressed", "true");
    // An empty display name falls back to neutral wording.
    expect(screen.getByRole("heading", { name: "Community member" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("Jobs: the poster gets an Applications disclosure instead of Easy apply", async () => {
    db.user = { id: "u1" };
    db.tables.jobs = [
      {
        id: "j1",
        user_id: "u1",
        title: "Accessibility tester",
        company: "Acme",
        location: "Remote-first",
        description: "Test with a screen reader.",
        accessibility_tags: ["screen reader"],
        apply_url: "acme.com/careers",
        remote: true,
        created_at: "2026-09-01T00:00:00.000Z",
        job_applications: [{ count: 2 }],
      },
    ];
    const { container } = renderPage(<Jobs />);

    const toggle = await screen.findByRole("button", { name: /Applications \(2\)/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Easy apply/ })).toBeNull();
    // A scheme-less link would resolve inside this app: it is not linked.
    expect(screen.getByRole("main").querySelector('a[target="_blank"]')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("Jobs: an applicant is told what the poster will see", async () => {
    db.user = { id: "u2" };
    db.tables.jobs = [
      {
        id: "j1",
        user_id: "u1",
        title: "Accessibility tester",
        company: "Acme",
        location: "",
        description: "Test with a screen reader.",
        accessibility_tags: [],
        apply_url: "",
        remote: false,
        created_at: "2026-09-01T00:00:00.000Z",
        job_applications: [{ count: 0 }],
      },
    ];
    const { container } = renderPage(<Jobs />);

    fireEvent.click(await screen.findByRole("button", { name: /Easy apply/ }));
    const note = screen.getByLabelText("Note to the poster (optional)");
    expect(note).toHaveAccessibleDescription(/how they can reach you/);
    await waitFor(() => expect(note).toHaveFocus());
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("Learn: has no axe violations when signed out", async () => {
    db.tables.courses = [
      {
        id: "c1",
        user_id: "u1",
        title: "Intro to ARIA",
        description: "A short course.",
        provider: "YouTube",
        url: "https://example.org/aria",
        level: "beginner",
        tags: ["aria"],
        created_at: "2026-09-01T00:00:00.000Z",
      },
    ];
    const { container } = renderPage(<Learn />);
    await screen.findByRole("heading", { name: "Intro to ARIA" });
    expect(screen.getByRole("link", { name: "Sign in to share a resource" })).toHaveAttribute(
      "href",
      "/login?next=/learn",
    );
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);
});
