# Feature Specification: Frontiers Nature web design system

**Spec ID:** frontiers-nature-web
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** Intellectual Frontiers' public, editorial web presentation: the page frame, header,
breadcrumb band, menus and footer every public page shares, the typography and components its
content uses, and the tokens behind them, themed by any brand that supplies the roles it requires.

## Identity and scope

- **FR-001**: `frontiers-nature-web` MUST live at `design-systems/frontiers-nature-web/`, be
  registered in `ifcore.ttl` as an `ifcore:DesignSystem` of the web presentation kind, classified
  as an editorial site and a marketing site, expressive, at default density (0014-design-systems
  FR-010, FR-041), and serve public, editorial web pages. It MUST NOT assume which web property consumes it, which backend renders it, or how its
  content is authored.
- **FR-002**: It MUST hold `css/` (with `css/bundle.txt`), `fonts/`, `images/` (hero, diagram
  and share-card images), `js/`,
  `data/navigation.json`, `data/registry.json`, `tokens.json`, the markup contract `chrome.md`,
  `templating.md`, a `README.md` that documents each path, this spec, and an `assurance/` harness
  (0014-design-systems FR-006, FR-029).

## Tokens

- **FR-003**: `css/tokens.css` MUST define, on `:root`, the color tokens `--ink`, `--paper`,
  `--stone`, `--shell`, `--rule`, `--background`, `--foreground` and `--muted-foreground`; the unit
  tokens `--capital`, `--ip`, `--press`, `--studios` and `--network`; the diagram roles
  `--diagram-ink`, `--diagram-path`, `--diagram-warning`, `--diagram-positive`, `--diagram-caution`
  and `--diagram-secondary`; `--font-sans`, `--font-serif` and `--font-mono`; `--measure-page`
  (72rem), `--gutter` (1.5rem), `--radius` (0) and `--chrome-clearance`; and `--ease` and `--fast`.
  `tokens.json` MUST mirror every custom property `css/tokens.css` declares on `:root`, in order,
  in the Design Tokens Community Group format, a value the theme supplies written as a `{role.*}`
  alias (0014-design-systems FR-036); `css/tokens.css` is the source.
- **FR-004**: It MUST be themed (0014-design-systems FR-038): `--ink`, `--background`, `--paper`,
  each unit token, each diagram role, `--font-sans` and `--font-serif` MUST each be a reference to a
  theme role, and the logo and favicon MUST be taken from the theme. Beyond the roles every brand
  supplies, it requires `paper`, `unit-capital`, `unit-ip`, `unit-press`, `unit-studios` and
  `unit-network`. It ships Inter, Source Serif 4 and IBM Plex Mono, so a theme's `font-sans` and
  `font-serif` MUST be among them. Its harness MUST pass under every brand here.
- **FR-005**: Every text and background pairing the chrome uses MUST meet WCAG 2.2 AA (4.5:1 for
  body text, 3:1 for large text), both as tokens and as rendered: primary navigation, breadcrumbs,
  menu buttons, page title, lede, body, section headings, outline buttons, and the footer's
  tagline, headings, links and legal line.
- **FR-006**: Diagram roles MUST be semantic and sparse: ink for structure, path for the line of
  argument, warning, positive and caution for judgment, secondary for a second series. A unit
  color MUST identify its unit and MUST NOT be used as a decorative fill.

## Stylesheets and scripts

- **FR-007**: `css/bundle.txt` MUST list `fonts.css`, `tokens.css`, `base.css`, `chrome.css` and
  `components.css`, in that order, and each MUST exist.
- **FR-008**: The cascade layer order MUST be declared once, first, as `theme, reset, tokens, base,
  chrome, components`. Every rule outside `@font-face` MUST be inside a cascade layer, except one
  unlayered `@media print` block, which is unlayered so print overrides win. No stylesheet MAY
  use `@import`, reference a remote URL, use a CSS framework or utility classes, or use
  `!important` outside a print or reduced-motion block (0014-design-systems FR-009).
- **FR-009**: Fonts MUST be self-hosted `woff2` files in `fonts/`, Latin subsets of Inter, Source
  Serif 4 and IBM Plex Mono, each referenced by `css/fonts.css` and present.
- **FR-010**: `js/chrome.js` MUST be the only first-party script, MUST define the `if-shelf` web
  component and nothing that needs a module system or the network, and every page MUST work
  without it (the shelf is then a scrollable, snap-aligned row). `js/datastar.js` MUST be loaded
  only by a page that needs server-driven interactivity (0014-design-systems FR-008).

## Markup contract

- **FR-011**: A page MUST be `div.shell` holding `header.site-header`, `div.shell__body` and
  `footer.site-footer`, with its content in exactly one `main.page`, capped at `--measure-page`
  with `--gutter` gutters, and exactly one `h1`.
- **FR-012**: The header MUST be sticky at the top of the viewport and hold the brand link with
  the logo and a labelled primary navigation. The link for the current section MUST carry
  `data-active`, and a link to the current page `aria-current="page"`.
- **FR-013**: Every page but the home page MUST carry a breadcrumb band: `nav.crumbs` labelled
  "Breadcrumb", an ordered list whose first item links home and whose last item is the current
  page, marked `aria-current="page"`, the only such item, with matching BreadcrumbList JSON-LD. A
  long trail MUST fold its middle crumbs into a menu as `chrome.md` describes, by the
  `data-fold-sm`, `data-fold-lg` and `data-tail-lg` attributes, in CSS alone.
- **FR-014**: A section with more than three items MUST present them in a section menu built on
  the native Popover API (`button[popovertarget]` and a `[popover]` panel), which opens on
  activation and closes on outside click or Escape; a section with three or fewer MUST use
  `nav.section-nav`.
- **FR-015**: The footer MUST be one column below 48rem and four from 48rem (the logo and tagline,
  then three labelled columns), followed by the legal line.
- **FR-016**: A page MUST use only the class names this design system's CSS defines, every `nav`
  MUST be labelled, every `id` unique, every in-page anchor MUST resolve, every `img` MUST carry
  `alt`, and no script, stylesheet or image MAY load from another origin.
- **FR-017**: No page MAY overflow the viewport horizontally at any width from 320px.
- **FR-018**: `data/navigation.json` MUST hold the primary navigation, each section's menu and
  path prefix, breadcrumb parents and the footer, and the chrome MUST be rendered from it.

## Layouts and the template vocabulary

- **FR-019**: A page MAY name a layout on `body`: `data-app-layout="default"` (header, breadcrumb
  band where a trail exists, page, footer) or `"bare"` (header, page, footer). `data-app-chrome`
  MAY remove `breadcrumbs`, `header` or `footer` from `default`, and `data-app-as="fragment"`
  asks for the rendered body content alone. A page naming no layout MUST be served as written.
- **FR-020**: `templating.md` and `data/registry.json` MUST describe one optional server-side
  template vocabulary the markup contract is written against, every name in it marked `server`
  (consumed while rendering, never sent to a browser) or `client` (a web component in
  `js/chrome.js`). Nothing else in this design system MAY depend on a consumer implementing it.

## Out of scope

- A switch for the dark theme. Dark values exist under `[data-theme="dark"]`, and nothing sets
  that attribute.
- Font subsets beyond Latin.
- Trails for individual records, which a consumer computes from its own content.

## Edge cases

- A section with exactly three items: it uses `nav.section-nav`, not a menu, per FR-014.
- The home page: it has no breadcrumb band, per FR-013.
- A browser without the Popover API: the menu's panel does not open as a popover; the harness
  reports that test as skipped, per FR-014 and 0014-design-systems FR-015.
- A page opened without script: the shelf is a scrollable row, per FR-010.
- A consumer that renders the markup without the template vocabulary: it writes the same classes
  and attributes directly, per FR-019 and FR-020.
- A brand value changed in `frontiers-brand`: this design system's copy no longer agrees and its
  harness fails until the copy is updated, per FR-004.

## Assumptions

- Browsers the consumers target support CSS custom properties, cascade layers, `:has()`, the
  Popover API and anchor positioning, or degrade to a usable page without them.

## Open questions

None.

## Key entities

- **Chrome** — the header, breadcrumb band, menus and footer every page shares.
- **Markup contract** — `chrome.md`: the classes and attributes a page uses.
- **Template vocabulary** — the optional `app-*`, `data-app-*` and `if-*` names in
  `data/registry.json`.

## Success criteria

- **SC-001**: `node assurance/run.mjs` exits zero with `frontiers-brand` beside this design
  system.
- **SC-002**: A page built to `chrome.md` renders the same frame on any backend.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
