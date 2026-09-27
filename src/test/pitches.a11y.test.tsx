import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

interface MockResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
  count?: number | null;
}

// Supabase is mocked at the module boundary with a builder that accepts the
// chained calls the pitch pages make and resolves to a per-table result. Each
// call is recorded, so the tests can check the query as well as the markup.
const mock = vi.hoisted(() => {
  const state = {
    calls: [] as { table: string; method: string; args: unknown[] }[],
    results: {} as Record<string, MockResult | (() => Promise<MockResult>)>,
    auth: {
      user: null as { id: string } | null,
      session: null,
      loading: false,
      mfaRequired: false,
      signOut: async () => ({ error: null }),
    },
  };
  const METHODS = [
    "select",
    "eq",
    "contains",
    "textSearch",
    "order",
    "range",
    "limit",
    "in",
    "insert",
    "update",
    "delete",
    "maybeSingle",
    "single",
  ];
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of METHODS) {
      chain[method] = (...args: unknown[]) => {
        state.calls.push({ table, method, args });
        return chain;
      };
    }
    chain.then = (
      onFulfilled: (value: MockResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      const result = state.results[table] ?? { data: [], error: null, count: 0 };
      const promise = typeof result === "function" ? result() : Promise.resolve(result);
      return promise.then(onFulfilled, onRejected);
    };
    return chain;
  };
  return { state, builder };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => mock.builder(table),
    rpc: (fn: string) => mock.builder(`rpc:${fn}`),
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mock.state.auth,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import PitchForm from "@/components/pitches/PitchForm";
import Pitches from "@/pages/Pitches";
import PitchDetail from "@/pages/PitchDetail";
import {
  PITCHES_PAGE_SIZE,
  PITCH_LIST_COLUMNS,
  type ListedPitch,
  type PitchDetailRow,
} from "@/lib/pitches";

const PITCH_ID = "123e4567-e89b-12d3-a456-426614174000";

const detailRow: PitchDetailRow = {
  id: PITCH_ID,
  user_id: "founder",
  title: "Talking bus stops",
  tagline: "Stops announce themselves to a phone.",
  description: "A longer description of the idea and who it is for.",
  problem_id: null,
  stage: "pilot",
  needs: ["funding", "mentorship"],
  disability_types: ["visual"],
  funding_goal: 25000,
  funding_currency: "USD",
  website_url: "https://example.org",
  demo_url: "javascript:alert(1)",
  tags: ["transit"],
  is_open: true,
  support_count: 2,
  feedback_count: 0,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/pitches/${PITCH_ID}`]}>
      <AccessibilityProvider>
        <Routes>
          <Route path="/pitches/:id" element={<PitchDetail />} />
        </Routes>
      </AccessibilityProvider>
    </MemoryRouter>,
  );
}

function listed(id: string, title: string): ListedPitch {
  return {
    id,
    user_id: "founder",
    title,
    tagline: "Stops announce themselves to a phone.",
    stage: "prototype",
    needs: ["funding", "testers"],
    disability_types: [],
    funding_goal: 25000,
    funding_currency: "USD",
    is_open: false,
    support_count: 3,
    feedback_count: 1,
    created_at: "2026-09-01T00:00:00Z",
  };
}

function renderPage(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AccessibilityProvider>{ui}</AccessibilityProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => {
  // jsdom lacks these. Radix measures checkboxes and radios with
  // ResizeObserver, and axe probes a canvas for icon ligatures; neither
  // affects what these tests check.
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      value: ResizeObserverStub,
    });
  }
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    writable: true,
    value: () => null,
  });
});

beforeEach(() => {
  mock.state.calls = [];
  mock.state.results = {};
  mock.state.auth.user = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PitchForm", () => {
  const renderForm = (mode: "create" | "edit") =>
    render(
      <MemoryRouter>
        <main>
          <h1>Submit a pitch</h1>
          <PitchForm mode={mode} submitting={false} onSubmit={vi.fn()} onCancel={vi.fn()} />
        </main>
      </MemoryRouter>,
    );

  it("has no axe violations", async () => {
    const { container } = renderForm("edit");
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("shows, links and focuses errors on an invalid submit, still without violations", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <main>
          <h1>Submit a pitch</h1>
          <PitchForm mode="create" submitting={false} onSubmit={onSubmit} onCancel={vi.fn()} />
        </main>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish pitch" }));

    const summary = await screen.findByRole("heading", { name: /things to fix/ });
    expect(summary.parentElement).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();

    const title = screen.getByLabelText("Title");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title.getAttribute("aria-describedby")).toContain("pitch-title-error");
    expect(document.getElementById("pitch-title-error")).toHaveTextContent("Enter a title.");

    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("shows funding details only when funding is a need", () => {
    renderForm("create");
    expect(screen.queryByLabelText("Funding goal (optional)")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Funding" }));
    expect(screen.getByLabelText("Funding goal (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Currency")).toHaveValue("USD");
    expect(screen.getByText(/does not process payments/)).toBeInTheDocument();
  });

  it("offers the open-to-interest switch only when editing", () => {
    renderForm("create");
    expect(screen.queryByRole("switch")).toBeNull();
  });
});

describe("Pitches list page", () => {
  it("has no axe violations with results", async () => {
    mock.state.results.pitches = {
      data: [listed("a", "Talking bus stops"), listed("b", "Braille labels")],
      error: null,
      count: 30,
    };
    const { container } = renderPage(<Pitches />);
    expect(await screen.findByRole("link", { name: "Talking bus stops" })).toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 30 pitches")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more pitches" })).toBeInTheDocument();
    expect(screen.getAllByText("Closed")).toHaveLength(2);
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("asks for an exact count and the first page, with explicit columns", async () => {
    renderPage(<Pitches />);
    await screen.findByText("No pitches have been shared yet.");
    expect(mock.state.calls).toContainEqual({
      table: "pitches",
      method: "select",
      args: [PITCH_LIST_COLUMNS, { count: "exact" }],
    });
    expect(mock.state.calls).toContainEqual({
      table: "pitches",
      method: "range",
      args: [0, PITCHES_PAGE_SIZE - 1],
    });
  });

  it("sends signed-out visitors to sign in with a return path", async () => {
    renderPage(<Pitches />);
    const link = await screen.findByRole("link", { name: "Sign in to submit a pitch" });
    expect(link).toHaveAttribute("href", "/login?next=/pitches/new");
  });

  it("offers signed-in people the submit button", async () => {
    mock.state.auth.user = { id: "me" };
    renderPage(<Pitches />);
    expect(await screen.findByRole("link", { name: "Submit a pitch" })).toHaveAttribute(
      "href",
      "/pitches/new",
    );
  });

  it("searches with websearch full-text and ignores a stale response", async () => {
    let releaseFirst: (value: MockResult) => void = () => {};
    let call = 0;
    mock.state.results.pitches = () => {
      call += 1;
      if (call === 1) {
        return new Promise<MockResult>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return Promise.resolve({ data: [listed("n", "New result")], error: null, count: 1 });
    };
    renderPage(<Pitches />);

    fireEvent.change(screen.getByLabelText("Search pitches"), {
      target: { value: "wheelchair" },
    });
    expect(await screen.findByRole("link", { name: "New result" })).toBeInTheDocument();
    expect(mock.state.calls).toContainEqual({
      table: "pitches",
      method: "textSearch",
      args: ["search_vector", "wheelchair", { type: "websearch", config: "english" }],
    });

    // The first, unfiltered request finishes last; its rows must not win.
    await act(async () => {
      releaseFirst({ data: [listed("o", "Old result")], error: null, count: 1 });
    });
    expect(screen.queryByRole("link", { name: "Old result" })).toBeNull();
    expect(screen.getByRole("link", { name: "New result" })).toBeInTheDocument();
  });

  it("says the feature is being set up when the table is missing", async () => {
    mock.state.results.pitches = {
      data: null,
      error: { code: "PGRST205", message: "Could not find the table in the schema cache" },
      count: null,
    };
    const { container } = renderPage(<Pitches />);
    expect(
      await screen.findByRole("heading", { level: 1, name: /Pitch Platform is being set up/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("reports other failures without the raw message", async () => {
    mock.state.results.pitches = {
      data: null,
      error: { code: "XX000", message: "internal PostgREST detail" },
      count: null,
    };
    renderPage(<Pitches />);
    expect(await screen.findByText(/Pitches could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByText(/PostgREST detail/)).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("Pitch detail page", () => {
  it("has no axe violations for a signed-out visitor, and never links an unsafe URL", async () => {
    mock.state.results.pitches = { data: detailRow, error: null };
    mock.state.results.pitch_feedback = { data: [], error: null };
    const { container } = renderDetail();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Talking bus stops" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("No feedback yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://example.org" })).toBeInTheDocument();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in to express interest" })).toHaveAttribute(
      "href",
      `/login?next=/pitches/${PITCH_ID}`,
    );
    expect(screen.queryByRole("button", { name: /back this/ })).toBeNull();
    expect(screen.getAllByText(/does not process payments/).length).toBeGreaterThan(0);
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("gives the founder the inbox and management actions, but no support toggle", async () => {
    mock.state.auth.user = { id: "founder" };
    mock.state.results.pitches = { data: detailRow, error: null };
    mock.state.results.pitch_feedback = { data: [], error: null };
    mock.state.results.pitch_interests = { data: [], error: null };
    mock.state.results.profiles = { data: [], error: null };
    mock.state.results["rpc:is_moderator"] = { data: false, error: null };
    const { container } = renderDetail();
    expect(
      await screen.findByRole("heading", { level: 2, name: "Interest received" }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/No one has sent interest yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit pitch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete pitch" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back this/ })).toBeNull();
    expect(screen.getByText(/Shared by you/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("lets a signed-in visitor back the pitch with a pressed toggle", async () => {
    mock.state.auth.user = { id: "visitor" };
    mock.state.results.pitches = { data: detailRow, error: null };
    mock.state.results.pitch_feedback = { data: [], error: null };
    mock.state.results.pitch_interests = { data: null, error: null };
    mock.state.results.pitch_supports = { data: null, error: null };
    mock.state.results.profiles = { data: [{ user_id: "founder", display_name: "" }], error: null };
    mock.state.results["rpc:is_moderator"] = { data: false, error: null };
    renderDetail();
    const toggle = await screen.findByRole("button", { name: "I'd use or back this" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/Shared by Community member/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Express interest" })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(mock.state.calls).toContainEqual({
      table: "pitch_supports",
      method: "insert",
      args: [{ pitch_id: PITCH_ID, user_id: "visitor" }],
    });
    expect(await screen.findByText("You back this pitch.")).toBeInTheDocument();
  });
});
