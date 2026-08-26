import { Link } from "react-router-dom";
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
        <p className="text-muted-foreground">
          Submit your assistive tech idea, find funding, and get valuable community feedback.
        </p>
        <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          This section is not built yet. In the meantime you can{" "}
          <Link to="/problems" className="font-medium text-primary hover:underline">
            browse documented problems
          </Link>{" "}
          to find something worth building.
        </p>
      </div>
    </section>
  </Layout>
);

export default Pitches;
