import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Bot } from "lucide-react";

const Companion = () => (
  <Layout>
    <section className="container py-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-primary">
          <Bot className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mb-3 font-heading text-3xl font-bold text-foreground">AI Companion — Alex</h1>
        <p className="text-muted-foreground">
          Your friendly, accessible AI assistant for daily reminders, motivation, and routine guidance.
        </p>
        <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Alex is not available yet. The{" "}
          <Link to="/problems" className="font-medium text-primary hover:underline">
            problem repository
          </Link>{" "}
          and{" "}
          <Link to="/learn" className="font-medium text-primary hover:underline">
            learning hub
          </Link>{" "}
          are live today.
        </p>
      </div>
    </section>
  </Layout>
);

export default Companion;
