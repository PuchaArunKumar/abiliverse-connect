import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// vi.mock factories are hoisted above the imports, so the mocks they close
// over must be hoisted with them.
const { rpc, toast } = vi.hoisted(() => ({
  rpc: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));
vi.mock("sonner", () => ({ toast }));

import NewsletterSection from "./NewsletterSection";

function submit(address: string) {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: address },
  });
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
}

beforeEach(() => {
  rpc.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("NewsletterSection", () => {
  it("subscribes through the RPC, not a table insert", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    render(<NewsletterSection />);

    submit("  Someone@Example.org ");

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith("subscribe_to_newsletter", {
      _email: "someone@example.org",
    });
    expect(screen.getByLabelText("Email address")).toHaveValue("");
  });

  it("reports an address already on the list as success", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    render(<NewsletterSection />);

    submit("someone@example.org");

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("explains an invalid address without calling the server", () => {
    render(<NewsletterSection />);

    submit("not-an-address");

    expect(rpc).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/name@example\.com/);
    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("says sign-up is unavailable, and moves focus there, while the function is not deployed", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    });
    render(<NewsletterSection />);

    submit("someone@example.org");

    const notice = await screen.findByText(/isn't available yet/);
    await waitFor(() => expect(notice).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("sends one request however many times the button is pressed", async () => {
    let resolve: (value: unknown) => void = () => {};
    rpc.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<NewsletterSection />);

    submit("someone@example.org");
    fireEvent.click(screen.getByRole("button", { name: /Subscrib/ }));
    fireEvent.click(screen.getByRole("button", { name: /Subscrib/ }));
    resolve({ data: null, error: null });

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
