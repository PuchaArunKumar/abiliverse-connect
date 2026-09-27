import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: string, session: unknown) => void;

interface AalAnswer {
  data: { currentLevel: string | null; nextLevel: string | null } | null;
  error: Error | null;
}

const mocks = vi.hoisted(() => ({
  listeners: [] as Array<(event: string, session: unknown) => void>,
  getSession: vi.fn(),
  getAal: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      storageKey: "sb-test-auth-token",
      onAuthStateChange: (callback: Listener) => {
        mocks.listeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                mocks.listeners = mocks.listeners.filter((l) => l !== callback);
              },
            },
          },
        };
      },
      getSession: mocks.getSession,
      signOut: mocks.signOut,
      mfa: { getAuthenticatorAssuranceLevel: mocks.getAal },
    },
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const session = (factorStatus?: "verified" | "unverified") => ({
  access_token: "token",
  user: {
    id: "user-1",
    email: "person@example.com",
    factors: factorStatus ? [{ id: "f1", factor_type: "totp", status: factorStatus }] : [],
  },
});

const aal = (currentLevel: string, nextLevel: string): AalAnswer => ({
  data: { currentLevel, nextLevel },
  error: null,
});

let signOutResult: { error: Error | null } | null = null;

const Probe = () => {
  const auth = useAuth();
  return (
    <div>
      <p data-testid="loading">{String(auth.loading)}</p>
      <p data-testid="user">{auth.user?.id ?? "none"}</p>
      <p data-testid="session">{auth.session ? "yes" : "no"}</p>
      <p data-testid="mfa">{String(auth.mfaRequired)}</p>
      <button
        type="button"
        onClick={async () => {
          signOutResult = await auth.signOut();
        }}
      >
        sign out
      </button>
    </div>
  );
};

const renderAuth = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

const emit = (event: string, value: unknown) => {
  act(() => {
    for (const listener of mocks.listeners) listener(event, value);
  });
};

const text = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  mocks.listeners = [];
  mocks.getSession.mockReset();
  mocks.getAal.mockReset();
  mocks.signOut.mockReset();
  signOutResult = null;
  localStorage.clear();
});

describe("AuthProvider assurance-level gating", () => {
  it("stays loading, with nobody signed in, until the assurance level is known", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session() } });
    let answer: (value: AalAnswer) => void = () => {};
    mocks.getAal.mockReturnValue(new Promise<AalAnswer>((resolve) => (answer = resolve)));

    renderAuth();
    await waitFor(() => expect(mocks.getAal).toHaveBeenCalled());
    expect(text("loading")).toBe("true");
    expect(text("user")).toBe("none");

    await act(async () => answer(aal("aal1", "aal1")));
    expect(text("loading")).toBe("false");
    expect(text("user")).toBe("user-1");
    expect(text("mfa")).toBe("false");
  });

  it("reports signed out when there is no session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    renderAuth();
    await waitFor(() => expect(text("loading")).toBe("false"));
    expect(text("user")).toBe("none");
    expect(text("mfa")).toBe("false");
    expect(mocks.getAal).not.toHaveBeenCalled();
  });

  it("hides the user and session while a verified factor still needs a code", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session("verified") } });
    mocks.getAal.mockResolvedValue(aal("aal1", "aal2"));

    renderAuth();
    await waitFor(() => expect(text("loading")).toBe("false"));
    expect(text("user")).toBe("none");
    expect(text("session")).toBe("no");
    expect(text("mfa")).toBe("true");
  });

  it("admits the user after the code is verified and the SDK emits its event", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session("verified") } });
    mocks.getAal.mockResolvedValue(aal("aal1", "aal2"));
    renderAuth();
    await waitFor(() => expect(text("mfa")).toBe("true"));

    mocks.getAal.mockResolvedValue(aal("aal2", "aal2"));
    emit("MFA_CHALLENGE_VERIFIED", session("verified"));

    await waitFor(() => expect(text("user")).toBe("user-1"));
    expect(text("session")).toBe("yes");
    expect(text("mfa")).toBe("false");
    expect(text("loading")).toBe("false");
  });

  it("never asks for the assurance level inside the auth callback, which holds the SDK lock", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    renderAuth();
    await waitFor(() => expect(text("loading")).toBe("false"));

    mocks.getAal.mockResolvedValue(aal("aal1", "aal1"));
    let callsDuringCallback = -1;
    act(() => {
      for (const listener of mocks.listeners) listener("SIGNED_IN", session());
      callsDuringCallback = mocks.getAal.mock.calls.length;
    });
    expect(callsDuringCallback).toBe(0);
    await waitFor(() => expect(text("user")).toBe("user-1"));
    // Both happen after the callback: the cached answer, then (for an aal1
    // session) the live one that catches two-factor enabled elsewhere.
    expect(mocks.getAal).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the level cannot be read for someone with a verified factor", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session("verified") } });
    mocks.getAal.mockResolvedValue({ data: null, error: new Error("no") });

    renderAuth();
    await waitFor(() => expect(text("loading")).toBe("false"));
    expect(text("user")).toBe("none");
    expect(text("mfa")).toBe("true");
  });

  it("does not let a slow answer about an old session override a newer event", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    renderAuth();
    await waitFor(() => expect(text("loading")).toBe("false"));

    let answer: (value: AalAnswer) => void = () => {};
    mocks.getAal.mockReturnValueOnce(new Promise<AalAnswer>((resolve) => (answer = resolve)));
    emit("SIGNED_IN", session());
    await waitFor(() => expect(mocks.getAal).toHaveBeenCalledTimes(1));
    emit("SIGNED_OUT", null);
    await act(async () => answer(aal("aal1", "aal1")));

    expect(text("user")).toBe("none");
    expect(text("loading")).toBe("false");
  });
});

describe("AuthProvider signOut", () => {
  it("returns no error when the server confirms", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session() } });
    mocks.getAal.mockResolvedValue(aal("aal1", "aal1"));
    mocks.signOut.mockImplementation(async () => {
      for (const listener of mocks.listeners) listener("SIGNED_OUT", null);
      return { error: null };
    });
    renderAuth();
    await waitFor(() => expect(text("user")).toBe("user-1"));

    await act(async () => screen.getByRole("button", { name: "sign out" }).click());
    await waitFor(() => expect(signOutResult).not.toBeNull());
    expect(signOutResult?.error).toBeNull();
    expect(text("user")).toBe("none");
  });

  it("reports the failure, and forgets the session on this device, when the server cannot be reached", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session() } });
    mocks.getAal.mockResolvedValue(aal("aal1", "aal1"));
    mocks.signOut.mockResolvedValue({ error: new Error("Failed to fetch") });
    localStorage.setItem("sb-test-auth-token", "{}");
    renderAuth();
    await waitFor(() => expect(text("user")).toBe("user-1"));

    await act(async () => screen.getByRole("button", { name: "sign out" }).click());
    await waitFor(() => expect(signOutResult).not.toBeNull());
    expect(signOutResult?.error).toBeInstanceOf(Error);
    expect(localStorage.getItem("sb-test-auth-token")).toBeNull();
    expect(text("user")).toBe("none");
  });
});

describe("AuthProvider sees two-factor turned on from another device", () => {
  it("asks the server when the cached factors say there is no second factor", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session() } });
    // Cached answer (no token): nothing to step up to. Live answer (with the
    // token): a verified factor now exists, so this aal1 session is gated.
    mocks.getAal.mockImplementation(async (jwt?: string) =>
      jwt ? aal("aal1", "aal2") : aal("aal1", "aal1"),
    );

    renderAuth();
    await waitFor(() => expect(text("loading")).toBe("false"));
    expect(mocks.getAal).toHaveBeenCalledWith("token");
    expect(text("mfa")).toBe("true");
    expect(text("user")).toBe("none");
  });

  it("keeps the cached answer when the server cannot be reached", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session() } });
    mocks.getAal.mockImplementation(async (jwt?: string) =>
      jwt ? { data: null, error: new Error("offline") } : aal("aal1", "aal1"),
    );

    renderAuth();
    await waitFor(() => expect(text("loading")).toBe("false"));
    expect(text("mfa")).toBe("false");
    expect(text("user")).toBe("user-1");
  });

  it("does not ask the server again for a session that already passed two-factor", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: session("verified") } });
    mocks.getAal.mockResolvedValue(aal("aal2", "aal2"));

    renderAuth();
    await waitFor(() => expect(text("loading")).toBe("false"));
    expect(mocks.getAal).toHaveBeenCalledTimes(1);
    expect(mocks.getAal).not.toHaveBeenCalledWith("token");
    expect(text("user")).toBe("user-1");
  });
});

describe("AuthProvider sign-out scope", () => {
  const ScopedProbe = () => {
    const auth = useAuth();
    return (
      <button type="button" onClick={() => void auth.signOut("local")}>
        cancel
      </button>
    );
  };

  it("passes a local scope through, so other devices stay signed in", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.signOut.mockResolvedValue({ error: null });
    render(
      <AuthProvider>
        <ScopedProbe />
      </AuthProvider>,
    );
    await act(async () => screen.getByRole("button", { name: "cancel" }).click());
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
