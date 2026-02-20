import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { Mail, Phone, MapPin, Linkedin, Github, ExternalLink } from "lucide-react";

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
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-2 font-heading text-3xl font-bold text-foreground">Get In Touch</h1>
          <p className="mb-8 text-muted-foreground">Let's Connect</p>

          <div className="grid gap-10 md:grid-cols-2">
            {/* Contact Info */}
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Email</h3>
                  <a href="mailto:puchaarunkumar@gmail.com" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    puchaarunkumar@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Phone</h3>
                  <a href="tel:+919550020383" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    +91 9550020383
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Location</h3>
                  <p className="text-sm text-muted-foreground">Visakhapatnam, India</p>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Connect with me</h3>
                <div className="flex gap-3">
                  <a
                    href="https://www.linkedin.com/in/pucha-arun-kumar/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="LinkedIn"
                  >
                    <Linkedin className="h-5 w-5" />
                  </a>
                  <a
                    href="https://github.com/PuchaArunKumar/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="GitHub"
                  >
                    <Github className="h-5 w-5" />
                  </a>
                  <a
                    href="https://mail.google.com/mail/u/0/?fs=1&to=puchaarunkumar@gmail.com&tf=cm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="Send Email via Gmail"
                  >
                    <Mail className="h-5 w-5" />
                  </a>
                  <a
                    href="https://arun-s-ai-portfolio.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    aria-label="Portfolio"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
                <Input id="contact-name" placeholder="Your name" required className="min-h-[48px]" />
              </div>
              <div>
                <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <Input id="contact-email" type="email" placeholder="your@email.com" required className="min-h-[48px]" />
              </div>
              <div>
                <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-foreground">Message</label>
                <Textarea id="contact-message" placeholder="Your message..." required rows={5} />
              </div>
              <Button type="submit" disabled={sending} className="min-h-[48px] w-full font-semibold">
                {sending ? "Sending…" : "Send Message"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
