import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeHref } from "@/lib/safe-url";

interface ExternalLinkButtonProps {
  /** A member-supplied address. Rendered only when it is plain http(s). */
  href: string | null | undefined;
  children: ReactNode;
  size?: "default" | "sm";
}

/**
 * A link to a member-supplied address, opening in a new tab.
 *
 * Anything that is not an absolute http(s) URL (a `javascript:` link sent
 * straight to the API, or a scheme-less "acme.com/careers" that would resolve
 * inside this app) renders nothing rather than a broken or unsafe link.
 */
const ExternalLinkButton = ({
  href,
  children,
  size = "default",
}: ExternalLinkButtonProps) => {
  const safe = safeHref(href);
  if (!safe) return null;
  return (
    <Button asChild variant="outline" size={size} className="min-h-11 whitespace-normal">
      <a href={safe} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </Button>
  );
};

export default ExternalLinkButton;
