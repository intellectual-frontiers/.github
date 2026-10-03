# Feature Specification: Example Brand design system

**Spec ID:** example-brand
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** A brand that is deliberately not Intellectual Frontiers', with its own palette, logo and
favicon, so that every web design system here is proven to be themeable by a brand other than
`frontiers-brand` before any real company relies on it.

## Identity and scope

- **FR-001**: `example-brand` MUST live at `design-systems/example-brand/`, be registered in
  `ifcore.ttl` as an `ifcore:DesignSystem` of the brand kind (0014-design-systems FR-010, FR-028),
  and hold `tokens.json`, `brand.css`, `logos/`, `images/favicon.png`, a `README.md`, this spec and
  an `assurance/` harness. It MUST NOT be the brand of anything published; it exists to test theming.
- **FR-002**: It MUST supply every theme role every brand supplies (0014-design-systems FR-037) and
  every role a web design system here requires (frontiers-nature-web FR-004), with colors that
  differ from `frontiers-brand`'s, so that a value a web design system holds as a literal shows.
- **FR-003**: Its logo MUST be a plain mark and the word "Example", in a lockup for light and one
  for dark backgrounds at two sizes, as PNG and WebP, with an icon and a 64×64 favicon, each listed
  in `tokens.json` with its size.

## Out of scope

- Any rule of identity, imagery or usage beyond the brand contract: this brand exists only to
  theme the web design systems under test.

## Edge cases

- A web design system that fails its harness themed by this brand but passes it themed by
  `frontiers-brand`: it holds a `frontiers-brand` value where it must reference a role, or depends
  on a contrast only `frontiers-brand`'s colors give, per FR-002 and 0014-design-systems FR-039.
- A web design system requiring a role this brand lacks: the role is added here, per FR-002.

## Assumptions

- Inter and Source Serif 4, the families this brand names, are shipped by every web design system
  it themes.

## Open questions

None.

## Key entities

- **Test brand** — a brand that exists to prove theming, never to publish.

## Success criteria

- **SC-001**: Every web design system here passes its harness themed by this brand.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
