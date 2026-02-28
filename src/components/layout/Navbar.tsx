import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Accessibility, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const navLinks = [
  { label: "Feed", href: "/feed" },
  { label: "Connect", href: "/connect" },
  { label: "Pitches", href: "/pitches" },
  { label: "AI Companion", href: "/companion" },
  { label: "About", href: "/about" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <nav
        className="container flex h-16 items-center justify-between"
        aria-label="Main navigation"
      >
        <Link
          to="/"
          className="flex items-center gap-2 font-heading text-xl font-bold text-foreground"
          aria-label="Abilitiverse home"
        >
          <Accessibility className="h-7 w-7 text-primary" aria-hidden="true" />
          <span>Abilitiverse</span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-1 md:flex" role="list">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-secondary-foreground ${
                  location.pathname === link.href
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" /> Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">Join Community</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          className="border-t border-border bg-background px-4 pb-4 md:hidden"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <ul className="flex flex-col gap-1 pt-2" role="list">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-md px-3 py-3 text-base font-medium transition-colors hover:bg-secondary ${
                    location.pathname === link.href
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2">
            {user ? (
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" /> Sign Out
              </Button>
            ) : (
              <>
                <Button variant="outline" asChild>
                  <Link to="/login" onClick={() => setMobileOpen(false)}>Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup" onClick={() => setMobileOpen(false)}>Join Community</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
