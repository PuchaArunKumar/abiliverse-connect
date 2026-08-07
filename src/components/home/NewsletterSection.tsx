import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NewsletterSection = () => {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) return;

    setSaving(true);
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: address });
    setSaving(false);

    // 23505 is a unique violation: this address is already on the list. Report
    // it as success rather than as an error, so the form does not become a way
    // to test whether a given address is subscribed.
    if (error && error.code !== "23505") {
      toast.error("Could not subscribe right now. Please try again.");
      return;
    }

    toast.success("You're subscribed. We'll keep you posted.");
    setEmail("");
  };

  return (
    <section className="bg-primary py-16" aria-labelledby="newsletter-heading">
      <div className="container">
        <div className="mx-auto max-w-xl text-center">
          <h2
            id="newsletter-heading"
            className="mb-3 font-heading text-2xl font-bold text-primary-foreground md:text-3xl"
          >
            Stay in the loop
          </h2>
          <p className="mb-6 text-primary-foreground/80">
            Get updates on new projects, events, and community highlights.
          </p>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 sm:flex-row"
            aria-label="Newsletter signup"
          >
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <Input
              id="newsletter-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={saving}
              className="min-h-[48px] flex-1 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/50"
              aria-describedby="newsletter-desc"
            />
            <span id="newsletter-desc" className="sr-only">
              Enter your email to subscribe to our newsletter
            </span>
            <Button
              type="submit"
              variant="secondary"
              className="min-h-[48px] font-semibold"
              disabled={saving}
            >
              {saving ? "Subscribing..." : "Subscribe"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
