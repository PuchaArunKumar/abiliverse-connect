# Colour system

Every value here was measured against the WCAG 2.1 relative luminance formula
before being adopted. Two of the originally proposed values did not survive
that check, and are recorded below so they are not reintroduced.

## Light

| Token | Hex | Role | Contrast | Level |
| --- | --- | --- | --- | --- |
| `--foreground` | `#172033` | Body text | 15.55:1 on ground | AAA |
| `--primary` | `#12304A` | Brand, headings | 12.97:1 on ground | AAA |
| `--primary` on white text | `#12304A` | Primary button | 13.57:1 | AAA |
| `--action` | `#0F766E` | Buttons, active nav, focus | 5.23:1 on ground | AA |
| `--link` | `#155EEF` | Links and citations | 5.17:1 on ground | AA |
| `--accent` | `#B45309` | Status and deadline chips | 4.80:1 on ground | AA |
| `--muted-foreground` | `#47566B` | Secondary text | 7.42:1 on ground | AAA |
| `--background` | `#F8FAFC` | Page ground | — | — |

## Dark

Re-measured against the dark ground rather than inverted. Navy is unreadable on
a dark background, so light teal carries the brand there.

| Token | Hex | Contrast on `#0F1720` | Level |
| --- | --- | --- | --- |
| `--foreground` | `#E4EAF2` | 14.91:1 | AAA |
| `--primary` / `--action` | `#5EC8B8` | 8.96:1 | AAA |
| `--link` | `#86B0FF` | 8.31:1 | AAA |
| `--accent` | `#E8A76B` | 8.74:1 | AAA |
| `--muted-foreground` | `#9BA9BC` | 7.56:1 | AAA |

## Two values that were rejected

**`#D97706` as the warm accent — failed.** 3.04:1 as text on the ground and
3.19:1 as a button with white text, both under the 4.5:1 minimum. Replaced with
`#B45309` at 4.80:1, which still reads as amber rather than brown.

**`#087E8B` as the action colour — too tight.** It passed, but at 4.60:1 it sat
0.1 above the threshold, close enough that any later lightening would drop it
below. Replaced with `#0F766E` at 5.23:1, which is also nearer the previous
brand teal so no brand continuity is lost.

## Rules

- **`--action` and `--link` are deliberately different.** Teal drives controls,
  blue marks links. Collapsing them makes a link and a button read as the same
  affordance.
- **`--accent` never carries body text.** It is for chips and status marks,
  where it sits on a tinted background at larger effective weight.
- **Colour never carries meaning alone.** Status is a word plus a glyph, with
  colour reinforcing it — so the interface survives greyscale and colour vision
  deficiency.
- **High contrast mode overrides these tokens**, so it needs its own check
  whenever the palette changes. It is not derived from the values above.

## Re-running the audit

Contrast is checked by hand rather than by a linter today. When changing any
token, recompute the affected pairings before committing — a value that looks
fine can be a point below the line.
