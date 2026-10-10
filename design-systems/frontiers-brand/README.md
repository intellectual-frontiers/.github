# Frontiers Brand

Intellectual Frontiers' brand, and the theme of its web and print design systems: palette, theme roles, unit
colors, typefaces, logo, icon, share card and imagery pool. Its rules are [`spec.md`](spec.md); it is
governed by [`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md). See
[`../README.md`](../README.md) for what a design system is and how theming works.

| Path | What it is |
| --- | --- |
| `tokens.json` | Every brand value in the Design Tokens Community Group format: the palette, unit colors, typefaces, the theme roles (`role`), and each logo file with its size and background (under `$extensions`). |
| `brand.css` | The theme roles as `--brand-*` custom properties in the `theme` cascade layer. A web page loads it before its design system's stylesheets. |
| `brand.tex` | The theme roles for print: `brand-<role>` colors, `\brandfontsans`, `\brandfontserif`, and `\brandlockuplight`, `\brandlockupdark` and `\brandicon`. A print design system loads it first. |
| `logos/` | The lockup as PNG in every size, light and dark; the icon-only mark. |
| `logos/web/` | The lockup as WebP in every size below the master, light and dark. |
| `logos/vector/` | The decoration kit: the lockup and icon as one-color SVG, traced from their masters by `agora decoration generate --only trace`, and the two-line wordmark for small goods, set by `agora decoration generate --only set`; listed in `tokens.json` with their finest detail and each ink's candidate spot-color and thread match. |
| `briefs/` | Work only people can do: commissioning a vector master of the lockup (`vector-master.md`) and verifying the decoration kit's ink matches against physical guides (`ink-verification.md`). |
| `fonts/` | Inter's variable font (SIL OFL 1.1), the face the lockup's wordmark is drawn in, for setting the kit's wordmark. |
| `images/icons/`, `images/favicon.ico` | The app icons (Apple touch, 192, 512, maskable 512) and the multi-size favicon, written by `agora imagery build frontiers-brand` from the icon-only mark. |
| `logos/units/` | Each unit's mark: the wordmark with the unit's name, one-color SVG, set by `agora decoration generate --only set`. |
| `images/favicon.png` | The icon-only mark at 64×64. |
| `icons/` | Interface icons: one-color stroke SVG on a 24px grid in `currentColor`, drawn, not traced; `whats-left.svg` marks the website's "What's left" band (FR-021). |
| `images/share-card.png` | The link-preview card, 1200×630: the light lockup on the surface. |
| `imagery/` | The imagery pool: the approved frontier artwork every design system this brand themes chooses from, with `catalog.json` and WebP files for the web. See [`imagery/README.md`](imagery/README.md). |
| `openedx/` | The brand's Open edX brand package (Paragon 23 design tokens, logos, favicon, fonts) with its build in `openedx/dist/`, written by `agora openedx build --paragon PATH`. See [`openedx/README.md`](openedx/README.md). |
| `assurance/` | Tests that double as documentation: the brand contract every brand meets (`contract.js`), this brand's own rules (`unit.js`) and a specimen. `node assurance/run.mjs` runs them headlessly; `python3 assurance/run.py` checks the Open edX package. |

## Using it

This brand is a theme. A web design system takes every brand value by reference (`var(--brand-primary)`, the logo files listed in `tokens.json`), so a page is themed by loading `brand.css` first and taking logos from `tokens.json`, and a printed work by loading `brand.tex` first. Vendor this directory beside the web design system it themes.

Used directly (a slide deck, a document, an email signature), take colors from `tokens.json` and
place a logo file at or above its minimum size on the background its variant is for. Never
redraw, recolor or scale up a logo file.

`brand.css` and `brand.tex` are written from `tokens.json` by `agora brand generate frontiers-brand`; edit `tokens.json` and run it, never the two files. The imagery pool's WebP files and the share card are written by `agora imagery build frontiers-brand`.

The decoration kit is traced, never drawn: `agora decoration generate frontiers-brand --only trace` rewrites `logos/vector/` and the measured finest detail from the masters and the `traced-from` settings in `tokens.json` (needs the Python packages Pillow, potracer and resvg-py; `agora` runs it in its locked environment). Its engraved detail holds only on large prints; smaller goods (a cap, a polo, a pen, a mug) carry the wordmark, which `agora decoration generate frontiers-brand --only set` sets from `fonts/` and the `set-from` settings (needs the uharfbuzz package) (spec FR-017). Its ink matches are candidates until checked on the physical Pantone guide and Isacord card.
