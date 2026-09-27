import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Accessibility, LogOut, ShieldCheck, KeyRound, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AccessibilityPanel from "@/components/AccessibilityPanel";
import { isAuthPage } from "@/lib/url";

interface NavLink {
  label: string;
  href: string;
  /** Shown only to people who are fully signed in. */
  signedInOnly?: boolean;
}

const navLinks: NavLink[] = [
  { label: "Problems", href: "/problems" },
  { label: "Pitches", href: "/pitches" },
  { label: "Feed", href: "/feed" },
  { label: "Jobs", href: "/jobs" },
  { label: "Learn", href: "/learn" },
  { label: "Opportunities", href: "/opportunities" },
  { label: "Connect", href: "/connect" },
  { label: "Companion", href: "/companion", signedInOnly: true },
];

const isCurrent = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, mfaRequired, signOut } = useAuth();

  const links = navLinks.filter((link) => !link.signedInOnly || user);

  // Bring people back to the page they were on once they have signed in.
  const here = location.pathname + location.search;
  const withNext = (path: string) =>
    location.pathname === "/" || isAuthPage(location.pathname)
      ? path
      : `${path}?next=${encodeURIComponent(here)}`;

  // Any navigation (a link here, the back button, a redirect) closes the menu.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  // Escape closes the menu and returns focus to the button that opened it.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await signOut();
    setSigningOut(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("You are signed out");
    setMobileOpen(false);
    if (location.pathname === "/") {
      // No page change, so Layout will not move focus; the button that had it
      // has just disappeared.
      document.getElementById("main-content")?.focus();
    } else {
      navigate("/");
    }
  };

  const linkClass = (href: string, mobile: boolean) =>
    [
      mobile
        ? "flex min-h-11 items-center rounded-md px-3 py-2 text-base font-medium transition-colors hover:bg-secondary"
        : "inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-secondary-foreground",
      isCurrent(location.pathname, href) ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
    ].join(" ");

  const signOutLabel = signingOut ? "Signing out…" : "Sign out";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* The row may wrap onto a second line rather than scroll sideways: link
          widths grow with the text-size setting, and media queries do not. */}
      <nav
        className="container flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
        aria-label="Main navigation"
      >
        <Link
          to="/"
          className="flex min-h-11 min-w-0 items-center gap-2 font-heading text-xl font-bold text-foreground"
          aria-label="Abilitiverse home"
        >
          <Accessibility className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">Abilitiverse</span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden flex-wrap items-center gap-1 lg:flex" role="list">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                className={linkClass(link.href, false)}
                aria-current={isCurrent(location.pathname, link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden min-w-0 flex-wrap items-center justify-end gap-2 lg:flex">
          <AccessibilityPanel />
          {loading ? null : user ? (
            <>
              <span
                className="hidden max-w-[16ch] truncate text-sm text-muted-foreground xl:inline"
                title={user.email ?? undefined}
              >
                {user.email}
              </span>
              <Button variant="ghost" size="sm" className="min-h-11" asChild>
                <Link to="/profile">
                  <UserRound className="mr-1 h-4 w-4" aria-hidden="true" /> Profile
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="min-h-11" asChild>
                <Link to="/security" aria-label="Account security settings">
                  <ShieldCheck className="mr-1 h-4 w-4" aria-hidden="true" /> Security
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="min-h-11" onClick={handleSignOut} disabled={signingOut}>
                <LogOut className="mr-1 h-4 w-4" aria-hidden="true" /> {signOutLabel}
              </Button>
            </>
          ) : mfaRequired ? (
            <>
              <Button size="sm" className="min-h-11" asChild>
                <Link to={withNext("/login")}>
                  <KeyRound className="mr-1 h-4 w-4" aria-hidden="true" /> Finish signing in
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="min-h-11" onClick={handleSignOut} disabled={signingOut}>
                <LogOut className="mr-1 h-4 w-4" aria-hidden="true" /> {signOutLabel}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="min-h-11" asChild>
                <Link to={withNext("/login")}>Sign in</Link>
              </Button>
              <Button size="sm" className="min-h-11" asChild>
                <Link to={withNext("/signup")}>Join Community</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          <AccessibilityPanel />
          <button
            ref={toggleRef}
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {/* Kept in the DOM while closed so aria-controls always points at it. */}
      <div
        id="mobile-menu"
        hidden={!mobileOpen}
        className="border-t border-border bg-background px-4 pb-4 lg:hidden"
      >
        <nav aria-label="Mobile navigation">
          <ul className="flex flex-col gap-1 pt-2" role="list">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={linkClass(link.href, true)}
                  aria-current={isCurrent(location.pathname, link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-3 flex flex-col gap-2">
          {loading ? null : user ? (
            <>
              {user.email && (
                <p className="px-3 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  Signed in as {user.email}
                </p>
              )}
              <Button variant="outline" className="min-h-11" asChild>
                <Link to="/profile" onClick={() => setMobileOpen(false)}>
                  <UserRound className="mr-1 h-4 w-4" aria-hidden="true" /> Profile
                </Link>
              </Button>
              <Button variant="outline" className="min-h-11" asChild>
                <Link to="/security" onClick={() => setMobileOpen(false)}>
                  <ShieldCheck className="mr-1 h-4 w-4" aria-hidden="true" /> Security
                </Link>
              </Button>
              <Button variant="outline" className="min-h-11" onClick={handleSignOut} disabled={signingOut}>
                <LogOut className="mr-1 h-4 w-4" aria-hidden="true" /> {signOutLabel}
              </Button>
            </>
          ) : mfaRequired ? (
            <>
              <Button className="min-h-11" asChild>
                <Link to={withNext("/login")} onClick={() => setMobileOpen(false)}>
                  <KeyRound className="mr-1 h-4 w-4" aria-hidden="true" /> Finish signing in
                </Link>
              </Button>
              <Button variant="outline" className="min-h-11" onClick={handleSignOut} disabled={signingOut}>
                <LogOut className="mr-1 h-4 w-4" aria-hidden="true" /> {signOutLabel}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="min-h-11" asChild>
                <Link to={withNext("/login")} onClick={() => setMobileOpen(false)}>
                  Sign in
                </Link>
              </Button>
              <Button className="min-h-11" asChild>
                <Link to={withNext("/signup")} onClick={() => setMobileOpen(false)}>
                  Join Community
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
