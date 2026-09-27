import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const linkClass = "font-medium text-primary underline underline-offset-4";

interface Faq {
  q: string;
  a: ReactNode;
}

// Every answer describes what the site does today. An FAQ that sends people
// looking for a button that is not there costs most for the people who rely
// on following instructions step by step.
const FAQS: Faq[] = [
  {
    q: "How do I create an account?",
    a: (
      <>
        Select <Link to="/signup" className={linkClass}>Join Community</Link> and sign up with your
        email address and a password. If you have a Google account, you can instead use Sign in
        with Google on the <Link to="/login" className={linkClass}>Sign in</Link> page.
      </>
    ),
  },
  {
    q: "Is Abilitiverse free to use?",
    a: "Yes. There is no charge to join or to use any part of Abilitiverse.",
  },
  {
    q: "How do I keep my account secure?",
    a: (
      <>
        You can turn on two-factor authentication with an authenticator app on the{" "}
        <Link to="/security" className={linkClass}>Security</Link> page. After that, signing in
        asks for a 6-digit code from the app as well as your password.
      </>
    ),
  },
  {
    q: "How do I submit a pitch?",
    a: (
      <>
        Sign in, open the <Link to="/pitches" className={linkClass}>Pitch Platform</Link> and select
        Submit a pitch. Other members can support your pitch and leave feedback, and funders or
        mentors can send you a private interest request. Abilitiverse does not handle money: any
        funding or agreement is arranged directly between you and them.
      </>
    ),
  },
  {
    q: "What is the Companion?",
    a: (
      <>
        The <Link to="/companion" className={linkClass}>Companion</Link> helps you keep private daily
        routines, broken into small steps. It reminds you of what is next while the page is open,
        and you can download your routines as a calendar (.ics) file so your own calendar app can
        remind you too. Only you can see your routines. It is not an AI chatbot.
      </>
    ),
  },
  {
    q: "How do I document an accessibility problem I face?",
    a: (
      <>
        Sign in and use Report a problem in the{" "}
        <Link to="/problems" className={linkClass}>Problem repository</Link>. Search first: someone
        may already have described it, and you can add your voice to theirs.
      </>
    ),
  },
  {
    q: "Something on this site is hard to use. Who do I tell?",
    a: (
      <>
        Please tell us through the <Link to="/contact" className={linkClass}>Contact</Link> page.
        Our <Link to="/accessibility-statement" className={linkClass}>accessibility statement</Link>{" "}
        explains what we aim for and the settings you can change.
      </>
    ),
  },
];

const Support = () => {
  useDocumentTitle("Support and FAQs");
  return (
    <Layout>
      <section className="container py-16">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-6 font-heading text-3xl font-bold text-foreground">Support & FAQs</h1>
          <div className="space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-2 font-heading text-base font-semibold text-card-foreground">
                  {faq.q}
                </h2>
                <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Support;
