# Design systems

Governed by [`0014-design-systems`](../spec-kit/specs/0014-design-systems/spec.md).

## What a design system is

A design system is a self-contained, versionable set of visual and
front-end assets — CSS design tokens, cascade-layered stylesheets,
self-hosted fonts, logos and images, a small set of web components, and a
written markup contract for the page chrome it defines. It is **not** a
web property, a content document, or a templating engine: it supplies
what a property's pages look like and the DOM shape its interactive
chrome expects, nothing about where that property's content or business
logic comes from. A property vendors (copies) a design system's directory
wholesale and renders its own pages against it; it never links back to
this repository live.

## Why there's more than one of these

This directory, not a single unnamed `design-system/`, is deliberately
plural. Intellectual Frontiers may end up with more than one visually
distinct system — a different unit, a public-facing product, an
acquisition with its own existing identity — without retiring whichever
one(s) already exist. Each one gets its own `<slug>/` directory here, and
its own record in the ontology (`ifcore:DesignSystem`, with a status of
active, draft, or retired — the ontology, not any design system's own
`README.md`, is the one place that status is decided).

Right now there are two:

| Design system | Status | What it's for |
| --- | --- | --- |
| [`frontiers-nature/`](frontiers-nature/README.md) | Active | Intellectual Frontiers' own "natural-frontier" visual identity: deep ink, frontier blue, signal teal, editorial oxblood, warm paper. The public, editorial face. |
| [`frontiers-console/`](frontiers-console/README.md) | Draft | Operator (admin) and documentation surfaces: sidebar, navbar and table-of-contents shell in three selectable layouts, documentation components, and the data-dense pieces an admin console needs. Governed by [`0018-frontiers-console`](../spec-kit/specs/0018-frontiers-console/spec.md). |

The status column is a convenience; the ontology is the record.

## Engineering stance

Every design system under this directory is expected to hold to the same
stance, not just the one that happens to exist today:

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
  (`reset, tokens, base, chrome, components` in `frontiers-nature`'s
  case), not in inline styles or a utility-class soup. Changing a token
  means editing the design system's own source, never overriding it from
  a consumer.

## Assurance: every design system proves itself

Every design system carries an `assurance/` directory
([`0014-design-systems`](../spec-kit/specs/0014-design-systems/spec.md) FR-015) whose entry point,
`assurance/index.html`, is at once the test runner, the report, and the documentation of what that
design system guarantees. It needs nothing but a browser:

| To | Do |
| --- | --- |
| See it work | Open `<slug>/assurance/index.html`. Tests that can run from `file://` do; tests that need `fetch` or iframes are reported as **skipped**, never as passed. |
| Run everything | Serve the design system's directory (`python3 -m http.server`) and open `/assurance/`. |
| Gate a change from a terminal or CI | `node <slug>/assurance/run.mjs` (needs Playwright and Chromium; exits non-zero on failure; `--shots DIR` writes screenshots of every fixture). |

Each harness has `fixtures/` (complete pages written to the system's markup contract, which are both the
test subjects and reference renderings), `unit.js` and `integration.js` (the suites, each with a
description that is rendered into the page as documentation), and a runner (`runner.js`, `boot.js`,
`run.mjs`). The runner files are **copied** between design systems rather than shared, so each directory
stays self-contained. A change to a design system is complete when its harness is green over http.

## Using any one of these design systems, in any web environment

None of this assumes Intellectual Frontiers' own stack, or even that the
consumer is part of this organization. In general, to use a design
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
4. Serve its `fonts/`, `logos/`, `images/` and `js/` directories as
   static assets.
5. Load its first-party script (e.g. `frontiers-nature`'s `js/chrome.js`, `frontiers-console`'s `js/console.js`)
   on every page. Load its Datastar bundle only on pages that actually
   need server-driven interactivity, per the engineering stance above.
6. Build your page markup to the contract described in its `chrome.md` —
   the header, breadcrumb band, menu and footer structure it expects.
   You don't need any particular backend or templating language to do
   this: a design system's markup contract is just HTML and class names.
   Some design systems (today, `frontiers-nature`) also carry reference
   documentation for an *optional* server-side template vocabulary their
   own markup happened to be designed against — that's a convenience if
   you're building something similar, never a requirement for using the
   design system itself.

## Adding a new design system

1. Create `design-systems/<slug>/` with whatever assets the system
   actually needs; document its real layout in its own `README.md` (see
   `frontiers-nature/README.md` for the shape that's worked so far, not
   as a rigid template).
2. Add an `assurance/` harness per 0014-design-systems FR-015: copy
   `runner.js`, `boot.js` and `run.mjs` from an existing system, write
   `fixtures/`, `unit.js`, `integration.js` and an `index.html`, and make it pass.
3. Register it in `ifcore.ttl` as an `ifcore:DesignSystem` individual with
   a status, per 0014-design-systems FR-010.
4. Add it to the table above.
