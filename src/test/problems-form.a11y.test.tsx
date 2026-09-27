import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

// jsdom has no ResizeObserver; Radix's checkbox measures itself with one.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// The form reads public URLs for attached files and, in create mode, asks the
// search RPC for duplicates. Neither should reach the network in a unit test.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: () => Promise.resolve({ data: [], error: null }),
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://storage.example/problem-media/${path}` },
        }),
      }),
    },
  },
}));

import ProblemForm from "@/components/problems/ProblemForm";
import { EMPTY_DRAFT, type ProblemDraft } from "@/lib/problems";
import type { PendingMedia, ProblemMedia } from "@/lib/media";

const USER = "8f14e45f-ceea-467a-9575-1a2b3c4d5e6f";
const PROBLEM = "c9f0f895-fb98-4b91-8b3a-6f7e8d9c0b1a";

const existing: ProblemMedia[] = [
  {
    id: "m1",
    problem_id: PROBLEM,
    user_id: USER,
    kind: "image",
    storage_path: `${USER}/${PROBLEM}/a.png`,
    file_name: "ramp.png",
    mime_type: "image/png",
    size_bytes: 2048,
    description: "A steep ramp with no handrail leading to a shop door",
    created_at: "2026-09-01T10:00:00Z",
  },
  {
    id: "m2",
    problem_id: PROBLEM,
    user_id: USER,
    kind: "document",
    storage_path: `${USER}/${PROBLEM}/b.pdf`,
    file_name: "access-audit.pdf",
    mime_type: "application/pdf",
    size_bytes: 200000,
    description: "",
    created_at: "2026-09-01T10:00:00Z",
  },
];

const pendingFiles = (): PendingMedia[] => [
  {
    id: "p1",
    file: new File(["x"], "entrance.jpg", { type: "image/jpeg" }),
    kind: "image",
    description: "",
  },
  {
    id: "p2",
    file: new File(["x"], "walkthrough.mp4", { type: "video/mp4" }),
    kind: "video",
    description: "",
  },
  {
    id: "p3",
    file: new File(["x"], "notes.pdf", { type: "application/pdf" }),
    kind: "document",
    description: "",
  },
];

function Harness({
  mode,
  initial,
  onSubmit = () => {},
}: {
  mode: "create" | "edit";
  initial: ProblemDraft;
  onSubmit?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState<PendingMedia[]>(pendingFiles);
  return (
    <MemoryRouter>
      <main>
        <h1>Form</h1>
        <ProblemForm
          mode={mode}
          draft={draft}
          onDraftChange={setDraft}
          pending={pending}
          onPendingChange={setPending}
          media={{
            available: true,
            existing: mode === "edit" ? existing : [],
            onRemoveExisting: mode === "edit" ? async () => null : undefined,
          }}
          submitting={false}
          submitLabel="Save"
          busyLabel="Saving..."
          onSubmit={onSubmit}
          onCancel={() => {}}
        />
      </main>
    </MemoryRouter>
  );
}

const legacyDraft: ProblemDraft = {
  ...EMPTY_DRAFT,
  title: "Shop ramps are too steep",
  description: "Many small shops have ramps far steeper than the guidance allows.",
  status: "in_progress",
  relatedResearch: "https://example.org/ramp-study",
  imageUrls: ["https://img.example/old.png"],
};

describe("ProblemForm accessibility (axe)", () => {
  it("create mode with files waiting for descriptions has no violations", async () => {
    const { container } = render(<Harness mode="create" initial={EMPTY_DRAFT} />);
    // The uploader and its required description fields are really there.
    expect(screen.getByLabelText("Choose files to attach")).toHaveAttribute("type", "file");
    expect(
      screen.getByLabelText(/Describe what this image shows \(required\)/),
    ).toBeRequired();
    expect(
      screen.getByLabelText(/Describe what happens in this video \(required\)/),
    ).toBeRequired();
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("edit mode with attached files, status and legacy links has no violations", async () => {
    const { container } = render(<Harness mode="edit" initial={legacyDraft} />);
    expect(screen.getByRole("img", { name: existing[0].description })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove access-audit.pdf" })).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("lists every problem after a failed submit, still without violations", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <Harness mode="create" initial={{ ...EMPTY_DRAFT, relatedResearch: "javascript:alert(1)" }} onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).not.toHaveBeenCalled();
    const summary = await screen.findByRole("heading", { name: /things need fixing/ });
    expect(summary).toBeInTheDocument();
    // Title, description, research link, and the image and video descriptions.
    expect(screen.getAllByRole("link", { name: /./ }).filter((a) => a.getAttribute("href")?.startsWith("#"))).toHaveLength(5);
    expect(screen.getByLabelText(/Title/)).toHaveAttribute("aria-invalid", "true");
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);
});
