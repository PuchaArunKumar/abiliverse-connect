import Layout from "@/components/layout/Layout";

const PrivacyPolicy = () => (
  <Layout>
    <section className="container py-16">
      <div className="prose mx-auto max-w-2xl">
        <h1 className="mb-6 font-heading text-3xl font-bold text-foreground">Privacy Policy</h1>
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>Last updated: February 2026</p>
          <p>Abilitiverse is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.</p>
          <h2 className="font-heading text-lg font-semibold text-foreground">Information We Collect</h2>
          <p>We collect information you provide when creating an account, submitting content, or contacting us — including your name, email, and profile details.</p>
          <h2 className="font-heading text-lg font-semibold text-foreground">How We Use Your Information</h2>
          <p>We use your information to provide platform services, improve user experience, and communicate with you about updates and opportunities.</p>
          <h2 className="font-heading text-lg font-semibold text-foreground">Contact</h2>
          <p>Questions about this policy? Contact us at privacy@abilitiverse.com.</p>
        </div>
      </div>
    </section>
  </Layout>
);

export default PrivacyPolicy;
