import Layout from "@/components/layout/Layout";

/**
 * Deliberately states what has and has not been verified.
 *
 * The previous version asserted "screen reader-friendly content structure" and
 * "high contrast color ratios" as settled fact. Neither had been tested. For a
 * platform whose users depend on these claims to decide whether it is usable
 * at all, an unearned assurance is worse than an admitted gap.
 */
const AccessibilityStatement = () => (
  <Layout>
    <section className="container py-14 lg:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          Accessibility statement
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last reviewed 26 August 2026
        </p>

        <div className="mt-8 space-y-8 leading-relaxed text-muted-foreground">
          <section aria-labelledby="commitment">
            <h2
              id="commitment"
              className="font-heading text-lg font-semibold text-foreground"
            >
              Our commitment
            </h2>
            <p className="mt-2">
              Abilitiverse aims to meet{" "}
              <strong className="text-foreground">WCAG 2.1 Level AA</strong> and
              to keep improving. We are not certified against it, and we do not
              claim to have met it in full. Where we fall short, we would rather
              say so here than have you discover it yourself.
            </p>
          </section>

          <section aria-labelledby="built-in">
            <h2
              id="built-in"
              className="font-heading text-lg font-semibold text-foreground"
            >
              What is built in
            </h2>
            <p className="mt-2">
              Open the accessibility control in the header to change any of
              these. Your choices are stored on your own device and applied
              across the whole site.
            </p>
            <ul className="mt-3 ml-5 list-disc space-y-1.5">
              <li>Four text sizes, from small to extra large</li>
              <li>A high contrast mode with stronger colours and borders</li>
              <li>
                Reduced motion, which also honours your operating system setting
              </li>
              <li>A dyslexia-friendly typeface as an alternative to the default</li>
              <li>An option to underline every link, rather than relying on colour</li>
              <li>
                Body text set in Atkinson Hyperlegible, drawn by the Braille
                Institute so that similar characters stay distinguishable
              </li>
              <li>A skip link to jump straight past the navigation</li>
              <li>Visible focus outlines on every interactive element</li>
              <li>Semantic landmarks and a single, ordered heading hierarchy</li>
            </ul>
          </section>

          <section aria-labelledby="tested">
            <h2
              id="tested"
              className="font-heading text-lg font-semibold text-foreground"
            >
              How this is checked
            </h2>
            <p className="mt-2">
              Every build runs automated accessibility tests using axe-core
              against the pages and components, covering missing labels, heading
              order, landmark structure and image alternatives. These run in
              continuous integration, so a regression fails the build rather
              than reaching you.
            </p>
          </section>

          <section aria-labelledby="limitations">
            <h2
              id="limitations"
              className="font-heading text-lg font-semibold text-foreground"
            >
              Known limitations
            </h2>
            <p className="mt-2">
              Automated testing catches mechanical failures. It cannot tell you
              whether a page is genuinely usable. These are the gaps we know
              about:
            </p>
            <ul className="mt-3 ml-5 list-disc space-y-1.5">
              <li>
                <strong className="text-foreground">
                  No screen reader testing yet.
                </strong>{" "}
                The site has not been walked through with NVDA, JAWS or
                VoiceOver by a person who relies on one. Until it has, we cannot
                honestly promise a good screen reader experience.
              </li>
              <li>
                <strong className="text-foreground">
                  Colour contrast is not independently verified.
                </strong>{" "}
                The palette was chosen for contrast, but every combination has
                not been measured against the WCAG ratios.
              </li>
              <li>
                <strong className="text-foreground">
                  No usability testing with disabled users.
                </strong>{" "}
                Nothing here has yet been reviewed by the people it is for. That
                is the most important gap on this list.
              </li>
              <li>
                <strong className="text-foreground">
                  Zoom is untested above 200%.
                </strong>{" "}
                Reflow at 400% has not been checked.
              </li>
              <li>
                Some sections — the pitch platform and the AI companion — are
                not built yet and are marked as such.
              </li>
            </ul>
          </section>

          <section aria-labelledby="feedback">
            <h2
              id="feedback"
              className="font-heading text-lg font-semibold text-foreground"
            >
              Report an accessibility issue
            </h2>
            <p className="mt-2">
              If something here does not work for you, please tell us — it is
              the fastest way this list gets shorter. Email{" "}
              <a
                href="mailto:accessibility@abilitiverse.com"
                className="font-medium text-primary hover:underline focus-visible:underline"
              >
                accessibility@abilitiverse.com
              </a>
              . Describe what you were trying to do, and the assistive
              technology you were using if any. We read every message.
            </p>
          </section>
        </div>
      </div>
    </section>
  </Layout>
);

export default AccessibilityStatement;
