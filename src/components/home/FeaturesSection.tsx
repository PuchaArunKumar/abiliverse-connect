import { Users, Lightbulb, MessageSquare, Calendar, Bot, Cpu } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Connect & Network",
    description: "Find developers, investors, mentors, and end users who share your passion for accessible technology.",
  },
  {
    icon: Lightbulb,
    title: "Pitch Platform",
    description: "Submit your assistive tech idea, find funding, and get feedback from the community that matters.",
  },
  {
    icon: MessageSquare,
    title: "Community Feed",
    description: "Share knowledge, ask questions, and stay connected with the latest in assistive technology.",
  },
  {
    icon: Calendar,
    title: "Events & Opportunities",
    description: "Discover hackathons, grants, conferences, and career opportunities in the AT space.",
  },
  {
    icon: Bot,
    title: "AI Companion",
    description: "Meet Alex — a friendly AI assistant designed with cognitive accessibility in mind.",
  },
  {
    icon: Cpu,
    title: "Open-Source Devices",
    description: "Explore and contribute to open-source assistive technology hardware and software projects.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-20 lg:py-24" aria-labelledby="features-heading">
      <div className="container">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2
            id="features-heading"
            className="mb-4 font-heading text-3xl font-bold text-foreground md:text-4xl"
          >
            Everything your idea needs to grow
          </h2>
          <p className="text-lg text-muted-foreground">
            One platform to connect, collaborate, pitch, and build accessible technology together.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-primary">
                <feature.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mb-2 font-heading text-lg font-semibold text-card-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
