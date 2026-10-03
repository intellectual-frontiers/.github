# Feature Specification: Frontiers Console design system

**Spec ID:** frontiers-console-web
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** A second design system, `frontiers-console-web`, for Intellectual Frontiers' **operator
(admin) and documentation** surfaces — the kind of interface a property's `/console` needs — as a
counterpart to the public, editorial `frontiers-nature-web`. Its visual and structural model is a
neutral, bordered documentation theme with a persistent sidebar, a table of contents and
command-palette search, chosen because that interaction model is well understood and reads well for
dense reference and operations content. It is implemented from scratch in this organization's own
stack, and ships with a browser-based assurance harness that doubles as its documentation.

## Identity and scope

- **FR-001**: `frontiers-console-web` MUST live at `design-systems/frontiers-console-web/`, be registered in
  `ifcore.ttl` as an `ifcore:DesignSystem` of the web presentation kind, classified as
  documentation, back office and dashboard, productive, at default density (0014-design-systems
  FR-010, FR-041), and carry the status that registration
  states, not one asserted in its own README (0014-design-systems FR-011).
- **FR-002**: It MUST serve two kinds of surface from one set of assets: **documentation** (articles,
  reference, specs) and **administration** (tables, forms, status, run output). It MUST NOT assume
  which web property consumes it, which backend renders it, or how its content is authored.
- **FR-003**: It MUST be a distinct system from `frontiers-nature-web`, which it does not replace,
  and it MUST be themed (0014-design-systems FR-038): `--fc-background`, `--fc-popover`,
  `--fc-foreground`, `--fc-accent-foreground`, `--fc-primary`, `--fc-ring`, `--fc-success`,
  `--fc-warning`, `--fc-danger`, `--fc-info`, `--fc-terminal-bg` and `--fc-font-sans` MUST each be a
  reference to a theme role, each status tint MUST be mixed from its role and the theme's
  `surface`, and the logo and favicon MUST be taken from the theme. It requires no role beyond
  those every brand supplies, and it ships Inter and IBM Plex Mono, so a theme's `font-sans` MUST
  be Inter. Its harness MUST pass under every brand here.

## Engineering stance

- **FR-004**: It MUST hold to 0014-design-systems FR-007–FR-009: plain HTML, modern CSS with custom
  properties and cascade layers, and light vanilla JavaScript with native web components. It MUST have
  **no runtime dependency** of any kind other than self-hosted fonts, which its README records with
  their license. Datastar is not used by this system.
- **FR-005**: Its CSS, JavaScript and markup MUST be written from scratch. Nothing MAY be copied or
  vendored from another documentation framework or theme; another project's *documented behaviour* MAY
  be used as a guide to what a good result looks like. Its README states this.
- **FR-006**: Its stylesheets MUST declare one cascade-layer order, once, in the first layered file, and
  put every other rule in the layer named for its file: `theme, reset, tokens, base, layout,
  prose, components, admin`, where `theme` is filled by the brand's `brand.css`. Component and admin rules MUST sit after `prose`, so a component is never
  restyled by article typography.
- **FR-007**: Its design tokens MUST be CSS custom properties prefixed `--fc-`, defined in
  `css/tokens.css` as the source of truth, and mirrored exactly, one entry per property, in
  `tokens.json` in the Design Tokens Community Group format, a value the theme supplies written as
  a `{role.*}` alias (0014-design-systems FR-036). Token names MUST be semantic, not theme-specific, so a theme can be added by
  redefining them.

## Layouts

- **FR-008**: Three layouts MUST be selectable by one attribute, `data-layout`, on the `fc-shell`
  element, without changing the markup inside it, and changing the attribute at runtime MUST reflow the
  page:
  - `docs` — a persistent sidebar and no navbar on wide screens;
  - `notebook` — a full-width navbar with the sidebar beneath it;
  - `home` — a navbar and a page, no sidebar.
- **FR-009**: Below 64rem (1024 px) the sidebar MUST be an off-canvas drawer that is neither visible nor
  focusable while closed, opens from a labelled menu button, and closes on Escape or backdrop click,
  returning focus to the button. From 64rem it MUST be persistent and collapsible, the choice
  remembered. The table of contents MUST sit beside the article from 80rem and fold into a disclosure
  above the article below it. No page MAY scroll horizontally at any width from 320 px.
- **FR-010**: Layout dimensions (navbar height, sidebar, table-of-contents and article widths, gutter)
  MUST be tokens, and changing one MUST move the layout.

## Components

- **FR-011**: The documentation set MUST include: breadcrumbs, a previous/next pager, a sidebar tree
  with folders and section labels, a root switcher menu, a table of contents that builds itself from
  headings and follows scroll, callouts (four types), cards, tabs (with optional cross-instance sync),
  steps, accordion, a file tree, code blocks with a copy button, a type/props table, a banner, a
  toast, and a long-form prose style.
- **FR-012**: The administration set MUST include: a sortable and filterable data table that reports
  its row count and shows an empty state, stat tiles, status badges, form controls (text, select,
  textarea, checkbox, switch) with error and hint patterns, an empty-state block, a key/value list, and
  an append-only run log.
- **FR-013**: Search MUST be a command palette over a JSON index supplied inline or by URL, opened by
  Ctrl/Cmd+K, `/` (except while typing in a field) or its trigger button, with arrow-key selection, a
  combobox/listbox ARIA pattern, and a cancelable selection event so a consumer can intercept it.
  The system defines the index shape; it does not define how a consumer produces one.
- **FR-014**: Status MUST NEVER be conveyed by colour alone; every status badge carries text.

## Accessibility and progressive enhancement

- **FR-015**: Text MUST meet WCAG 2.2 AA contrast (4.5:1, or 3:1 for large text) on every background it
  is used on, measured on tokens and on rendered components; form-control boundaries and the focus ring
  MUST meet 3:1. Every interactive element MUST be keyboard operable with a visible focus indicator;
  icon-only controls MUST have accessible names; motion MUST respect `prefers-reduced-motion`.
- **FR-016**: Everything MUST degrade without script as far as plain HTML allows: the tree, menus,
  accordions, anchors and table-of-contents links work without it; script adds the drawer, collapse,
  tabs, scroll-spy, search, sorting, filtering and copy buttons. The one script MUST be a single classic
  script (no modules, no imports, no network access).

## Documentation and assurance

- **FR-017**: `chrome.md` MUST state the markup contract — anatomy, class names, attributes and the
  behaviour of each web component — completely enough that a page can be built without reading the
  CSS. `README.md` MUST state how to vendor and use the system in any environment
  (0014-design-systems FR-013).
- **FR-018**: The system MUST carry an assurance harness satisfying 0014-design-systems FR-015, and its
  suites MUST cover at least: token completeness and `tokens.json` parity; contrast; layer order and
  the engineering stance of FR-004–FR-006; each web component's keyboard and ARIA contract; each
  layout at its breakpoints; no horizontal overflow; the markup contract on every fixture; and the
  interactions of FR-009, FR-011–FR-013.
- **FR-019**: Light theme only. A switchable dark theme is out of scope here (see Out of scope).

## Out of scope

- **A dark theme.** Token names are semantic so one can be added; nothing is wired to a switch,
  consistent with `frontiers-nature-web`.
- **Which property uses it, and migration of any existing `/console`** (0014-design-systems FR-012): a
  fact about that property, decided in that property's own specs after this system is tested.
- **Producing a search index, rendering Markdown, syntax highlighting, authentication, and any
  server-side or templating behaviour.** The system defines markup and styling for them, not their
  implementation.
- **Non-Latin font subsets.**

## Edge cases

- A viewport exactly 64rem wide: the sidebar is persistent and collapsible; one pixel narrower it is an
  off-canvas drawer, per FR-009.
- A viewport between 64rem and 80rem: the table of contents folds into a disclosure above the article,
  per FR-009.
- `/` typed while the focus is in a text field: it types the character and does not open search, per
  FR-013.
- A consumer that wants to route a search selection itself: it cancels the selection event, per FR-013.
- Two statuses whose badge colours a reader cannot tell apart: each badge still carries its text, per
  FR-014.
- A page loaded with script disabled: the tree, menus, accordions, anchors and table-of-contents links
  still work, per FR-016.

## Assumptions

- A consumer can copy the directory whole and serve it, fonts included, from its own origin.
- The browsers a consumer targets support CSS custom properties, cascade layers and native web
  components without a polyfill.
- A consumer can produce a search index in the JSON shape the system defines.

## Open questions

- **OQ-1**: Whether the admin set needs a pagination control and a date/time input once a property's
  first real console migrates; not specified until a real page needs them.
- **OQ-2**: Whether syntax-highlighting token colours should be defined as `--fc-` tokens now so
  server-side highlighters can target them.
- **OQ-3**: How the sidebar presents below 64rem when script is unavailable is not stated: FR-009 makes
  it a drawer there, and FR-016 leaves the drawer to script.

## Key entities

- **`frontiers-console-web`** — the design system this spec governs, at `design-systems/frontiers-console-web/`.
- **Shell** — the `fc-shell` element, its `data-layout`, and the navbar, sidebar, page and table of
  contents it arranges.
- **Fixture** — a complete page in `assurance/fixtures/` that is both a test subject and a reference
  rendering.

## Success criteria

- **SC-001**: `assurance/index.html`, served over http, reports every suite passing; opened from
  `file://` it reports every runnable test passing and every test it cannot run as skipped, never as
  passed.
- **SC-002**: `node assurance/run.mjs` exits zero on a clean checkout and non-zero when a token, layout,
  contrast or behaviour regression is introduced.
- **SC-003**: A page built only from `chrome.md` and the vendored directory renders correctly in all
  three layouts with no other file from this repository.
- **SC-004**: No stylesheet or script in the directory depends on a framework, a build step, a remote
  URL, or another project's source.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which properties vendor this system) is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
