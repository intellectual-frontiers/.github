# Frontiers Nature — design system

> **Canonical and public.** Governed by
> [`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md), one of possibly
> several design systems under `design-systems/` — see that directory's own
> [`README.md`](../README.md) for what a design system is and how this one fits among others.
> Consumers vendor a pinned copy of this directory and never edit it. Built as **Bare Metal
> Software**: strict modern HTML5, modern CSS and modern JavaScript with web components, no
> framework, no build tool (0014-design-systems FR-007–FR-009).

| Path | What it is |
| --- | --- |
| `css/tokens.css` | Custom properties: brand, unit and diagram colors, type, layout, motion. |
| `css/base.css` | Reset, base typography, focus, print. |
| `css/chrome.css` | Page frame, sticky header, breadcrumb band, popover menus, super footer. |
| `css/components.css` | Typography classes, buttons, hero, ruled lists, shelf, update list. |
| `css/fonts.css`, `fonts/` | Self-hosted `woff2` faces. |
| `css/bundle.txt` | Cascade order for concatenation. |
| `logos/`, `logos/web/` | Brand master PNGs and WebP sizes, light and dark. |
| `images/` | Hero and diagram in WebP sizes, favicon, share card. |
| `templating.md` | Reference documentation for an optional server-side template vocabulary this design system's markup was originally designed against. Inherited from this design system's origin, not itself an adopted spec in this repository — see `0014-design-systems`' Out of scope. |
| `data/registry.json` | The `app-*`, `data-app-*` and `if-*` names, under that same inherited, not-yet-adopted vocabulary. |
| `data/navigation.json` | Primary nav, section menus and prefixes, breadcrumb parents, footer. |
| `js/chrome.js` | Defines the `if-shelf` web component. The only first-party script. |
| `js/datastar.js` | Datastar bundle, loaded only by pages that need server-driven interactivity — the one interactivity dependency this design system names (0014-design-systems FR-008), opt-in per page, never loaded globally. |
| `tokens.json` | Machine-readable tokens. |
| `assurance/` | Tests that double as documentation: open `assurance/index.html` in a browser (serve the directory over http for the full run), or `node assurance/run.mjs` headlessly. Covers tokens, contrast, stylesheet discipline and the page frame. See `../README.md`. |
| `chrome.md` | Anatomy and class contract for the chrome. |

## Using this anywhere — not just on an Intellectual Frontiers property

Nothing here requires Intellectual Frontiers' own stack. To use Frontiers Nature in any web
environment:

1. Vendor (copy) this whole directory; don't link to it live or re-host from here.
2. Concatenate the CSS files named in `css/bundle.txt`, in that order, into one stylesheet (or
   serve them as separate `<link>` tags in that same order — cascade layers make the order, not the
   file boundary, what matters). Rewrite any `../fonts/` reference to wherever you actually serve
   `fonts/`.
3. Serve `fonts/`, `logos/`, `images/` and `js/` as static assets.
4. Serve `js/chrome.js` on every page; serve `js/datastar.js` only on pages that actually need
   server-driven interactivity (see `design-systems/README.md`'s engineering stance).
5. Build your pages' markup to match the contract in `chrome.md` — the header, breadcrumb band,
   menus and footer structure it describes. You do not need any particular backend, templating
   language, or content format to do this; `templating.md` and `data/registry.json` describe one
   optional vocabulary this design system's own markup was designed against, not a requirement.

Colors, type scale and spacing are theme tokens in `css/tokens.css` (mirrored in `tokens.json`);
change them only by amending this design system's own source, not by overriding them downstream,
or a consumer's pages will drift from `frontiers-nature-web` without anyone having decided that.
