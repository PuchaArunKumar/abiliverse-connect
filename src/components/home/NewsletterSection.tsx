import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const NewsletterSection = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast.success("Thanks for subscribing! We'll keep you posted.");
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
            >
              Subscribe
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
