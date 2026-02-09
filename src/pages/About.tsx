import Layout from "@/components/layout/Layout";

const About = () => (
  <Layout>
    <section className="container py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-heading text-3xl font-bold text-foreground">About Abilitiverse</h1>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            Abilitiverse is a collaborative hub for the assistive technology community — connecting developers, entrepreneurs, investors, mentors, and end users to accelerate innovation in accessibility.
          </p>
          <p>
            We believe that the best assistive technology is built when the people who need it, the people who build it, and the people who fund it are all in the same room. Abilitiverse is that room.
          </p>
          <p>
            Our mission is to ensure that every assistive technology idea can find the people, funding, and momentum it needs to move from concept to impact.
          </p>
        </div>
      </div>
    </section>
  </Layout>
);

export default About;
