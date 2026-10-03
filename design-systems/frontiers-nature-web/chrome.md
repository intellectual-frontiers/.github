# Chrome anatomy

Semantic classes; no utilities. Items in `{braces}` come from `data/navigation.json`.

## Frame
```
div.shell
  header.site-header
  div.shell__body   {page}
  footer.site-footer
```
`main.page` holds content: max width 72rem, 1.5rem gutters, 4rem block padding. `.wrap` is the width
container used inside the header and footer.

## Header (sticky, one unit)
`header.site-header` is `position: sticky; top: 0; z-index: 40`, translucent `--shell` with blur.
1. `.wrap.site-header__bar`: `a.brand > img.brand__logo` (150px, 180px from 40rem, `srcset` of the
   five WebP sizes) and `nav.nav-primary.label` of `{primary}` links. The link whose section is
   active carries `data-active`; an exact path match carries `aria-current="page"`.
2. `.crumbband` (absent on home) > `.wrap.crumbband__inner`:
   - `.crumbband__trail` holds `nav.crumbs[aria-label=Breadcrumb] > ol > li` and the BreadcrumbList
     JSON-LD. The first crumb is home; the last is `span[aria-current=page]`.
   - A section menu: `div.menu.menu--section` when the section has more than three items, else
     `nav.section-nav` (shown from 48rem).

### Breadcrumb fold (CSS only)
The server sets on `nav.crumbs`: `data-fold-sm` (n ≥ 5), `data-fold-lg` (a fold exists at ≥ 48rem)
and `data-tail-lg` (2 or 3). When folding, an `li.crumbs__fold` follows the first crumb holding the
ellipsis menu; CSS hides the middle crumbs. The menu lists everything between the first crumb and
the last two, each with `data-d` (distance from the end); entries still visible inline at ≥ 48rem
are hidden by CSS.

### Menus
```
div.menu.menu--section|menu--crumbs
  button.menu__button[popovertarget=ID]
  div.menu__panel#ID[popover]
```
Anchor names `--menu-section` and `--menu-crumbs`; the panel is `position: fixed`, placed under the
button with `anchor()`. Outside click and Escape close it natively. The chevron rotates via `:has(:popover-open)`.

## Super footer
`footer.site-footer`: `.wrap.site-footer__grid` (4 columns from 48rem: logo and tagline, then three
`.site-footer__col` with a `.label` heading), then `.site-footer__legal`: `© {copyrightFrom}–{year}
{legal}`, What's new link and the Atom feed link.

## Page header and blocks
`.t-title` (page title), `.t-lede`, `.label` eyebrow; `.t-section` headings; `.heading-row` for a
heading with an "All …" link; `.rows` ruled lists; `.cols--2|3|split` grids; `.hero` with
`.hero__media`, `.hero__scrim`, `.hero__body`; `if-shelf` (web component) around `.shelf__track` with `.book` cards; `.updates`.

## Content classes
A page's own markup may use only the class names this CSS defines; a consumer enforces this with
its own linting.

## Layouts
`<body data-app-layout="default|bare">`, under the optional template vocabulary described in
`templating.md`. With no `data-app-layout` there is no layout:
the document is served as written. `default`: header, breadcrumb band where a trail exists, page,
footer. `bare`: header, page, footer, with no breadcrumb band or section menu.
`data-app-chrome="no-breadcrumbs no-header no-footer"` refines `default`.
`data-app-as="fragment"` returns the rendered body content alone.
