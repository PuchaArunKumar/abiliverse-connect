import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeAuth {
  user: { id: string; email: string } | null;
  session: object | null;
  loading: boolean;
  mfaRequired: boolean;
  signOut: () => Promise<{ error: Error | null }>;
}

const state = vi.hoisted(() => ({
  auth: null as unknown as FakeAuth,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => state.auth,
}));

vi.mock("sonner", () => ({
  toast: { success: state.toastSuccess, error: state.toastError },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: () =>
          Promise.resolve({ data: { totp: [{ id: "f1" }], all: [] }, error: null }),
      },
    },
  },
}));

// Imported after the mocks so they see the fakes.
import Navbar from "@/components/layout/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";

const signedOut = (): FakeAuth => ({
  user: null,
  session: null,
  loading: false,
  mfaRequired: false,
  signOut: vi.fn().mockResolvedValue({ error: null }),
});

const WhereAmI = () => {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
};

const renderAt = (path: string, element: React.ReactNode) =>
  render(
    <AccessibilityProvider>
      <MemoryRouter initialEntries={[path]}>
        {element}
        <WhereAmI />
      </MemoryRouter>
    </AccessibilityProvider>,
  );

beforeEach(() => {
  state.auth = signedOut();
  state.toastSuccess.mockReset();
  state.toastError.mockReset();
});

describe("Navbar", () => {
  it("offers sign-in links that return to the current page, and no Companion link", () => {
    renderAt("/problems?q=chair", <Navbar />);
    const desktop = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(desktop).getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fproblems%3Fq%3Dchair",
    );
    expect(within(desktop).getByRole("link", { name: "Pitches" })).toHaveAttribute("href", "/pitches");
    expect(within(desktop).queryByRole("link", { name: "Companion" })).toBeNull();
  });

  it("shows nothing about the account while auth is still loading", () => {
    state.auth = { ...signedOut(), loading: true };
    renderAt("/", <Navbar />);
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });

  it("offers to finish signing in, and to sign out, while a 2FA code is owed", () => {
    state.auth = { ...signedOut(), mfaRequired: true };
    renderAt("/problems", <Navbar />);
    const desktop = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(desktop).getByRole("link", { name: "Finish signing in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fproblems",
    );
    expect(within(desktop).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(within(desktop).queryByRole("link", { name: /security/i })).toBeNull();
    expect(within(desktop).queryByRole("link", { name: "Companion" })).toBeNull();
  });

  it("shows the signed-in controls and Companion link only for a signed-in user", () => {
    state.auth = { ...signedOut(), user: { id: "u1", email: "person@example.com" }, session: {} };
    renderAt("/", <Navbar />);
    const desktop = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(desktop).getByRole("link", { name: "Companion" })).toHaveAttribute("href", "/companion");
    expect(within(desktop).getByRole("link", { name: "Account security settings" })).toBeInTheDocument();
  });

  it("reports a failed sign-out as an error, never as success", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: new Error("Could not reach the server.") });
    state.auth = { ...signedOut(), user: { id: "u1", email: "p@example.com" }, session: {}, signOut };
    renderAt("/problems", <Navbar />);
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("button", {
        name: "Sign out",
      }),
    );
    await waitFor(() => expect(state.toastError).toHaveBeenCalledWith("Could not reach the server."));
    expect(state.toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByTestId("where")).toHaveTextContent("/problems");
  });

  it("goes home and says so after a successful sign-out", async () => {
    state.auth = { ...signedOut(), user: { id: "u1", email: "p@example.com" }, session: {} };
    renderAt("/problems", <Navbar />);
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("button", {
        name: "Sign out",
      }),
    );
    await waitFor(() => expect(state.toastSuccess).toHaveBeenCalled());
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
  });

  it("has a mobile menu toggle that reports its state and closes on Escape", () => {
    renderAt("/", <Navbar />);
    const toggle = screen.getByRole("button", { name: "Menu" });
    const menu = document.getElementById("mobile-menu");
    expect(toggle).toHaveAttribute("aria-controls", "mobile-menu");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(menu).not.toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(menu).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("closes the mobile menu when a link is followed", () => {
    renderAt("/", <Navbar />);
    const toggle = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(toggle);
    const mobile = screen.getByRole("navigation", { name: "Mobile navigation" });
    fireEvent.click(within(mobile).getByRole("link", { name: "Jobs" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/jobs");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

describe("ProtectedRoute", () => {
  const routes = (
    <Routes>
      <Route path="/login" element={<p>login page</p>} />
      <Route
        path="/feed"
        element={
          <ProtectedRoute>
            <p>secret feed</p>
          </ProtectedRoute>
        }
      />
    </Routes>
  );

  it("shows a loading status, not a redirect, while auth is loading", () => {
    state.auth = { ...signedOut(), loading: true };
    renderAt("/feed", routes);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/feed");
  });

  it("sends a signed-out visitor to sign in with the way back", () => {
    renderAt("/feed?tab=new", routes);
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/login?next=%2Ffeed%3Ftab%3Dnew");
  });

  it("treats someone who still owes a 2FA code as signed out", () => {
    state.auth = { ...signedOut(), mfaRequired: true };
    renderAt("/feed", routes);
    expect(screen.queryByText("secret feed")).toBeNull();
    expect(screen.getByTestId("where")).toHaveTextContent("/login?next=%2Ffeed");
  });

  it("lets a fully signed-in user through", () => {
    state.auth = { ...signedOut(), user: { id: "u1", email: "p@example.com" }, session: {} };
    renderAt("/feed", routes);
    expect(screen.getByText("secret feed")).toBeInTheDocument();
  });
});

describe("Login", () => {
  // Login leaves the tree once it navigates away, as it does in the app.
  const loginRoute = (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={null} />
    </Routes>
  );

  it("shows the two-factor challenge on arrival when a code is owed", async () => {
    state.auth = { ...signedOut(), mfaRequired: true };
    renderAt("/login?next=%2Ffeed", loginRoute);
    expect(screen.getByRole("heading", { level: 1, name: "Two-factor verification" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).toBeNull();
    await waitFor(() => expect(screen.getByLabelText("Authentication code")).toBeEnabled());
  });

  it("sends a signed-in user on to a safe next, ignoring an off-site one", () => {
    state.auth = { ...signedOut(), user: { id: "u1", email: "p@example.com" }, session: {} };
    renderAt(`/login?next=${encodeURIComponent("/\\evil.example/login")}`, loginRoute);
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
  });

  it("returns a signed-in user to the page they asked for", () => {
    state.auth = { ...signedOut(), user: { id: "u1", email: "p@example.com" }, session: {} };
    renderAt("/login?next=%2Ffeed%3Ftab%3Dnew", loginRoute);
    expect(screen.getByTestId("where")).toHaveTextContent("/feed?tab=new");
  });
});
