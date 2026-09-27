# Colour system

Corporate navy: one hue family. Navy carries the brand and filled buttons, a
single blue marks interactive text and icons, and everything else is slate.
There is no second brand colour competing for attention — that restraint is
most of what makes the interface read as professional.

Every value here was measured against the WCAG 2.1 relative luminance formula
before being adopted. Hex values are the rendered result of the HSL tokens in
`src/index.css`.

## Light

| Token | Hex | Role | Contrast | Level |
| --- | --- | --- | --- | --- |
| `--foreground` | `#0F1729` | Body text | 17.08:1 on ground | AAA |
| `--primary` | `#0B2647` | Brand, filled buttons | 14.52:1 on ground | AAA |
| `--primary` with white text | `#0B2647` | Primary button | 15.19:1 | AAA |
| `--action` / `--link` | `#1147BB` | Links, "Open →", eyebrows, icons | 7.59:1 on ground | AAA |
| `--muted-foreground` | `#48566A` | Secondary text | 7.13:1 on ground | AAA |
| `--secondary` | `#ECF1F9` | Icon tiles, badges | navy text 13.39:1 | AAA |
| `--accent` | `#E6ECF4` | Hover and selected surfaces | navy text 12.78:1 | AAA |
| `--destructive` | `#B81E1E` | Errors, delete | white text 6.48:1 | AA |
| `--input` | `#65758B` | Input borders, outline buttons, unchecked switch track | 4.49:1 on ground, 4.70:1 on white, 4.41:1 on the `bg-muted/40` newsletter band; switch thumb on track 4.49:1 | Passes 3:1 (1.4.11) |
| `--background` | `#F8FAFC` | Page ground | — | — |

## Dark

**Not currently enabled anywhere in the app.** Tailwind uses the `class`
strategy and nothing adds `dark` to `<html>` (no theme provider or toggle is
mounted), so no visitor sees these values today. They are kept, and measured,
so a theme switch can be added without re-deriving the palette; re-check them
when it is.

Re-measured against the dark ground rather than inverted. Navy is unreadable on
a dark background, so a light blue carries the brand there.

| Token | Hex | Contrast on `#090E1A` | Level |
| --- | --- | --- | --- |
| `--foreground` | `#E1E7EF` | 15.49:1 | AAA |
| `--primary` / `--action` / `--link` | `#8BB9F9` | 9.55:1 | AAA |
| `--muted-foreground` | `#9DABBE` | 8.26:1 | AAA |
| `--accent` (hover surface) | `#222C3F` | text on it 11.25:1 | AAA |
| `--input` | `#65758B` | 4.10:1 (3.78:1 on `--card`) | Passes 3:1 (1.4.11) |

## High contrast mode

Overrides the tokens above, so it is measured separately.

| Mode | `--primary` | `--action` / `--link` | `--input` |
| --- | --- | --- | --- |
| Light, on white | `#031C3A` 17.06:1 | `#0031A3` 10.67:1 | `#000000` 21:1 |
| Dark, on black | `#A3C9FF` 12.36:1 | `#A3C9FF` 12.36:1 | `#B2B2B2` 9.90:1 |

Dark high contrast sets `--primary-foreground` and `--action-foreground` to
black: black on `#A3C9FF` is 12.36:1. Without that, the white foregrounds from
light high contrast won on specificity and filled buttons were white on light
blue, 1.70:1.

## Decisions, and what they replaced

**`--accent` is a surface, not a colour.** shadcn/ui paints hover, focus and
selected states with `bg-accent text-accent-foreground` — menu items, outline
and ghost buttons, select options, calendar days. It was amber `#B45309` with
white text, so every one of those turned orange on hover; in dark mode the same
token put light text on light amber at 1.72:1. It is now a faint slate-blue
with navy text. Nothing in the app used `accent` as a status colour.

**Teal and amber are gone.** The previous palette used navy, teal, blue and
amber at once. Four hues read as a consumer app; one reads as an institution.

**`--action` and `--link` are the same blue.** They were deliberately different
hues so a link would not read as a button. Shape does that job better: buttons
are filled navy blocks, links are blue text. Hue alone is also not a reliable
signal for anyone with a colour vision deficiency. The tokens stay separate so
they can diverge again without touching components.

**`--input` is a boundary, not a fill.** It draws the only visible edge of text
fields and outline buttons, and the track of an unchecked switch, so WCAG 1.4.11
asks 3:1 of it. It was `#BFCAD9`, 1.58:1 on the ground (2.07:1 in dark), and high
contrast mode did not override it at all. It is now slate-500 in light and dark,
and black / light grey in the high contrast modes.

**Links inside sentences are always underlined.** The link blue against the
slate body text is 1.07:1 (1.42:1 in high contrast), so colour cannot mark them
(1.4.1). `src/index.css` underlines every link in a paragraph inside `<main>`;
the optional "underline links" setting extends that to the rest of the page.

**Dark-mode sidebar fix.** `--sidebar-primary-foreground` was white on light
teal, 2.01:1. It now uses the dark ground, 9.55:1.

## Rules

- **Colour never carries meaning alone.** Status is a word plus a glyph, with
  colour reinforcing it — so the interface survives greyscale and colour vision
  deficiency.
- **No raw colours in components.** Use the tokens (`text-action`,
  `bg-secondary`, …). A hard-coded `text-teal-700` bypasses dark mode, high
  contrast mode, and this audit.
- **High contrast mode needs its own check** whenever the palette changes. It
  is not derived from the values above.

## Re-running the audit

When changing any token, recompute every pairing above before committing — a
value that looks fine can be a point below the line.
