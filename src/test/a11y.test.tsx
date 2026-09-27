import { describe, expect, it, vi, beforeAll } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { configureAxe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

// jsdom does no layout or painting, so axe's colour-contrast rule cannot give
// an answer here (it only logs "not implemented" errors). It is switched off
// explicitly rather than left to fail silently: contrast is measured by hand,
// see docs/COLOR.md.
const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

// Supabase is mocked at the module boundary: these tests assert the accessibility
// of rendered markup, and should neither reach the network nor fail when the
// problem-repository tables do not yet exist.
vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: null };
  // rpc() is awaited directly (subscribe_to_newsletter) and also chained with
  // .single() (public_stats), so it returns a promise that has that method too.
  const rpc = () =>
    Object.assign(Promise.resolve(result), {
      single: () => Promise.resolve(result),
    });
  return {
    supabase: {
      from: () => ({
        select: () => Promise.resolve({ count: 0, data: [], error: null }),
        insert: () => Promise.resolve({ error: null }),
      }),
      rpc,
      auth: {
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
        getSession: () => Promise.resolve({ data: { session: null } }),
      },
    },
  };
});

import { AuthProvider } from "@/contexts/AuthContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import Index from "@/pages/Index";
import About from "@/pages/About";
import AccessibilityStatement from "@/pages/AccessibilityStatement";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";
import NotFound from "@/pages/NotFound";
import Footer from "@/components/layout/Footer";
import AccessibilityPanel from "@/components/AccessibilityPanel";
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

function renderPage(ui: React.ReactElement, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AccessibilityProvider>{ui}</AccessibilityProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

// Every page this suite covers, with its path and the tab title it must set
// (WCAG 2.4.2). The accessibility statement names exactly these pages, so keep
// the two in step.
const pages: [string, React.ReactElement, string, string][] = [
  ["homepage", <Index key="i" />, "/", "Abilitiverse"],
  ["about page", <About key="a" />, "/about", "About — Abilitiverse"],
  [
    "accessibility statement",
    <AccessibilityStatement key="s" />,
    "/accessibility-statement",
    "Accessibility statement — Abilitiverse",
  ],
  [
    "privacy policy",
    <PrivacyPolicy key="p" />,
    "/privacy-policy",
    "Privacy policy — Abilitiverse",
  ],
  [
    "terms of service",
    <TermsOfService key="t" />,
    "/terms-of-service",
    "Terms of service — Abilitiverse",
  ],
  [
    "page-not-found page",
    <NotFound key="n" />,
    "/no-such-page",
    "Page not found — Abilitiverse",
  ],
];

/**
 * axe catches the mechanical WCAG failures — unlabelled controls, broken
 * heading order, missing landmarks, images without alternatives. It cannot
 * judge whether the wording is respectful or whether a screen reader flow makes
 * sense, and in jsdom it cannot measure colour contrast, so passing these is a
 * floor and not a certificate.
 */
describe("accessibility (axe)", () => {
  it.each(pages)("the %s has no violations", async (_name, ui, path) => {
    const { container } = renderPage(ui, path);
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  const sections: [string, React.ReactElement][] = [
    ["hero", <HeroSection key="h" />],
    ["platform directory", <PlatformDirectory key="p" />],
    ["accessibility commitment", <AccessibilityCommitment key="a" />],
    ["newsletter", <NewsletterSection key="n" />],
    ["footer", <Footer key="f" />],
  ];

  it.each(sections)("%s has no violations", async (_name, ui) => {
    const { container } = renderPage(ui);
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("the open accessibility settings panel has no violations", async () => {
    renderPage(<AccessibilityPanel />);
    fireEvent.click(
      screen.getByRole("button", { name: "Open accessibility settings" }),
    );
    const dialog = await screen.findByRole("dialog");

    // A real radio group (arrow keys, one tab stop), not buttons that only
    // announce themselves as radios.
    const group = within(dialog).getByRole("radiogroup", { name: "Text size" });
    expect(within(group).getAllByRole("radio")).toHaveLength(4);
    expect(within(group).getByRole("radio", { name: "Default" })).toBeChecked();

    // The sheet renders in a portal outside the render container.
    expect(await axe(dialog)).toHaveNoViolations();
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

  it.each(pages)("the %s has exactly one h1", (_name, ui, path) => {
    const { container } = renderPage(ui, path);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it.each(pages)("the %s does not skip heading levels", (_name, ui, path) => {
    const { container } = renderPage(ui, path);
    const levels = Array.from(
      container.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    ).map((h) => Number(h.tagName[1]));

    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      // A jump from h2 straight to h4 leaves screen-reader users guessing at
      // the nesting they cannot see.
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  it.each(pages)("the %s sets its own document title", (_name, ui, path, title) => {
    document.title = "stale";
    renderPage(ui, path);
    expect(document.title).toBe(title);
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
