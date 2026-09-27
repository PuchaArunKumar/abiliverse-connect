import { useRef, useState } from "react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { isMissingSchemaError } from "@/lib/supabase-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ExternalLink, Github, Linkedin, Loader2, Mail, MapPin, Phone } from "lucide-react";
import Field from "@/components/community/Field";
import { friendlyError } from "@/components/community/errors";
import { useFocusRequest } from "@/components/community/useFocusRequest";
import {
  CONTACT_FIELDS,
  LIMITS,
  firstErrorField,
  validateContact,
  type ContactField,
  type ContactForm,
  type FieldErrors,
} from "@/components/community/validation";

const CONTACT_EMAIL = "puchaarunkumar@gmail.com";

const EMPTY_FORM: ContactForm = { name: "", email: "", topic: "", message: "" };

const FIELD_IDS: Record<ContactField, string> = {
  name: "contact-name",
  email: "contact-email",
  topic: "contact-topic",
  message: "contact-message",
};

const SENT_ID = "contact-sent";

const socialLinkClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-primary transition-colors hover:bg-primary hover:text-primary-foreground motion-reduce:transition-none";

type Status = "idle" | "sent" | "unavailable";

const Contact = () => {
  useDocumentTitle("Contact");
  const requestFocus = useFocusRequest();
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors<ContactField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [sentTo, setSentTo] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  const update = (key: ContactField, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendingRef.current) return;
    const { values, errors: found } = validateContact(form);
    setErrors(found);
    setFormError(null);
    const first = firstErrorField(CONTACT_FIELDS, found);
    if (first) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }

    sendingRef.current = true;
    setSending(true);
    // Clear an earlier "not available" notice so a repeat is announced again.
    setStatus("idle");
    const { error } = await supabase.rpc("send_contact_message", {
      _name: values.name,
      _email: values.email,
      _topic: values.topic,
      _message: values.message,
    });
    sendingRef.current = false;
    setSending(false);

    if (error) {
      if (isMissingSchemaError(error)) {
        // Say so, and keep what they wrote so it can be copied into an email.
        setStatus("unavailable");
        return;
      }
      // The database explains a refused value in a plain sentence of its own
      // (see send_contact_message); anything else gets a generic message.
      setFormError(
        error.code === "23514" && error.message
          ? error.message
          : friendlyError(error, "Your message could not be sent. Please try again, or email us instead."),
      );
      return;
    }

    setSentTo(values.email);
    setForm(EMPTY_FORM);
    setErrors({});
    setStatus("sent");
    requestFocus(SENT_ID);
  };

  const startAgain = () => {
    setStatus("idle");
    requestFocus(FIELD_IDS.name);
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
              <h2 className="sr-only">Contact details</h2>
              <div className="flex items-start gap-3">
                <Mail className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">Email</h3>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary [overflow-wrap:anywhere]"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Phone</h3>
                  <a href="tel:+919550020383" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    +91 9550020383
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Location</h3>
                  <p className="text-sm text-muted-foreground">Visakhapatnam, India</p>
                </div>
              </div>

              <div className="pt-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Connect with me</h3>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://www.linkedin.com/in/pucha-arun-kumar/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={socialLinkClass}
                    aria-label="LinkedIn (opens in a new tab)"
                  >
                    <Linkedin className="h-5 w-5" aria-hidden="true" />
                  </a>
                  <a
                    href="https://github.com/PuchaArunKumar/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={socialLinkClass}
                    aria-label="GitHub (opens in a new tab)"
                  >
                    <Github className="h-5 w-5" aria-hidden="true" />
                  </a>
                  <a
                    href={`https://mail.google.com/mail/u/0/?fs=1&to=${CONTACT_EMAIL}&tf=cm`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={socialLinkClass}
                    aria-label="Send Email via Gmail (opens in a new tab)"
                  >
                    <Mail className="h-5 w-5" aria-hidden="true" />
                  </a>
                  <a
                    href="https://arun-s-ai-portfolio.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={socialLinkClass}
                    aria-label="Portfolio (opens in a new tab)"
                  >
                    <ExternalLink className="h-5 w-5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="min-w-0">
              <h2 className="mb-4 font-heading text-xl font-semibold text-foreground">
                Send a message
              </h2>
              {status === "sent" ? (
                <div
                  id={SENT_ID}
                  tabIndex={-1}
                  role="status"
                  className="rounded-lg border border-border bg-card p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="flex items-start gap-2 font-medium text-foreground">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    Thank you. Your message was received.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    We will reply to {sentTo} as soon as we can.
                  </p>
                  <Button variant="outline" className="mt-4 min-h-11" onClick={startAgain}>
                    Send another message
                  </Button>
                </div>
              ) : (
                <>
                  {status === "unavailable" && (
                    <div
                      role="alert"
                      className="mb-4 rounded-lg border border-border bg-card p-4 text-sm text-foreground"
                    >
                      <p className="font-medium">The contact form is not available yet.</p>
                      <p className="mt-1 [overflow-wrap:anywhere]">
                        Your message has not been sent. Please email it to{" "}
                        <a
                          href={`mailto:${CONTACT_EMAIL}`}
                          className="font-medium text-primary underline underline-offset-4"
                        >
                          {CONTACT_EMAIL}
                        </a>
                        . What you wrote is still in the form below, so you can copy it.
                      </p>
                    </div>
                  )}
                  <form onSubmit={handleSubmit} noValidate className="space-y-4">
                    <Field id={FIELD_IDS.name} label="Name" error={errors.name}>
                      {(control) => (
                        <Input
                          {...control}
                          name="name"
                          autoComplete="name"
                          required
                          maxLength={LIMITS.contactName.max}
                          value={form.name}
                          onChange={(e) => update("name", e.target.value)}
                          className="min-h-12"
                        />
                      )}
                    </Field>
                    <Field id={FIELD_IDS.email} label="Email" hint="We reply to this address." error={errors.email}>
                      {(control) => (
                        <Input
                          {...control}
                          type="email"
                          name="email"
                          autoComplete="email"
                          required
                          maxLength={LIMITS.contactEmail.max}
                          value={form.email}
                          onChange={(e) => update("email", e.target.value)}
                          className="min-h-12"
                        />
                      )}
                    </Field>
                    <Field id={FIELD_IDS.topic} label="Topic (optional)" error={errors.topic}>
                      {(control) => (
                        <Input
                          {...control}
                          name="topic"
                          maxLength={LIMITS.contactTopic.max}
                          value={form.topic}
                          onChange={(e) => update("topic", e.target.value)}
                          className="min-h-12"
                        />
                      )}
                    </Field>
                    <Field
                      id={FIELD_IDS.message}
                      label="Message"
                      hint={`${LIMITS.contactMessage.min} to ${LIMITS.contactMessage.max.toLocaleString("en")} characters.`}
                      error={errors.message}
                    >
                      {(control) => (
                        <Textarea
                          {...control}
                          name="message"
                          required
                          rows={5}
                          value={form.message}
                          onChange={(e) => update("message", e.target.value)}
                        />
                      )}
                    </Field>
                    <div aria-live="assertive">
                      {formError && (
                        <p className="text-sm font-medium text-destructive dark:text-red-300 [overflow-wrap:anywhere]">
                          {formError}
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      aria-disabled={sending || undefined}
                      className="min-h-12 w-full font-semibold"
                    >
                      {sending ? (
                        <>
                          <Loader2
                            className="h-4 w-4 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                          Sending…
                        </>
                      ) : (
                        "Send Message"
                      )}
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
