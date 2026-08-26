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
            className="min-h-12 flex-1 bg-background"
            aria-describedby="newsletter-desc"
          />
          <span id="newsletter-desc" className="sr-only">
            Enter your email to subscribe to our newsletter
          </span>
          <Button
            type="submit"
            className="min-h-12 font-semibold"
            disabled={saving}
          >
            {saving ? "Subscribing..." : "Subscribe"}
          </Button>
        </form>
      </div>
    </section>
  );
};

export default NewsletterSection;
