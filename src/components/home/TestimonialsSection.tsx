const testimonials = [
  {
    quote: "Abilitiverse helped me find a co-founder for my assistive navigation app. We launched within 6 months.",
    name: "Priya Sharma",
    role: "Founder, NavAssist",
  },
  {
    quote: "As an investor, I discovered incredible AT startups here that I wouldn't have found anywhere else.",
    name: "Marcus Chen",
    role: "Angel Investor",
  },
  {
    quote: "The AI Companion changed my daily routine. Simple, supportive, and designed for people like me.",
    name: "Jordan Williams",
    role: "End User & Advocate",
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-20 lg:py-24" aria-labelledby="testimonials-heading">
      <div className="container">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2
            id="testimonials-heading"
            className="mb-4 font-heading text-3xl font-bold text-foreground md:text-4xl"
          >
            Voices from the community
          </h2>
          <p className="text-lg text-muted-foreground">
            Real stories from people building a more accessible world.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <blockquote
              key={t.name}
              className="flex flex-col rounded-xl border border-border bg-card p-6"
            >
              <p className="mb-4 flex-1 text-base leading-relaxed text-card-foreground">
                "{t.quote}"
              </p>
              <footer>
                <p className="font-heading text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.role}</p>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
