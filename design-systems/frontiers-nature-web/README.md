# Frontiers Nature

Intellectual Frontiers' public, editorial web presentation. Its rules are [`spec.md`](spec.md); it
is governed by [`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md) and is
themed by a brand such as [`frontiers-brand`](../frontiers-brand/README.md). See [`../README.md`](../README.md) for
what a design system is and how this one fits among others. Built from plain HTML5, modern CSS and
a little vanilla JavaScript with one web component: no framework, no build step.

| Path | What it is |
| --- | --- |
| `css/tokens.css` | Custom properties: brand, unit and diagram colors, type, layout, motion. |
| `css/base.css` | Reset, base typography, focus, print. |
| `css/chrome.css` | Page frame, sticky header, breadcrumb band, popover menus, super footer. |
| `css/components.css` | Typography classes, buttons, hero, ruled lists, shelf, update list. |
| `css/fonts.css`, `fonts/` | Self-hosted `woff2` faces. |
| `css/bundle.txt` | Cascade order for concatenation. |
| `images/` | Hero and diagram in WebP sizes, share card. The logo and favicon come from the theme. |
| `templating.md` | The optional server-side template vocabulary the markup contract is written against (spec FR-020). |
| `data/registry.json` | The `app-*`, `data-app-*` and `if-*` names of that vocabulary. |
| `data/navigation.json` | Primary nav, section menus and prefixes, breadcrumb parents, footer. |
| `js/chrome.js` | Defines the `if-shelf` web component. The only first-party script. |
| `js/datastar.js` | Datastar bundle, loaded only by pages that need server-driven interactivity — the one interactivity dependency this design system names (0014-design-systems FR-008), opt-in per page, never loaded globally. |
| `tokens.json` | Machine-readable tokens. |
| `assurance/` | Tests that double as documentation: serve the directory holding this design system and open `/frontiers-nature-web/assurance/`, or run `node assurance/run.mjs` headlessly. Covers tokens, contrast, stylesheet discipline, the page frame, and the theme (`theme.js`: run with `--brand <slug>` to render with another brand). |
| `spec.md` | This design system's rules. |
| `chrome.md` | Anatomy and class contract for the chrome. |

## Using this anywhere — not just on an Intellectual Frontiers property

Nothing here requires Intellectual Frontiers' own stack. To use Frontiers Nature in any web
environment:

1. Vendor (copy) this whole directory and a brand beside it (`frontiers-brand`, or your own that
   supplies the roles `spec.md` FR-004 lists); don't link to either live.
2. Load the brand's `brand.css`, then concatenate the CSS files named in `css/bundle.txt`, in that order, into one stylesheet (or
   serve them as separate `<link>` tags in that same order — cascade layers make the order, not the
   file boundary, what matters). Rewrite any `../fonts/` reference to wherever you actually serve
   `fonts/`.
3. Serve `fonts/`, `images/` and `js/` as static assets, and the brand's logo and favicon
   files as `tokens.json` lists them.
4. Serve `js/chrome.js` on every page; serve `js/datastar.js` only on pages that actually need
   server-driven interactivity (see `design-systems/README.md`'s engineering stance).
5. Build your pages' markup to match the contract in `chrome.md` — the header, breadcrumb band,
   menus and footer structure it describes. You do not need any particular backend, templating
   language, or content format to do this; `templating.md` and `data/registry.json` describe one
   optional vocabulary this design system's own markup was designed against, not a requirement.

Colors, type scale and spacing are theme tokens in `css/tokens.css` (mirrored in `tokens.json`);
change them only by amending this design system's own source, not by overriding them downstream,
or a consumer's pages will drift from `frontiers-nature-web` without anyone having decided that.
