import Layout from "@/components/layout/Layout";

const AccessibilityStatement = () => (
  <Layout>
    <section className="container py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-heading text-3xl font-bold text-foreground">Accessibility Statement</h1>
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>Abilitiverse is committed to ensuring digital accessibility for people of all abilities. We continually improve the user experience and apply WCAG 2.1 AA standards.</p>
          <h2 className="font-heading text-lg font-semibold text-foreground">Measures We Take</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>Semantic HTML and ARIA labels throughout</li>
            <li>Full keyboard navigation support</li>
            <li>High contrast color ratios</li>
            <li>Large touch targets (minimum 48px)</li>
            <li>Screen reader-friendly content structure</li>
            <li>Skip-to-content navigation link</li>
          </ul>
          <h2 className="font-heading text-lg font-semibold text-foreground">Feedback</h2>
          <p>If you encounter any accessibility barriers, please contact us at accessibility@abilitiverse.com. We take all feedback seriously.</p>
        </div>
      </div>
    </section>
  </Layout>
);

export default AccessibilityStatement;
