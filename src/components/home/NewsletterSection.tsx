import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { isMissingSchemaError } from "@/lib/supabase-errors";
import { toast } from "sonner";

// A little stricter than subscribe_to_newsletter, which asks only for one "@":
// a domain with no dot is almost always a typo, and no confirmation email is
// sent yet that would catch it later.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;

function isValidEmail(address: string): boolean {
  return address.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(address);
}

const NewsletterSection = () => {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  // State updates land after a re-render, so a quick second press could slip
  // past `saving`; the ref closes that gap.
  const inFlight = useRef(false);
  const unavailableRef = useRef<HTMLParagraphElement>(null);

  // The form (and the button that had focus) is replaced by the notice, so
  // focus goes to the notice rather than falling to the top of the page.
  useEffect(() => {
    if (unavailable) unavailableRef.current?.focus();
  }, [unavailable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;

    const address = email.trim().toLowerCase();
    if (!isValidEmail(address)) {
      setFieldError("Enter an email address in the form name@example.com.");
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setFieldError(null);
    const { error } = await supabase.rpc("subscribe_to_newsletter", {
      _email: address,
    });
    inFlight.current = false;
    setSaving(false);

    if (isMissingSchemaError(error)) {
      setUnavailable(true);
      return;
    }

    // 23514 is the server's input check. 23505 (already on the list) is not
    // expected from the function, but if it ever surfaces it is reported as
    // success like everything else: the form must not become a way to test
    // whether a given address is subscribed.
    if (error?.code === "23514") {
      setFieldError("Enter an email address in the form name@example.com.");
      return;
    }
    if (error && error.code !== "23505") {
      toast.error("We couldn't sign you up just now. Please try again in a moment.");
      return;
    }

    toast.success("Thanks. You're on the list for updates.");
    setEmail("");
  };

  return (
    <section className="bg-muted/40 py-14" aria-labelledby="newsletter-heading">
      <div className="container grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
        <div>
          <h2
            id="newsletter-heading"
            className="font-heading text-2xl font-bold tracking-tight text-foreground"
          >
            Stay in the loop
          </h2>
          <p className="mt-2 text-muted-foreground">
            Occasional updates on new problems, research, and opportunities
            across the accessibility field. No more than monthly.
          </p>
        </div>

        {unavailable ? (
          <p
            ref={unavailableRef}
            tabIndex={-1}
            role="status"
            className="rounded-md border border-dashed border-border bg-background p-4 text-muted-foreground outline-none"
          >
            Newsletter sign-up isn't available yet. Please check back soon.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            aria-label="Newsletter signup"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <Input
                id="newsletter-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldError) setFieldError(null);
                }}
                required
                // readOnly, not disabled: disabling the field someone just
                // pressed Enter in drops their focus to the top of the page.
                readOnly={saving}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? "newsletter-error" : undefined}
                className="min-h-12 flex-1 bg-background"
              />
              <Button
                type="submit"
                className="min-h-12 font-semibold aria-disabled:cursor-not-allowed aria-disabled:opacity-70"
                aria-disabled={saving}
              >
                {saving ? "Subscribing…" : "Subscribe"}
              </Button>
            </div>
            {/* Always in the DOM, so screen readers are already watching it
                when the message is added. */}
            <div
              id="newsletter-error"
              role="alert"
              className="text-sm font-medium text-destructive"
            >
              {fieldError && <p className="mt-2">{fieldError}</p>}
            </div>
          </form>
        )}
      </div>
    </section>
  );
};

export default NewsletterSection;
