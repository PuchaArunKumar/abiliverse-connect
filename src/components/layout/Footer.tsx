import { Link } from "react-router-dom";
import { Accessibility, Linkedin, Github, Mail } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-muted/50" role="contentinfo">
      <div className="container py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-foreground">
              <Accessibility className="h-6 w-6 text-primary" aria-hidden="true" />
              Abilitiverse
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connecting the assistive technology community to accelerate innovation and impact.
            </p>
          </div>
          <div>
            <h3 className="mb-3 font-heading text-sm font-semibold text-foreground">Platform</h3>
            <ul className="space-y-2 text-sm" role="list">
              <li><Link to="/feed" className="text-muted-foreground hover:text-foreground transition-colors">Community Feed</Link></li>
              <li><Link to="/connect" className="text-muted-foreground hover:text-foreground transition-colors">Connect</Link></li>
              <li><Link to="/pitches" className="text-muted-foreground hover:text-foreground transition-colors">Pitch Platform</Link></li>
              <li><Link to="/companion" className="text-muted-foreground hover:text-foreground transition-colors">AI Companion</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 font-heading text-sm font-semibold text-foreground">Company</h3>
            <ul className="space-y-2 text-sm" role="list">
              <li><Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
              <li><Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
              <li><Link to="/support" className="text-muted-foreground hover:text-foreground transition-colors">Support</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 font-heading text-sm font-semibold text-foreground">Let's Connect</h3>
            <div className="flex gap-3 mb-4">
              <a href="https://www.linkedin.com/in/pucha-arun-kumar/" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="LinkedIn">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="https://github.com/PuchaArunKumar/" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="GitHub">
                <Github className="h-4 w-4" />
              </a>
              <a href="mailto:puchaarunkumar@gmail.com" className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary hover:bg-primary hover:text-primary-foreground transition-colors" aria-label="Email">
                <Mail className="h-4 w-4" />
              </a>
            </div>
            <ul className="space-y-2 text-sm" role="list">
              <li><Link to="/privacy-policy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link to="/accessibility-statement" className="text-muted-foreground hover:text-foreground transition-colors">Accessibility</Link></li>
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
