# Chrome anatomy and markup contract

Semantic classes, no utilities. `data-*` attributes carry variants and state. Everything below is exercised
by `assurance/` against the pages in `assurance/fixtures/`.

## Document

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page · Site</title>
  <!-- stylesheets in css/bundle.txt order -->
  <script src="js/console.js" defer></script>
</head>
<body>
  <a class="fc-skip" href="#main">Skip to content</a>
  <fc-shell data-layout="docs|notebook|home"> … </fc-shell>
</body>
```

Required: `lang`, a title, the viewport meta, exactly one `h1`, exactly one `main#main` as the skip target,
a label on every `nav`, one `aria-current="page"` in the sidebar tree, unique ids, resolvable `#anchors`,
`alt` on every image, and an accessible name on every icon-only button.

## Shell

```
fc-shell[data-layout]            CSS grid; state: data-sidebar-open, data-sidebar-collapsed
  header.fc-nav                  sticky navbar            (grid area: nav)
  aside.fc-sidebar#fc-sidebar    sidebar / drawer         (grid area: sidebar)
  button.fc-btn.fc-sidebar-expand  appears when the sidebar is collapsed
  div.fc-page                    (grid area: page)
    main.fc-article#main
    aside.fc-toc                 optional; from 80rem
  div.fc-backdrop                created by js/console.js if absent
```

| Layout | Navbar | Sidebar | Table of contents |
| --- | --- | --- | --- |
| `docs` | below 64rem only | persistent from 64rem, drawer below | beside the article from 80rem, disclosure below |
| `notebook` | always | persistent from 64rem beneath the navbar, drawer below | as `docs` |
| `home` | always | none | none |

Layout is driven by tokens (`--fc-nav-height`, `--fc-sidebar-width`, `--fc-toc-width`, `--fc-article-width`,
`--fc-layout-width`, `--fc-gutter`); the breakpoints are 64rem and 80rem.

## Navbar

`header.fc-nav` contains, in order: `button.fc-btn.fc-nav__toggle[data-fc-sidebar-toggle][aria-controls=fc-sidebar][aria-expanded][aria-label]`
(omit on `home`), `a.fc-brand`, `nav.fc-nav__links[aria-label]` of `a.fc-nav__link` (the current one has
`aria-current`), `.fc-nav__spacer`, `.fc-nav__actions`.

## Sidebar

```
aside.fc-sidebar
  .fc-sidebar__head      a.fc-brand + button.fc-sidebar__collapse[data-fc-sidebar-collapse]
  .fc-sidebar__tools     fc-search, details.fc-menu (root switcher)
  .fc-sidebar__scroll    nav.fc-tree[aria-label] > ul
  .fc-sidebar__foot
```

Tree: `li.fc-tree__label` (section heading); `a.fc-tree__link` (`aria-current="page"` on the current page);
`details > summary + ul` for folders. Add `span.fc-badge.fc-tree__badge` for a trailing tag.

## Article

`main.fc-article` holds `nav.fc-crumbs[aria-label=Breadcrumb] > ol`, `header.fc-article__head`
(`h1.fc-title`, `p.fc-description`, `.fc-actions`), an optional `details.fc-toc-mobile` wrapping an
`fc-toc`, the body inside `.fc-prose`, `nav.fc-pager` (`a[rel=prev|next]`) and `footer.fc-footer`.
Headings in the body carry ids; `h2 > a.fc-anchor` makes them linkable.

Table of contents: `aside.fc-toc[aria-label] > p.fc-toc__title + fc-toc > ol > li > a[href=#id][data-depth=2|3|4]`.
An empty `<fc-toc scope="main" depth="3">` builds itself from the headings. `aria-current="true"` follows scroll.

## Components

| Component | Markup |
| --- | --- |
| Button | `.fc-btn[data-variant=primary\|ghost\|danger][data-size=sm\|icon]` |
| Badge | `.fc-badge[data-tone=primary\|success\|warning\|danger\|info][data-dot]` — state is text, never colour alone |
| Menu | `details.fc-menu > summary + .fc-menu__panel > a.fc-menu__item` (closes on outside click and Escape) |
| Callout | `.fc-callout[data-type=info\|warning\|error\|success] > .fc-callout__body > p.fc-callout__title + p` |
| Cards | `.fc-cards > a.fc-card \| div.fc-card` with `.fc-card__icon`, `.fc-card__title`, `.fc-card__text` |
| Tabs | `fc-tabs[sync=key] > [role=tablist] > button[role=tab]` then one `[role=tabpanel]` per tab, in order. Arrow, Home and End keys. |
| Steps | `ol.fc-steps > li > .fc-steps__title + content` |
| Accordion | `.fc-accordion > details > summary + .fc-accordion__body` |
| Files | `.fc-files > ul > li.fc-files__item \| li > details > summary + ul` |
| Code block | `fc-codeblock > figure.fc-code > [.fc-code__title] + pre > code`; a copy button is added |
| Type table | `.fc-typetable > table`; `td[data-type]`, `code[data-required]` |
| Banner | `.fc-banner[data-tone]` |
| Search | `fc-search[src=index.json \| inline script type=application/json][placeholder][label]`; Ctrl/Cmd+K or `/` opens it. Index items: `{title, description?, href, section?, keywords?}`. Selecting dispatches a cancelable `fc-search-select`. |
| Toast | `FcToast.show(message, {type, timeout})` |

## Admin

| Component | Markup |
| --- | --- |
| Data table | `fc-table[filter=#input][count=#el] > table`; sortable headers `th[data-sort][=number]`; numeric cells `td[data-numeric]` with optional `data-value` for sorting |
| Toolbar | `.fc-toolbar` with `.fc-toolbar__count` and `.fc-toolbar__spacer` |
| Stats | `.fc-stats > .fc-stat[data-tone] > .fc-stat__label + .fc-stat__value + .fc-stat__note` |
| Form | `.fc-form > .fc-field > label.fc-label + .fc-input\|.fc-select\|.fc-textarea + .fc-hint\|.fc-error`; `.fc-check`, `.fc-switch`; invalid controls set `aria-invalid="true"` and point `aria-describedby` at the `.fc-error` |
| Empty state | `.fc-empty > .fc-empty__title + .fc-empty__text + action` |
| Run log | `fc-terminal[title][status]`; `.write(text, "err"\|"ok"\|"dim")`, `.clear()`; `role="log"`, pinned to the end unless the reader scrolls up |
| Key/value | `dl.fc-kv` |

## Behaviour contract (js/console.js)

Everything is progressive: without the script the sidebar tree, details-based menus, accordions, anchors
and the table of contents links still work; the script adds the drawer, collapse, tabs, scroll-spy, search,
sorting, filtering, copy buttons and the run log.

- `fc-shell`: `.toggleDrawer()`, `.openDrawer()`, `.closeDrawer()`, `.toggleCollapsed()`, `.layout`. Escape and the
  backdrop close the drawer; focus moves in on open and returns to the opening button on close.
- `fc-codeblock` dispatches `fc-copy` (`detail: {text, ok}`); `fc-table` dispatches `fc-table-sort`;
  `fc-search` dispatches `fc-search-select`.
- No component reads or writes anything beyond `localStorage` keys `fc-sidebar-collapsed` and `fc-tabs:<sync>`;
  both are optional and failures are ignored.
