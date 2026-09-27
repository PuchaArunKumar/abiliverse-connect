import { afterEach, describe, expect, it, vi } from "vitest";
import { appUrl, isAuthPage, safeNext } from "@/lib/url";

describe("safeNext", () => {
  it("keeps an in-app path with its query and hash", () => {
    expect(safeNext("/ok?x=1#h")).toBe("/ok?x=1#h");
    expect(safeNext("/problems/abc")).toBe("/problems/abc");
    expect(safeNext("/.lovable/oauth/consent?authorization_id=123")).toBe(
      "/.lovable/oauth/consent?authorization_id=123",
    );
  });

  it("falls back when there is nothing to return to", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext(null, "/feed")).toBe("/feed");
  });

  // Each of these resolves to another host in a browser, and React Router
  // follows a cross-origin target with location.assign.
  it.each([
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with path", "//evil.com/login"],
    ["backslash", "/\\evil.com"],
    ["backslash, as decoded from %5C", decodeURIComponent("/%5Cevil.com/login")],
    ["tab, as decoded from %09", decodeURIComponent("/%09/evil.com")],
    ["newline", "/\n/evil.com"],
    ["javascript: URL", "javascript:alert(1)"],
    ["absolute URL", "https://evil.com"],
    ["absolute URL to this origin", `${window.location.origin}/feed`],
    ["relative path", "feed"],
  ])("rejects %s", (_label, raw) => {
    expect(safeNext(raw)).toBe("/");
  });

  it("rejects control characters and backslashes that are still encoded", () => {
    // A double-encoded link reaches safeNext with these intact; one more
    // decode anywhere downstream would turn them into the vectors above.
    expect(safeNext("/%09/evil.com")).toBe("/");
    expect(safeNext("/%5Cevil.com")).toBe("/");
    expect(safeNext("/%0a/evil.com")).toBe("/");
    expect(safeNext("/search?q=%20ok")).toBe("/search?q=%20ok");
  });

  it("never returns to a sign-in or password page", () => {
    expect(safeNext("/login")).toBe("/");
    expect(safeNext("/login?next=/feed")).toBe("/");
    expect(safeNext("/signup")).toBe("/");
    expect(safeNext("/reset-password")).toBe("/");
    expect(safeNext("/ok/../login")).toBe("/");
    expect(safeNext("/loginhelp")).toBe("/loginhelp");
  });

  it("normalises dot segments without leaving the site", () => {
    expect(safeNext("/a/../feed")).toBe("/feed");
  });
});

describe("isAuthPage", () => {
  it("matches only the auth pages", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/forgot-password")).toBe(true);
    expect(isAuthPage("/feed")).toBe(false);
    expect(isAuthPage("/")).toBe(false);
  });
});

describe("appUrl", () => {
  it("builds an absolute URL on this origin for a root build", () => {
    expect(appUrl("/reset-password")).toBe(`${window.location.origin}/reset-password`);
    expect(appUrl("/")).toBe(`${window.location.origin}/`);
  });
});

describe("on a sub-path build (GitHub Pages)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const loadWithBase = async (base: string) => {
    vi.stubEnv("BASE_URL", base);
    vi.resetModules();
    return import("@/lib/url");
  };

  it("adds the base path to absolute app URLs", async () => {
    const url = await loadWithBase("/abiliverse-connect/");
    expect(url.appUrl("/reset-password")).toBe(`${window.location.origin}/abiliverse-connect/reset-password`);
  });

  it("strips the base path from next, since the router adds it back", async () => {
    const url = await loadWithBase("/abiliverse-connect/");
    expect(url.safeNext("/abiliverse-connect/feed?x=1")).toBe("/feed?x=1");
    expect(url.safeNext("/abiliverse-connect")).toBe("/");
    expect(url.safeNext("/feed")).toBe("/feed");
    // Stripping must not uncover a protocol-relative path.
    expect(url.safeNext("/abiliverse-connect//evil.com")).toBe("/");
  });
});
