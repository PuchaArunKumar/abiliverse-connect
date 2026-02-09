import Layout from "@/components/layout/Layout";

const Support = () => (
  <Layout>
    <section className="container py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-heading text-3xl font-bold text-foreground">Support & FAQs</h1>
        <div className="space-y-6">
          {[
            { q: "How do I create an account?", a: "Click 'Join Community' and sign up with your email or Google account." },
            { q: "Is Abilitiverse free to use?", a: "Yes! Core features are free. Premium features for organizations may be offered in the future." },
            { q: "How do I submit a pitch?", a: "Navigate to the Pitch Platform, sign in, and click 'Submit a Pitch' to get started." },
            { q: "Who is the AI Companion for?", a: "Alex is designed for anyone, with a special focus on users with cognitive disabilities. It provides simple, supportive guidance." },
          ].map((faq) => (
            <div key={faq.q} className="rounded-lg border border-border bg-card p-5">
              <h2 className="mb-2 font-heading text-base font-semibold text-card-foreground">{faq.q}</h2>
              <p className="text-sm text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  </Layout>
);

export default Support;
