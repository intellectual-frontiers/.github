# Design systems

Governed by [`0014-design-systems`](../spec-kit/specs/0014-design-systems/spec.md).

## What a design system is

A design system is a named, self-contained, versionable set of public
**house rules for one kind of output**, together with the
machine-readable form of those rules, the assets they govern, and an
assurance harness that proves the rules hold. A web design system's
machine-readable form is CSS tokens and stylesheets; a written-voice
design system's is the list of patterns a mechanical sweep looks for. The
shape is the same either way.

A design system is **not** a web property, a work, a content document, or
the tool that produces output from it (a renderer, a typesetting
converter, a site server). Nor does it hold facts about one work, person
or deployment, or views generated from the ontology such as a glossary:
those belong to whoever uses the design system. A consumer vendors
(copies) a design system's directory wholesale and never links back to
this repository live.

## Kinds

Every design system has exactly one **kind**, which decides what its rules
govern, what its machine-readable form is, and what its harness runs on.
Each kind has a profile in
[`0014-design-systems`](../spec-kit/specs/0014-design-systems/spec.md):

| Kind | Code | Governs | Machine-readable form |
| --- | --- | --- | --- |
| brand | `brand` | Palette, typeface families, logo, imagery identity | `tokens.json` |
| web presentation | `web` | How a web page looks; the DOM its chrome expects | CSS custom properties, `tokens.json` |
| print | `print` | How a book, paper or cover is set | Typesetting style files and their data |
| merchandise | `merchandise` | How the brand goes on physical goods: method, placement, ink | Decoration methods and products data |
| figure | `figures` | How a work's figures are drawn | Figure palette and layout data |
| written voice | `written-voice` | How the house writes | Patterns a mechanical sweep looks for |
| spoken voice | `spoken-voice` | How the voice changes for the ear | As written voice, over scripts |

Kinds are recorded in the ontology (`ifcore:DesignSystemKindScheme`), and
`design-systems/` stays flat. A design system's slug is
`<identity>-<code>`: the identity it expresses, then its kind's code, so
the medium is visible wherever the name appears (`frontiers-nature-web`,
`frontiers-console-web`). The code comes from the ontology
(`skos:notation`) and the spec check enforces it. A system never changes
kind; a print counterpart of a web system is a new system with its own
slug. A new kind (motion, slides, sonic) is added by writing its profile
in the spec and adding its concept, with a code, to the scheme. Nothing
else moves.

## Why there's more than one of these

Intellectual Frontiers has more than one kind of output, and may end up
with more than one system of a kind: a different unit, a public-facing
product, an acquisition with its own existing identity. Each one gets its
own `<slug>/` directory here and its own record in the ontology
(`ifcore:DesignSystem`, with a kind, a classification if it is a web
design system, any design systems it derives from,
and a status of active, draft, or retired). The ontology, not this file
or any design system's own `README.md`, is the one record of which
design systems exist and what their status is.

The design systems here today, each with its rules in its own `spec.md`:

- [`frontiers-brand/`](frontiers-brand/README.md) (brand): Intellectual
  Frontiers' palette (Deep Ink, Frontier Blue, Signal Teal, Editorial
  Oxblood, Warm Paper), unit colors, typefaces, logo, icon and imagery; the
  theme of everything it publishes.
- [`example-brand/`](example-brand/README.md) (brand): a test brand that
  proves every web design system can be themed by someone else's brand.
- [`frontiers-nature-web/`](frontiers-nature-web/README.md) (web
  presentation): the public, editorial face.
- [`frontiers-print/`](frontiers-print/README.md) (print): the book
  interior, book cover and journal article, in LaTeX.
- [`frontiers-console-web/`](frontiers-console-web/README.md) (web
  presentation): operator (admin) and
  documentation surfaces: sidebar, navbar and table-of-contents shell in
  three selectable layouts, documentation components, and the data-dense
  pieces an admin console needs.

A design system that is no longer used is removed: its directory and its
ontology record are deleted together, and Git is the record of it.

## Rules, and how they change

Every design system states its house rules as a spec, `spec.md` in its
own directory, in the same format as every other spec in this repository
([`0020-spec-format`](../spec-kit/specs/0020-spec-format/spec.md)). Its
Spec ID is its slug, and its rules are requirements cited from elsewhere
as `<slug> FR-NNN` (for example `frontiers-console-web FR-013`). That
gives house rules everything specs already have: numbers that are never
reused, a row in the enforcement register saying what catches a breach,
a Draft or Adopted status that only the authority in effect moves, and
the spec check on every push. A guide or markup contract in the same
directory explains the rules; it never states one the spec does not. A
long list a rule depends on (banned words, a palette) lives in the
machine-readable form and the requirement cites it.

Changing a house rule is amending that spec, with a commit message saying
what changed and why. A lesson learned from a piece of work becomes a
house rule by being written into the spec as a requirement.

## Brands and themes

A **brand** design system holds one identity: its palette, typefaces, logo, icon and imagery, as
primitive tokens in `tokens.json` (the Design Tokens Community Group format), and a fixed set of
**theme roles** every brand supplies under the same names: `text`, `surface`, `primary`,
`secondary`, `tertiary`, `success`, `warning`, `danger`, `info`, `accent`, `link`, `font-sans` and `font-serif`. Its
`brand.css` declares those roles as `--brand-*` custom properties for the web, `brand.tex` declares
them as `brand-<role>` colors and font and logo commands for print, and `tokens.json` lists its logo
files, favicon and share card, and optionally a **decoration kit** for physical goods (one-color vector logo
and icon, and the spot-color and thread match of each ink). `tools/brand_theme.py` writes both theme files from `tokens.json`. A brand may
also supply an **imagery pool** (`imagery/`): the approved artwork every design system it themes
chooses from, catalogued in `imagery/catalog.json`. `tools/brand_imagery.py` builds and checks it.

A **web** design system never holds a color literal. Its semantic tokens reference the roles
(`--fc-primary: var(--brand-primary)`), every other color (a neutral, a tint, a rule, an overlay) is
mixed from them with `color-mix()`, its logo, favicon and share card come from the brand's
`tokens.json`, and every picture it places comes from the brand's imagery pool. Pairing a web design system with a brand is a
**theme**. A theme changes colors, the typeface (among families the web system ships), the logo and
the favicon; it never changes layout, spacing, components, motion or accessibility.

A **print** design system works the same way: it loads the brand's `brand.tex` before its own
definitions, takes its colors, its text and cover families (among the fonts it ships) and its logos
from it, mixes every other color from its roles, takes cover artwork from its imagery pool, and
holds no color literal.

That is how white-labeling works: a company that wants a web or print design system in its own
colors, logo and imagery supplies a brand, and the design system is used unchanged. A brand that is not yet public
lives, with the same layout and harness, outside this repository.

Every web design system's harness runs under any brand vendored beside it
(`node <slug>/assurance/run.mjs --brand <brand>`), and fails when the brand lacks a role it uses,
names a font it doesn't ship, or makes text unreadable. `tools/run_assurance.sh` runs every web
design system here under every brand here, including [`example-brand`](example-brand/README.md), a
deliberately different test brand that proves no web system depends on Intellectual Frontiers'
own colors. Each print design system's `assurance/run.py` compiles its fixtures under every brand
beside it and checks the output the same way.

A page uses exactly one web design system and one theme. A site may use several, each for an
area of it: www's public pages use `frontiers-nature-web` and its `/console` uses
`frontiers-console-web`, both themed by `frontiers-brand`.

## Classifying web design systems

Each web design system is classified in the ontology on three axes, in the industry's own terms:

| Axis | Values | Source of the terms |
| --- | --- | --- |
| Interaction model (one or more) | *Content site*: marketing site, editorial site, documentation. *Web application*: product application, back office, dashboard, transactional service. | Content vs. application sites; Diátaxis for documentation; GOV.UK for transactional services |
| Expression (exactly one) | productive, expressive | IBM Carbon |
| Density (one or more) | default, comfortable, compact | Material Design |

`frontiers-nature-web` is an editorial and marketing site, expressive. `frontiers-console-web` is
documentation, back office and dashboard, productive.

## Classifying print design systems

Each print design system names the **print document types** it sets, as publishing names them:
book interior, book cover, journal article, report. `frontiers-print` sets book interiors, book
covers and journal articles.

## Derivation

A design system may **derive from** another of a related kind, a spoken-voice system from a
written-voice one, for instance. It inherits every rule of what it derives from, keeps its own
copy of any inherited value it uses so it stays self-contained, and its harness checks that copy
still agrees with the source. It contradicts an inherited rule only with a requirement of its own
that cites the inherited one. A brand is never derived from; it themes.

## Engineering stance

Every web design system under this directory holds to the same stance
(the web presentation profile of 0014-design-systems):

- **Prefer plain HTML, modern CSS and light vanilla JavaScript with
  native web components over any front-end framework.** No React, no
  Vue, no CSS-in-JS, no utility-class framework, no build step a browser
  couldn't already do without. A dependency is admitted only for
  something small this organization doesn't maintain the expertise to
  write itself, or something large and industry-standard — and either
  way, a design system's own `README.md` records what it is and why,
  rather than silently vendoring it.
- **Datastar is the one interactivity dependency named here**, for the
  specific case plain HTML, CSS and a light web component can't cover:
  client-server interactivity — live updates driven from server-held
  state, form submission without a full page navigation, and similar.
  It's opt-in per page where that need actually exists, never loaded
  globally as a default. It is not a general-purpose replacement for a
  front-end framework; reaching for it for ordinary client-side behavior
  (toggling a menu, animating a transition) is reaching too far — a web
  component or a few lines of vanilla JavaScript already covers that.
- Styling lives in CSS custom properties and cascade layers
  (`reset, tokens, base, chrome, components` in `frontiers-nature-web`'s
  case), not in inline styles or a utility-class soup. Changing a token
  means editing the design system's own source, never overriding it from
  a consumer.

## Assurance: every design system proves itself

Every design system carries an `assurance/` harness that runs headlessly, exits non-zero on any
failure, and never reports a test it did not run as passed; what it runs on depends on its kind. A
web design system's harness is described here. It carries an `assurance/` directory
([`0014-design-systems`](../spec-kit/specs/0014-design-systems/spec.md) FR-015) whose entry point,
`assurance/index.html`, is at once the test runner, the report, and the documentation of what that
design system guarantees. It needs nothing but a browser:

| To | Do |
| --- | --- |
| See it work | Open `<slug>/assurance/index.html`. Tests that can run from `file://` do; tests that need `fetch` or iframes are reported as **skipped**, never as passed. |
| Run everything | Serve the directory holding the design system (here, `design-systems/`: `python3 -m http.server`) and open `/<slug>/assurance/`. Serving the parent lets a derived system check its copies against the system it derives from, vendored beside it. |
| Gate a change from a terminal or CI | `node <slug>/assurance/run.mjs` for one system, or `tools/run_assurance.sh` for all (needs Playwright and Chromium; exits non-zero on failure; `--shots DIR` writes screenshots of every fixture). CI runs `tools/run_assurance.sh` on every push that touches `design-systems/`. |

Each harness has `fixtures/` (complete pages written to the system's markup contract, which are both the
test subjects and reference renderings), `unit.js` and `integration.js` (the suites, plus `theme.js` in a web system and `contract.js` in a brand, each with a
description that is rendered into the page as documentation), and a runner (`runner.js`, `boot.js`,
`run.mjs`). The runner files are **copied** between design systems rather than shared, so each directory
stays self-contained. A change to a design system is complete when its harness is green over http.

## Using a web design system, in any web environment

None of this assumes Intellectual Frontiers' own stack, or even that the
consumer is part of this organization. Whatever the kind, vendor the whole
directory, a brand beside it to theme it, record the slug and source
commit of each copy, and never edit a copy in place. To use a web design
system from this directory:

1. Pick the one that fits (see the table above) and open its own
   `README.md` — it lists exactly what's inside and any specifics beyond
   what's described here.
2. Vendor (copy) that design system's whole directory into your own
   project. Don't link back to it live from this repository, and don't
   edit your vendored copy in place — pull a fresh copy when it changes
   (every change to a design system here is public, per
   0014-design-systems FR-014).
3. Concatenate its CSS files in the cascade order its own `css/bundle.txt`
   lists (or serve them as separate stylesheets in that same order — the
   cascade layers, not the file boundaries, are what make the order
   matter). Point any font references at wherever you actually serve its
   `fonts/` directory.
4. Load the brand's `brand.css` before the design system's stylesheets, take the logo and
   favicon from the brand's `tokens.json`, and serve its `fonts/`, `images/` and `js/` directories as
   static assets.
5. Load its first-party script (e.g. `frontiers-nature-web`'s `js/chrome.js`, `frontiers-console-web`'s `js/console.js`)
   on every page. Load its Datastar bundle only on pages that actually
   need server-driven interactivity, per the engineering stance above.
6. Build your page markup to the contract described in its `chrome.md` —
   the header, breadcrumb band, menu and footer structure it expects.
   You don't need any particular backend or templating language to do
   this: a design system's markup contract is just HTML and class names.
   Some design systems (today, `frontiers-nature-web`) also carry reference
   documentation for an *optional* server-side template vocabulary their
   own markup happened to be designed against — that's a convenience if
   you're building something similar, never a requirement for using the
   design system itself.

## Adding a new design system

1. Create `design-systems/<slug>/`, where `<slug>` ends with its kind's
   code (see Kinds above), with whatever assets the system
   actually needs; document its real layout in its own `README.md` (see
   `frontiers-nature-web/README.md` for the shape that's worked so far, not
   as a rigid template).
2. Add an `assurance/` harness per 0014-design-systems FR-015 and its
   kind's profile. For a web system: copy
   `runner.js`, `boot.js` and `run.mjs` from an existing system, write
   `fixtures/`, `unit.js`, `integration.js` and an `index.html`, and make it pass.
3. Write its `spec.md` (Spec ID: its slug) per 0014-design-systems FR-022
   and 0020-spec-format, and add a row for each requirement to
   `spec-kit/enforcement.tsv`. Run `python3 tools/spec_check.py`.
4. Register it in `ifcore.ttl` as an `ifcore:DesignSystem` individual with
   its slug (`dcterms:identifier`), a status, a kind (`dcterms:type`; a web system adds its
   interaction models, expression and densities) and anything it derives from
   (`prov:wasDerivedFrom`), per 0014-design-systems FR-010. Its kind must
   already have a profile in the spec (FR-018).
5. Add it to the list above.
