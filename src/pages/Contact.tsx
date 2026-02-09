import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";

const Contact = () => {
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      toast.success("Message sent! We'll get back to you soon.");
      setSending(false);
      (e.target as HTMLFormElement).reset();
    }, 800);
  };

  return (
    <Layout>
      <section className="container py-16">
        <div className="mx-auto max-w-lg">
          <h1 className="mb-2 font-heading text-3xl font-bold text-foreground">Contact Us</h1>
          <p className="mb-8 text-muted-foreground">Have a question or suggestion? We'd love to hear from you.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
              <Input id="contact-name" required className="min-h-[48px]" />
            </div>
            <div>
              <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <Input id="contact-email" type="email" required className="min-h-[48px]" />
            </div>
            <div>
              <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-foreground">Message</label>
              <Textarea id="contact-message" required rows={5} />
            </div>
            <Button type="submit" disabled={sending} className="min-h-[48px] w-full font-semibold">
              {sending ? "Sending…" : "Send Message"}
            </Button>
          </form>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
