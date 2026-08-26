// vitest-axe ships its matchers but does not augment vitest's Assertion type,
// so `expect(...).toHaveNoViolations()` runs correctly yet fails `tsc`.
// Declaring it here keeps the type check honest instead of casting to `any`.
import "vitest";
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = unknown> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
