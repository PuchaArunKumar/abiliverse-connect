import Layout from "@/components/layout/Layout";

const TermsOfService = () => (
  <Layout>
    <section className="container py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-heading text-3xl font-bold text-foreground">Terms of Service</h1>
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>Last updated: February 2026</p>
          <p>By using Abilitiverse, you agree to these terms. Please read them carefully.</p>
          <h2 className="font-heading text-lg font-semibold text-foreground">Use of Service</h2>
          <p>You must use Abilitiverse respectfully and lawfully. We reserve the right to suspend accounts that violate community guidelines.</p>
          <h2 className="font-heading text-lg font-semibold text-foreground">Content</h2>
          <p>You retain ownership of content you post. By posting, you grant Abilitiverse a license to display and distribute your content within the platform.</p>
          <h2 className="font-heading text-lg font-semibold text-foreground">Liability</h2>
          <p>Abilitiverse is provided "as is." We are not liable for any damages arising from your use of the platform.</p>
        </div>
      </div>
    </section>
  </Layout>
);

export default TermsOfService;
