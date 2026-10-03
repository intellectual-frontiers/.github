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
| `images/favicon.png` | The icon-only mark at 64×64. |
| `images/share-card.png` | The link-preview card, 1200×630: the light lockup on the surface. |
| `imagery/` | The imagery pool: the approved frontier artwork every design system this brand themes chooses from, with `catalog.json` and WebP files for the web. See [`imagery/README.md`](imagery/README.md). |
| `assurance/` | Tests that double as documentation: the brand contract every brand meets (`contract.js`), this brand's own rules (`unit.js`) and a specimen. `node assurance/run.mjs` runs them headlessly. |

## Using it

This brand is a theme. A web design system takes every brand value by reference (`var(--brand-primary)`, the logo files listed in `tokens.json`), so a page is themed by loading `brand.css` first and taking logos from `tokens.json`, and a printed work by loading `brand.tex` first. Vendor this directory beside the web design system it themes.

Used directly (a slide deck, a document, an email signature), take colors from `tokens.json` and
place a logo file at or above its minimum size on the background its variant is for. Never
redraw, recolor or scale up a logo file.

`brand.css` and `brand.tex` are written from `tokens.json` by `tools/brand_theme.py`; edit `tokens.json` and run it, never the two files. The imagery pool's WebP files and the share card are written by `tools/brand_imagery.py build`.
