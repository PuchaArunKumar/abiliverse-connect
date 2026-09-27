import { beforeEach, describe, expect, it } from "vitest";
import {
  captureRecoveryFromHash,
  clearRecoverySession,
  isRecoverySession,
  markRecoverySession,
  sessionIdOf,
} from "@/lib/recovery";

/** A token-shaped string with the given claims; the signature is not checked. */
const token = (claims: Record<string, unknown>) => {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256" })}.${encode(claims)}.signature`;
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("sessionIdOf", () => {
  it("reads the session_id claim from a base64url payload", () => {
    expect(sessionIdOf(token({ session_id: "abc-123", aal: "aal1" }))).toBe("abc-123");
  });

  it("returns null for missing, malformed or claim-less tokens", () => {
    expect(sessionIdOf(null)).toBeNull();
    expect(sessionIdOf("not-a-token")).toBeNull();
    expect(sessionIdOf("a.%%%.c")).toBeNull();
    expect(sessionIdOf(token({ sub: "user" }))).toBeNull();
  });
});

describe("recovery marker", () => {
  it("recognises a later token of the same session, even after a refresh", () => {
    markRecoverySession(token({ session_id: "s1", exp: 1 }));
    // A refreshed access token keeps the session_id but changes everything else.
    expect(isRecoverySession(token({ session_id: "s1", exp: 2 }))).toBe(true);
  });

  it("does not accept a different session", () => {
    markRecoverySession(token({ session_id: "s1" }));
    expect(isRecoverySession(token({ session_id: "s2" }))).toBe(false);
  });

  it("is forgotten once cleared", () => {
    markRecoverySession(token({ session_id: "s1" }));
    clearRecoverySession();
    expect(isRecoverySession(token({ session_id: "s1" }))).toBe(false);
  });

  it("is captured from a recovery link's hash, and only from one", () => {
    const access = token({ session_id: "s9" });
    captureRecoveryFromHash(`#access_token=${access}&type=signup`);
    expect(isRecoverySession(access)).toBe(false);
    captureRecoveryFromHash(`#access_token=${access}&expires_in=3600&type=recovery`);
    expect(isRecoverySession(access)).toBe(true);
  });
});
