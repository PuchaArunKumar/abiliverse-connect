import { Link } from "react-router-dom";

/**
 * Every claim here maps to something actually implemented. A platform for
 * disabled users that overstates its own accessibility loses the only
 * credibility that matters to the people it is for.
 */
const built = [
  {
    title: "Four text sizes",
    body: "Small through extra large, applied across the whole interface and remembered on your device.",
  },
  {
    title: "High contrast mode",
    body: "Stronger colours and borders, switchable at any time from the toolbar.",
  },
  {
    title: "Reduced motion",
    body: "Honours your system setting, and can be forced on independently of it.",
  },
  {
    title: "Dyslexia-friendly type",
    body: "Rounder letterforms with wider spacing, as an alternative to the default face.",
  },
  {
    title: "Keyboard navigation",
    body: "Every control is reachable and operable without a mouse, with visible focus rings.",
  },
  {
    title: "Hyperlegible by default",
    body: "Body text is set in Atkinson Hyperlegible, drawn by the Braille Institute so similar characters stay distinguishable.",
  },
];

const AccessibilityCommitment = () => {
  return (
    <section
      className="border-b border-border py-14 lg:py-16"
      aria-labelledby="a11y-heading"
    >
      <div className="container grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div>
          <h2
            id="a11y-heading"
            className="font-heading text-2xl font-bold tracking-tight text-foreground"
          >
            Accessibility is the product
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            A platform about assistive technology has no business being hard to
            use. These are built in, not bolted on — open the accessibility
            control in the toolbar to change any of them.
          </p>
          <Link
            to="/accessibility"
            className="mt-4 inline-block font-semibold text-primary hover:underline focus-visible:underline"
          >
            Read the accessibility statement
          </Link>
        </div>

        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {built.map((item) => (
            <div key={item.title}>
              <dt className="font-heading text-sm font-semibold text-foreground">
                {item.title}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default AccessibilityCommitment;
