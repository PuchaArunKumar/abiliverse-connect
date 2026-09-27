import { Link } from "react-router-dom";
import { Accessibility, Linkedin, Github, Mail } from "lucide-react";

const linkClass =
  "inline-flex min-h-11 items-center text-muted-foreground transition-colors hover:text-foreground";

const iconLinkClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary transition-colors hover:bg-primary hover:text-primary-foreground";

/**
 * Column headings are h2, not h3: the footer follows whatever the page's last
 * heading was, and on a page with only an h1 an h3 here skipped a level.
 */
const Footer = () => {
  return (
    <footer className="border-t border-border bg-muted/50">
      <div className="container py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link
              to="/"
              className="mb-4 inline-flex min-h-11 items-center gap-2 font-heading text-lg font-bold text-foreground"
            >
              <Accessibility className="h-6 w-6 text-primary" aria-hidden="true" />
              Abilitiverse
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Connecting the assistive technology community to accelerate
              innovation and impact.
            </p>
          </div>

          <div>
            <h2 className="mb-2 font-heading text-sm font-semibold text-foreground">
              Platform
            </h2>
            <ul className="text-sm" role="list">
              <li><Link to="/feed" className={linkClass}>Community Feed</Link></li>
              <li><Link to="/connect" className={linkClass}>Connect</Link></li>
              <li><Link to="/pitches" className={linkClass}>Pitch Platform</Link></li>
              <li><Link to="/companion" className={linkClass}>Companion</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="mb-2 font-heading text-sm font-semibold text-foreground">
              Company
            </h2>
            <ul className="text-sm" role="list">
              <li><Link to="/about" className={linkClass}>About</Link></li>
              <li><Link to="/contact" className={linkClass}>Contact</Link></li>
              <li><Link to="/support" className={linkClass}>Support</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">
              Let's Connect
            </h2>
            <div className="mb-2 flex gap-3">
              <a
                href="https://www.linkedin.com/in/pucha-arun-kumar/"
                target="_blank"
                rel="noopener noreferrer"
                className={iconLinkClass}
                aria-label="LinkedIn (opens in a new tab)"
              >
                <Linkedin className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href="https://github.com/PuchaArunKumar/"
                target="_blank"
                rel="noopener noreferrer"
                className={iconLinkClass}
                aria-label="GitHub (opens in a new tab)"
              >
                <Github className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href="mailto:puchaarunkumar@gmail.com"
                className={iconLinkClass}
                aria-label="Email puchaarunkumar@gmail.com"
              >
                <Mail className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
            <ul className="text-sm" role="list">
              <li><Link to="/privacy-policy" className={linkClass}>Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className={linkClass}>Terms of Service</Link></li>
              <li><Link to="/accessibility-statement" className={linkClass}>Accessibility</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Abilitiverse. Built for everyone.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
