# Example Brand

A test brand. It is deliberately not Intellectual Frontiers': its own palette (violet, pine, rust on
white), its own logo and favicon. Every web design system here is run themed by it as well as by
`frontiers-brand`, which proves the system takes every brand value from the theme and holds none as
a literal. It is never used to publish anything. Its rules are [`spec.md`](spec.md).

It is also the smallest complete example of a brand: copy this directory to start a new one.

| Path | What it is |
| --- | --- |
| `tokens.json` | The palette, typefaces and theme roles in the Design Tokens Community Group format, and the logo files under `$extensions`. |
| `brand.css` | The theme roles as `--brand-*` custom properties in the `theme` cascade layer. |
| `brand.tex` | The theme roles for print: `brand-<role>` colors, `\brandfontsans`, `\brandfontserif`, and `\brandlockuplight`, `\brandlockupdark` and `\brandicon`. A print design system loads it first. |
| `logos/`, `logos/web/`, `images/favicon.png`, `images/share-card.png` | The lockups (light and dark, PNG and WebP), the icon, the favicon and the share card. |
| `logos/vector/` | The decoration kit's one-color SVG lockup and icon, listed with their spot-color and thread matches in `tokens.json`. |
| `imagery/` | A one-piece imagery pool: a plain test drawing, so a design system that places pictures can be proven under this brand. |
| `assurance/` | The brand contract (`contract.js`) and a specimen. `node assurance/run.mjs` runs them. |

To see a web design system in this brand, serve `design-systems/` and open
`/frontiers-console-web/assurance/?brand=example-brand`, or run
`node design-systems/frontiers-console-web/assurance/run.mjs --brand example-brand --shots <dir>`.

`brand.css` and `brand.tex` are written from `tokens.json` by `agora brand generate`; edit `tokens.json` and run it, never the two files. `agora imagery build example-brand` writes the WebP files and the share card.
