# Frontiers Console — design system

> **Canonical and public.** Governed by
> [`spec.md`](spec.md) and
> [`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md), one of several design
> systems under `design-systems/` — see [that directory's README](../README.md) for what a design
> system is. Consumers vendor a pinned copy of this directory and never edit it. Built as **Bare Metal
> Software**: strict HTML5, modern CSS in cascade layers, and a few native web components in one
> classic script. No framework, no utility-class system, no build step, **no runtime dependencies**.

Frontiers Console is the interface for **operator (admin) and documentation** surfaces: a sidebar,
navbar, page and table-of-contents shell in three selectable layouts, a set of documentation
components, and the data-dense pieces an admin console needs. It is deliberately a different system
from [`frontiers-nature-web`](../frontiers-nature-web/README.md), which is the public, editorial face of the
organization; the two share a palette and typefaces, not a purpose.

## Provenance

The look and information architecture — a bordered, neutral, tightly typeset documentation theme with a
persistent sidebar, a right-hand table of contents and command-palette search — are inspired by the
*documented behaviour* of well-known documentation frameworks. Every line of CSS, JavaScript and markup
here is written from scratch for this system; nothing is copied or vendored from any other project, and no
other project is a dependency. The only third-party files are the fonts below.

| Third-party file | License | Why |
| --- | --- | --- |
| `fonts/inter-variable-latin.woff2` | SIL OFL 1.1 | Text face (shared with `frontiers-nature-web`). |
| `fonts/ibm-plex-mono-normal-{400,500}-latin.woff2` | SIL OFL 1.1 | Code and tabular face (shared with `frontiers-nature-web`). |

## What is in here

| Path | What it is |
| --- | --- |
| `css/fonts.css`, `fonts/` | Self-hosted `woff2` faces. |
| `css/reset.css` | Declares the cascade layer order (once, first) and holds the reset. |
| `css/tokens.css` | Custom properties (`--fc-*`): surfaces, brand, status, type, shape, layout, motion. **Source of truth.** |
| `css/base.css` | Document defaults, focus ring, skip link, reduced motion, print. |
| `css/layout.css` | `<fc-shell>` grid, navbar, sidebar and its tree, page, table of contents, footer. |
| `css/prose.css` | `.fc-prose` for long-form content (rendered Markdown or hand-written articles). |
| `css/components.css` | Buttons, badges, menus, breadcrumbs, pager, callout, cards, tabs, steps, accordion, files, code block, type table, banner, search, toast. |
| `css/admin.css` | Data table, stats, forms, empty state, run log, key/value list. |
| `css/bundle.txt` | Load order for concatenation. |
| `js/console.js` | The only script. Defines `fc-shell`, `fc-toc`, `fc-tabs`, `fc-codeblock`, `fc-search`, `fc-table`, `fc-terminal` and `FcToast`. |
| `tokens.json` | Machine-readable mirror of `tokens.css`, kept exact by `assurance/`. |
| `chrome.md` | **The markup contract**: anatomy, classes and attributes for every layout and component. |
| `logos/`, `images/` | Brand marks (WebP and PNG) and favicon, shared with `frontiers-nature-web`. |
| `assurance/` | The test harness, report and live documentation. See below. |

## Three layouts, one attribute

```html
<fc-shell data-layout="docs">      <!-- persistent sidebar; navbar only on small screens -->
<fc-shell data-layout="notebook">  <!-- full-width navbar, sidebar beneath it -->
<fc-shell data-layout="home">      <!-- landing page: navbar and page, no sidebar -->
```

The markup inside does not change between layouts; changing the attribute, even at runtime, reflows the
page. Below 64 rem the sidebar is an off-canvas drawer; the table of contents moves into a disclosure
above the article below 80 rem. On desktop the sidebar can be collapsed (the choice is remembered).

## Using this anywhere — not just on an Intellectual Frontiers property

1. Vendor (copy) this whole directory; don't link to it live. Don't edit your copy.
2. Link the stylesheets in `css/bundle.txt` order (or concatenate them in that order). Cascade layers, not
   file boundaries, make the order matter; `reset.css` must come before any other layered file.
   Rewrite the `../fonts/` paths in `fonts.css` if you serve fonts elsewhere.
3. Serve `fonts/`, `logos/`, `images/` and `js/` as static assets, and load `js/console.js` with `defer`.
4. Write your markup to `chrome.md`. No backend, template language or content format is assumed.
5. Open `assurance/index.html` (over http, ideally) against your vendored copy to confirm nothing broke.

Tokens are changed only by amending this system's own source (`css/tokens.css`, mirrored in
`tokens.json`), never by overriding them downstream.

## Assurance: tests that double as documentation

`assurance/index.html` runs in any modern browser with no build step or install, and is simultaneously the
report, the documentation of what is guaranteed, and a gallery of the fixture pages.

| What | How |
| --- | --- |
| Just look | Open `assurance/index.html`. Token, contrast and component unit tests run; tests that need `fetch` or iframes are reported as **skipped**, never as passed (browsers block both on `file://`). |
| Everything | Serve this directory (`python3 -m http.server`) and open `/assurance/`. |
| CI or terminal | `node assurance/run.mjs` — serves the directory, drives Chromium through Playwright, prints a report, exits non-zero on failure. `--suite NAME` narrows it; `--shots DIR` writes screenshots of every fixture at 390, 900 and 1400 px. |

What it checks: every token exists and `tokens.json` matches `tokens.css`; every text pairing meets WCAG
AA (computed on tokens *and* on the rendered components); the layer order and the "no `@import`, no
`!important`, no remote URLs, no framework" stance; each web component's keyboard and ARIA contract; the
three layouts at the breakpoints that matter; no horizontal overflow from 320 px up; the markup contract
on every fixture; and the interactions (drawer, collapse, tabs, scroll-spy, search, table sort and filter).

`assurance/fixtures/` holds one complete page per layout plus a component gallery and an admin page; they
are the test subjects and the reference rendering.

## Not yet

- **Dark theme.** Token names are semantic so a theme can be added by redefining them under a selector;
  nothing is wired to a switch.
- **Syntax highlighting.** Code blocks are styled, not tokenized; a consumer may highlight server-side
  and emit spans.
- **Non-Latin font subsets**, as in `frontiers-nature-web`.
