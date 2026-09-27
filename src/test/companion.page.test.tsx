import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

interface Row {
  [key: string]: unknown;
}

interface Call {
  table: string;
  op: string;
  values: unknown;
  filters: [string, unknown][];
}

// A small in-memory stand-in for the two companion tables, reached through the
// same chained query builder the page uses. Enough to check what the page asks
// for and how it renders the answer, without a network or a database.
const db = vi.hoisted(() => ({
  routines: [] as Row[],
  completions: [] as Row[],
  error: null as null | { code: string; message: string },
  calls: [] as Call[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const call: Call = { table, op: "select", values: null, filters: [] };
    const rows = () => (table === "companion_routines" ? db.routines : db.completions);
    const run = () => {
      db.calls.push(call);
      if (db.error) return { data: null, error: db.error };
      if (call.op === "insert") {
        const row = {
          id: `new-${db.calls.length}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(call.values as Row),
        };
        rows().push(row);
        return { data: row, error: null };
      }
      if (call.op === "delete") {
        const keep = rows().filter((r) => !call.filters.every(([k, v]) => r[k] === v));
        if (table === "companion_routines") db.routines = keep;
        else db.completions = keep;
        return { data: null, error: null };
      }
      if (call.op === "update") {
        const row = rows().find((r) => call.filters.every(([k, v]) => r[k] === v));
        Object.assign(row ?? {}, call.values);
        return { data: row ?? null, error: null };
      }
      return { data: [...rows()], error: null };
    };
    const builder = {
      select: () => builder,
      order: () => builder,
      gte: () => builder,
      eq: (column: string, value: unknown) => {
        call.filters.push([column, value]);
        return builder;
      },
      insert: (values: unknown) => {
        call.op = "insert";
        call.values = values;
        return builder;
      },
      update: (values: unknown) => {
        call.op = "update";
        call.values = values;
        return builder;
      },
      delete: () => {
        call.op = "delete";
        return builder;
      },
      single: () => Promise.resolve(run()),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return builder;
  };
  return { supabase: { from } };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "person@example.com" },
    session: {},
    loading: false,
    mfaRequired: false,
    signOut: async () => ({ error: null }),
  }),
}));

import Companion from "@/pages/Companion";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { localDateString } from "@/lib/companion";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const routineRow = (overrides: Row = {}): Row => ({
  id: "r-pills",
  user_id: "user-1",
  title: "Morning pills",
  notes: "The organiser is on the kitchen shelf.",
  steps: ["Get a glass of water", "Take today's tablets"],
  remind_at: "08:00:00",
  days: EVERY_DAY,
  active: true,
  created_at: new Date(2026, 0, 1).toISOString(),
  updated_at: new Date(2026, 0, 1).toISOString(),
  ...overrides,
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AccessibilityProvider>
        <Companion />
      </AccessibilityProvider>
    </MemoryRouter>,
  );
}

function headingLevels(container: HTMLElement) {
  return Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) =>
    Number(h.tagName[1]),
  );
}

beforeAll(() => {
  // jsdom lacks ResizeObserver, which Radix's Checkbox measures itself with.
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
    Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }
});

beforeEach(() => {
  db.routines = [];
  db.completions = [];
  db.error = null;
  db.calls = [];
  try {
    window.localStorage.clear();
  } catch {
    // Not needed for these tests to be meaningful.
  }
});

describe("Companion page", () => {
  it("has no axe violations with routines, one h1 and no skipped headings", async () => {
    db.routines = [
      routineRow(),
      routineRow({ id: "r-walk", title: "Evening walk", remind_at: null, notes: "", steps: [] }),
      routineRow({ id: "r-paused", title: "Paused one", active: false }),
    ];
    db.completions = [{ routine_id: "r-walk", completed_on: localDateString(new Date()) }];
    const { container } = renderPage();

    await screen.findByRole("heading", { level: 2, name: "Today" });
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const levels = headingLevels(container);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
    expect(await axe(container)).toHaveNoViolations();
    expect(document.title).toMatch(/^Companion/);
    expect(container.textContent).not.toMatch(/\bAI\b|Alex/);
  }, 20000);

  it("offers example routines when there are none, without axe violations", async () => {
    const { container } = renderPage();
    await screen.findByRole("heading", { level: 2, name: "Get started" });
    expect(screen.getByRole("button", { name: /^Add this routine\s*: Morning medication$/ })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("adds an example in one click and moves focus to its Edit button", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /^Add this routine\s*: Morning medication$/ }));
    const edit = await screen.findByRole("button", { name: "Edit Morning medication" });
    await waitFor(() => expect(edit).toHaveFocus());
    const insert = db.calls.find((c) => c.op === "insert");
    expect(insert?.table).toBe("companion_routines");
    expect(insert?.values).toMatchObject({ user_id: "user-1", title: "Morning medication" });
    expect(insert?.values).not.toHaveProperty("key");
  });

  it("says the feature is being set up when the tables are missing", async () => {
    db.error = { code: "PGRST205", message: "Could not find the table in the schema cache" };
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "Companion is being set up" }),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/schema cache/);
  });

  it("shows a friendly message, not the raw error, when loading fails", async () => {
    db.error = { code: "XX000", message: "internal: relation exploded" };
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Could not load your routines/);
    expect(alert).not.toHaveTextContent(/exploded/);
  });

  it("marks a routine done for today's local date, announces it, and can undo", async () => {
    db.routines = [routineRow()];
    renderPage();
    const button = await screen.findByRole("button", { name: /^Mark done\s*: Morning pills$/ });
    fireEvent.click(button);
    fireEvent.click(button); // a double click must not send twice

    await screen.findByText("Done today");
    const inserts = db.calls.filter((c) => c.table === "companion_completions" && c.op === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].values).toEqual({
      routine_id: "r-pills",
      user_id: "user-1",
      completed_on: localDateString(new Date()),
    });
    expect(
      screen.getAllByRole("status").some((s) => /marked as done for today/.test(s.textContent ?? "")),
    ).toBe(true);

    // Same element, new label, so focus would stay put.
    expect(button).toHaveAccessibleName(/^Undo/);
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByText("Done today")).not.toBeInTheDocument());
    expect(db.completions).toHaveLength(0);
  });

  it("guides through the steps one at a time with focus on each step", async () => {
    db.routines = [routineRow()];
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /^Start Morning pills/ }));

    const dialog = await screen.findByRole("dialog");
    const first = within(dialog).getByRole("heading", { level: 3 });
    expect(first).toHaveTextContent("Step 1 of 2");
    expect(first).toHaveTextContent("Get a glass of water");
    await waitFor(() => expect(first).toHaveFocus());
    expect(await axe(dialog)).toHaveNoViolations();

    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    const second = within(dialog).getByRole("heading", { level: 3 });
    expect(second).toHaveTextContent("Step 2 of 2");
    await waitFor(() => expect(second).toHaveFocus());

    fireEvent.click(within(dialog).getByRole("button", { name: "Finish" }));
    const done = await within(dialog).findByRole("heading", { name: "All done" });
    await waitFor(() => expect(done).toHaveFocus());
    expect(db.completions).toHaveLength(1);

    fireEvent.click(within(dialog).getByRole("button", { name: "Back to Today" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Start Morning pills/ })).toHaveFocus(),
    );
  }, 20000);

  it("validates the routine form and focuses the first problem", async () => {
    db.routines = [routineRow()];
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add a routine" }));

    const dialog = await screen.findByRole("dialog");
    expect(await axe(dialog)).toHaveNoViolations();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Monday" }));
    for (const day of ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
      fireEvent.click(within(dialog).getByRole("checkbox", { name: day }));
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Add routine" }));

    const name = within(dialog).getByLabelText("Name");
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription(/Give the routine a name/);
    expect(within(dialog).getByText("Choose at least one day.")).toBeInTheDocument();
    expect(within(dialog).getByText(/2 things need changing/)).toBeInTheDocument();
    expect(db.calls.some((c) => c.op === "insert")).toBe(false);

    fireEvent.change(name, { target: { value: "Water the plants" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Weekdays" }));
    fireEvent.change(within(dialog).getByLabelText("Steps"), {
      target: { value: "Fill the can\n\n  Water each pot  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add routine" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const insert = db.calls.find((c) => c.op === "insert");
    expect(insert?.values).toMatchObject({
      title: "Water the plants",
      steps: ["Fill the can", "Water each pot"],
      days: [1, 2, 3, 4, 5],
      remind_at: null,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add a routine" })).toHaveFocus(),
    );
  }, 20000);

  it("confirms before deleting and then moves focus to My routines", async () => {
    db.routines = [routineRow(), routineRow({ id: "r-2", title: "Second" })];
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete Morning pills" }));

    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Delete “Morning pills”?");
    expect(db.calls.some((c) => c.op === "delete")).toBe(false);
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete routine" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(db.routines.map((r) => r.id)).toEqual(["r-2"]);
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2, name: "My routines" })).toHaveFocus(),
    );
    expect(screen.queryByRole("button", { name: "Delete Morning pills" })).not.toBeInTheDocument();
  });

  it("explains that page reminders need the page open, and offers the calendar file", async () => {
    db.routines = [routineRow()];
    renderPage();
    await screen.findByRole("heading", { level: 2, name: "Reminders" });
    expect(screen.getByText(/only while this page is open/)).toBeInTheDocument();
    expect(screen.getByText(/even when this site is closed/)).toBeInTheDocument();

    // jsdom has no Notification API: turning reminders on must still work.
    fireEvent.click(screen.getByRole("button", { name: "Turn on reminders" }));
    expect(
      await screen.findByText(/This browser cannot show notifications/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Next reminder:/)).toHaveTextContent("Morning pills");
    expect(screen.getByRole("button", { name: "Add to my calendar" })).toBeInTheDocument();
  });

  it("downloads the routines as abilitiverse-routines.ics", async () => {
    db.routines = [routineRow()];
    const blobs: Blob[] = [];
    const downloads: string[] = [];
    const create = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:companion";
    });
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    try {
      const { unmount } = renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Add to my calendar" }));
      expect(downloads).toEqual(["abilitiverse-routines.ics"]);
      expect(blobs[0].type).toBe("text/calendar;charset=utf-8");
      // jsdom's Blob has no text(); FileReader reads it the long way.
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blobs[0]);
      });
      expect(text).toContain("SUMMARY:Morning pills");
      expect(text).toContain("\r\n");
      expect(screen.getByText(/Downloaded abilitiverse-routines.ics with 1 routine/)).toBeInTheDocument();
      unmount();
      expect(revoke).toHaveBeenCalledWith("blob:companion");
    } finally {
      click.mockRestore();
    }
  });
});
