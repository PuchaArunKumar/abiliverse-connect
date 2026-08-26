import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

const HeroSection = () => {
  return (
    <section
      className="relative overflow-hidden bg-primary py-20 lg:py-28"
      aria-labelledby="hero-heading"
    >
      {/* Background image overlay */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt=""
          className="h-full w-full object-cover opacity-15"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/80" />
      </div>

      <div className="container relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-1.5 text-sm font-medium text-primary-foreground">
            <Users className="h-4 w-4" aria-hidden="true" />
            Where assistive tech finds its people
          </span>
          <h1
            id="hero-heading"
            className="mb-6 font-heading text-4xl font-extrabold leading-tight tracking-tight text-primary-foreground md:text-5xl lg:text-6xl text-balance"
          >
            Empowering Innovation in Assistive Technology
          </h1>
          <p className="mb-8 text-lg leading-relaxed text-primary-foreground/85 md:text-xl">
            Abilitiverse connects developers, entrepreneurs, investors, mentors, and end users
            to turn accessibility ideas into real-world impact.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              variant="secondary"
              className="min-h-[48px] min-w-[180px] text-base font-semibold"
              asChild
            >
              <Link to="/signup">
                Join the Community
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-[48px] min-w-[180px] border-primary-foreground/40 bg-transparent text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link to="/pitches">Explore Projects</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
