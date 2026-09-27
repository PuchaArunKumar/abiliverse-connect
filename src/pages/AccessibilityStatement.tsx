import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// In-text links are underlined, not told apart by colour alone: the link blue
// is barely different from the slate body text around it (WCAG 1.4.1).
const inlineLink = "font-semibold text-link underline underline-offset-2 hover:text-foreground";

/**
 * Deliberately states what has and has not been verified.
 *
 * The previous version asserted "screen reader-friendly content structure" and
 * "high contrast color ratios" as settled fact. Neither had been tested. For a
 * platform whose users depend on these claims to decide whether it is usable
 * at all, an unearned assurance is worse than an admitted gap. When a claim
 * here stops being true (a test is removed, a feature changes), change it.
 */
const AccessibilityStatement = () => {
  useDocumentTitle("Accessibility statement");

  return (
    <Layout>
      <section className="container py-14 lg:py-16">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Accessibility statement
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last reviewed 27 September 2026
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
                <strong className="text-foreground">WCAG 2.1 Level AA</strong>{" "}
                and to keep improving. We are not certified against it, and we
                do not claim to have met it in full. Where we fall short, we
                would rather say so here than have you discover it yourself.
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
                Open the accessibility control in the header to change the
                first five of these. Your choices are stored in your browser on
                this device, not in your account, and apply across the whole
                site.
              </p>
              <ul className="ml-5 mt-3 list-disc space-y-1.5">
                <li>
                  Four text sizes, from small to extra large, scaled from the
                  text size set in your browser
                </li>
                <li>A high contrast mode with stronger colours and borders</li>
                <li>
                  Reduced motion. Animations and transitions are switched off
                  when your device is set to reduce motion, and you can switch
                  them off here even when it is not
                </li>
                <li>
                  A dyslexia-friendly option that switches to the Lexend
                  typeface, with wider letter and word spacing
                </li>
                <li>
                  An option to underline every link. Links inside sentences are
                  always underlined
                </li>
                <li>
                  Body text set in Atkinson Hyperlegible, drawn by the Braille
                  Institute so that similar characters stay distinguishable
                </li>
                <li>A skip link to jump straight past the navigation</li>
                <li>A visible focus ring on links, buttons and form fields</li>
                <li>
                  Header, main content and footer landmarks, so you can move
                  between them with a screen reader
                </li>
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
                Our automated test suite runs axe-core, an accessibility
                checker, against the homepage and each of its sections, the
                site footer, the accessibility settings panel, and the About,
                privacy policy, terms of service, accessibility statement and
                page-not-found pages. It looks for
                problems such as missing labels, skipped heading levels, missing
                landmarks and images without text alternatives.
              </p>
              <p className="mt-3">
                The tests run on every proposed change to the main branch, and
                they must pass before the GitHub Pages copy of the site is
                updated.
              </p>
              <p className="mt-3">
                These checks have limits. They run in a simulated browser that
                cannot measure colour contrast, and the other pages, including
                the problem repository, jobs, the pitch platform, the companion
                and the sign-in forms, are not yet covered by them.
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
                Automated testing catches mechanical failures. It cannot tell
                you whether a page is genuinely usable. These are the gaps we
                know about:
              </p>
              <ul className="ml-5 mt-3 list-disc space-y-1.5">
                <li>
                  <strong className="text-foreground">
                    No screen reader testing yet.
                  </strong>{" "}
                  The site has not been walked through with NVDA, JAWS or
                  VoiceOver by a person who relies on one. Until it has, we
                  cannot honestly promise a good screen reader experience.
                </li>
                <li>
                  <strong className="text-foreground">
                    Colour contrast is only partly verified.
                  </strong>{" "}
                  The main colour pairings were measured against the WCAG
                  ratios when they were chosen, but not every combination on
                  every page has been checked, and our automated tests cannot
                  measure contrast.
                </li>
                <li>
                  <strong className="text-foreground">
                    No usability testing with disabled users.
                  </strong>{" "}
                  Nothing here has yet been reviewed by the people it is for.
                  That is the most important gap on this list.
                </li>
                <li>
                  <strong className="text-foreground">
                    Zoom is untested above 200%.
                  </strong>{" "}
                  Reflow at 400% has not been checked.
                </li>
                <li>
                  <strong className="text-foreground">
                    Some features are still being switched on.
                  </strong>{" "}
                  Parts of the site need database updates that are still being
                  rolled out. Until they arrive, those pages say the feature is
                  being set up rather than showing an empty list.
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
                If something here does not work for you, please tell us. It is
                the fastest way this list gets shorter. Email{" "}
                <a
                  href="mailto:puchaarunkumar@gmail.com"
                  className={`${inlineLink} [overflow-wrap:anywhere]`}
                >
                  puchaarunkumar@gmail.com
                </a>
                , or see the{" "}
                <Link to="/contact" className={inlineLink}>
                  contact page
                </Link>{" "}
                for other ways to reach us. Describe what you were trying to
                do, and the assistive technology you were using, if any.
              </p>
            </section>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default AccessibilityStatement;
