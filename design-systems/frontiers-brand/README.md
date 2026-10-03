# Frontiers Brand

The brand identity every other Intellectual Frontiers design system draws on: palette, unit
colors, typefaces, logo, icon and imagery identity. Its rules are [`spec.md`](spec.md); it is
governed by [`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md). See
[`../README.md`](../README.md) for what a design system is and how derivation works.

| Path | What it is |
| --- | --- |
| `tokens.json` | Every brand value, stated once: colors, unit colors, text pairings, typefaces, and each logo file with its size and background. |
| `logos/` | The lockup as PNG in every size, light and dark; the icon-only mark. |
| `logos/web/` | The lockup as WebP in every size below the master, light and dark. |
| `images/favicon.png` | The icon-only mark at 64×64. |
| `assurance/` | Tests that double as documentation. `node assurance/run.mjs` serves the directory holding this design system and runs them headlessly. `assurance/fixtures/specimen.html` shows every color and logo file. |

## Using it

A design system that derives from this one copies the values and files it uses, and its own
harness checks those copies against this directory when it is vendored beside it. Anyone using a
derived design system vendors this one beside it.

Used directly (a slide deck, a document, an email signature), take colors from `tokens.json` and
place a logo file at or above its minimum size on the background its variant is for. Never
redraw, recolor or scale up a logo file.
