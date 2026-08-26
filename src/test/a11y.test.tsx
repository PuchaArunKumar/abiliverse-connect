import { describe, expect, it, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

// Supabase is mocked at the module boundary: these tests assert the accessibility
// of rendered markup, and should neither reach the network nor fail when the
// problem-repository tables do not yet exist.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => Promise.resolve({ count: 0, data: [], error: null }),
      insert: () => Promise.resolve({ error: null }),
    }),
    rpc: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
  },
}));

import { AuthProvider } from "@/contexts/AuthContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import Index from "@/pages/Index";
import HeroSection from "@/components/home/HeroSection";
import PlatformDirectory from "@/components/home/PlatformDirectory";
import AccessibilityCommitment from "@/components/home/AccessibilityCommitment";
import NewsletterSection from "@/components/home/NewsletterSection";

beforeAll(() => {
  // jsdom does not implement these; Radix and the a11y panel probe for them.
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  }
});

function renderPage(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AccessibilityProvider>{ui}</AccessibilityProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/**
 * axe catches the mechanical WCAG failures — unlabelled controls, broken
 * heading order, missing landmarks, images without alternatives. It cannot
 * judge whether the wording is respectful or whether a screen reader flow makes
 * sense, so passing these is a floor and not a certificate.
 */
describe("accessibility (axe)", () => {
  it("the whole homepage has no violations", async () => {
    const { container } = renderPage(<Index />);
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  const sections: [string, React.ReactElement][] = [
    ["hero", <HeroSection key="h" />],
    ["platform directory", <PlatformDirectory key="p" />],
    ["accessibility commitment", <AccessibilityCommitment key="a" />],
    ["newsletter", <NewsletterSection key="n" />],
  ];

  it.each(sections)("%s has no violations", async (_name, ui) => {
    const { container } = renderPage(ui);
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);
});

describe("document structure", () => {
  it("exposes a main landmark and a skip link that targets it", () => {
    const { container } = renderPage(<Index />);

    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main?.id).toBe("main-content");

    const skip = container.querySelector('a[href="#main-content"]');
    expect(skip).not.toBeNull();
    expect(skip?.textContent).toMatch(/skip to main content/i);
  });

  it("has exactly one h1", () => {
    const { container } = renderPage(<Index />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("does not skip heading levels", () => {
    const { container } = renderPage(<Index />);
    const levels = Array.from(
      container.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    ).map((h) => Number(h.tagName[1]));

    for (let i = 1; i < levels.length; i++) {
      // A jump from h2 straight to h4 leaves screen-reader users guessing at
      // the nesting they cannot see.
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * Guards the guard.
 *
 * If the axe matcher is ever mis-registered — a version bump changing the
 * export shape, a missing expect.extend — every assertion above would pass
 * vacuously and report a clean bill of health for markup nobody checked.
 * These two assert that known-bad markup is still detected.
 */
describe("axe harness", () => {
  it("detects an unlabelled input", async () => {
    const { container } = render(<input type="text" />);
    const results = await axe(container);
    expect(results.violations.map((v) => v.id)).toContain("label");
  });

  it("detects an image with no alt text", async () => {
    const { container } = render(<img src="x.png" />);
    const results = await axe(container);
    expect(results.violations.map((v) => v.id)).toContain("image-alt");
  });
});
