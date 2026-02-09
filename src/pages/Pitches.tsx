import Layout from "@/components/layout/Layout";
import { Lightbulb } from "lucide-react";

const Pitches = () => (
  <Layout>
    <section className="container py-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-primary">
          <Lightbulb className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mb-3 font-heading text-3xl font-bold text-foreground">Pitch Platform</h1>
        <p className="text-muted-foreground">Submit your assistive tech idea, find funding, and get valuable community feedback.</p>
      </div>
    </section>
  </Layout>
);

export default Pitches;
