import { useRef, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFocusAfterReload } from "@/hooks/useFocusAfterReload";

const Harness = () => {
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterReload = useFocusAfterReload(busy, heading);
  return (
    <div>
      <h2 ref={heading} tabIndex={-1}>
        Results
      </h2>
      {!busy && (
        <button
          type="button"
          onClick={() => {
            focusAfterReload();
            setBusy(true);
          }}
        >
          Try again
        </button>
      )}
      <button type="button" onClick={() => setBusy(false)}>
        finish loading
      </button>
    </div>
  );
};

describe("useFocusAfterReload", () => {
  it("moves focus to the target once the reload finishes, not before", () => {
    render(<Harness />);
    const retry = screen.getByRole("button", { name: "Try again" });
    retry.focus();
    act(() => retry.click());
    // The button is gone while loading; focus has not been placed yet.
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(document.activeElement).not.toBe(screen.getByRole("heading"));

    act(() => screen.getByRole("button", { name: "finish loading" }).click());
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Results" }));
  });

  it("does nothing when loading ends without a Try again", () => {
    render(<Harness />);
    const finish = screen.getByRole("button", { name: "finish loading" });
    finish.focus();
    act(() => finish.click());
    expect(document.activeElement).toBe(finish);
  });
});
