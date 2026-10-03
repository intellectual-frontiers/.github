# Feature Specification: Frontiers Merchandise design system

**Spec ID:** frontiers-merchandise
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** How the brand goes on physical goods (branded merchandise, or promotional products):
which decoration method may be used on which product, where the artwork goes and how large, the
limits of each method, and which ink or thread goes on which goods, themed by any brand that
supplies a decoration kit.

## Identity and scope

- **FR-001**: `frontiers-merchandise` MUST live at `design-systems/frontiers-merchandise/` and be
  registered in `ifcore.ttl` as an `ifcore:DesignSystem` of the merchandise kind, classified by
  every decoration method and product category its data governs (0014-design-systems FR-010,
  FR-046). It MUST NOT assume which decorator, supplier or ordering tool a consumer uses.
- **FR-002**: It MUST hold `data/methods.json`, `data/products.json`, `decoration.py` (these rules,
  as a checker of one decoration job), a `README.md`, this spec and an `assurance/` harness
  (0014-design-systems FR-006, FR-045). It MUST NOT hold artwork, a logo, a color, or a tool that
  produces artwork or proofs.

## Theme

- **FR-003**: It MUST be themed (0014-design-systems FR-038, FR-044): every logo it places MUST be
  the brand's decoration kit's one-color lockup, icon or wordmark (0014-design-systems FR-047), every ink and
  thread a color role the kit allows on goods, reproduced with the kit's spot-color or thread match,
  and every picture a piece of the brand's imagery pool. It requires a decoration kit; a brand
  without one cannot theme it. Its harness MUST pass under every brand here that has a kit.

## Decoration methods

- **FR-004**: The methods and their limits MUST be these, stated in `data/methods.json`:

  | Method | Ink | Most inks | Finest line or gap | Imagery |
  | --- | --- | --- | --- | --- |
  | screen printing | spot | 4 | 0.010 in | no |
  | embroidery | thread | 6 | 0.040 in | no |
  | pad printing | spot | 2 | 0.006 in | no |
  | laser engraving | none | 0 | 0.006 in | no |
  | direct-to-garment printing | process | any | 0.020 in | yes |
  | debossing | none | 0 | 0.020 in | no |

## Products and imprint locations

- **FR-005**: The products, their categories, the methods allowed on each, and each imprint
  location's largest artwork (width × height, in inches) MUST be these, stated in
  `data/products.json`:

  | Product | Category | Methods | Imprint locations |
  | --- | --- | --- | --- |
  | T-shirt | apparel | screen printing, direct-to-garment printing | left chest 4 × 4, full front 12 × 14, back yoke 10 × 3 |
  | Polo shirt | apparel | embroidery | left chest 4 × 2.5, right sleeve 3 × 1.5 |
  | Structured cap | headwear | embroidery | front panel 4.5 × 2.25, left side 2.5 × 1.5 |
  | Ceramic mug | drinkware | screen printing, pad printing | front 3.5 × 3, wrap 8.5 × 3.25 |
  | Stainless steel tumbler | drinkware | laser engraving | front 2.5 × 3 |
  | Ballpoint pen | writing instruments | pad printing, laser engraving | barrel 1.75 × 0.3 |
  | Canvas tote | bags | screen printing, direct-to-garment printing | front 10 × 10 |
  | Leather tote | bags | debossing | front 6 × 4 |

## Decoration jobs

- **FR-006**: A decoration job MUST name a product, one of its imprint locations, a method allowed
  on it, and its artwork: the kit's lockup, its icon, its wordmark where the kit has one, or a piece
  of the imagery pool. A job naming a wordmark under a brand whose kit has none is refused. A piece of the
  imagery pool MUST be decorated only by a method that reproduces full color, in its own colors,
  never recolored, cropped or combined with the logo.
- **FR-007**: The artwork MUST fit the imprint location, in width and in height at its own aspect
  ratio. A lockup, icon or wordmark MUST be placed no smaller than the brand's print minimum for it, and no
  smaller than the method's finest line divided by the artwork's finest detail, so that no line or
  gap is finer than the method holds. Where the lockup cannot fit by those rules, the icon is used.
- **FR-008**: A one-color lockup, icon or wordmark MUST be decorated in exactly one ink, a color role in the
  kit's inks: by its spot-color match for screen and pad printing, by its thread match for
  embroidery, and by its own value for direct-to-garment printing. Laser engraving and debossing MUST
  use no ink. A job sent to a decorator (`"order": true`) MUST use only an
  ink whose matches the brand has verified against the physical guide and card; a proof MAY use any.
- **FR-009**: An ink MUST reach at least 3:1 contrast with the goods' color (the substrate), as WCAG
  2.2 measures non-text contrast: a dark role on light goods, a light role on dark goods.

## Assurance

- **FR-010**: `assurance/run.py` MUST check this design system's data (every product's category and
  methods are listed, every location is a positive width and height, no data file holds a color
  literal, and the ontology classifies it by every method and category its data governs), then,
  under each brand beside it that has a decoration kit, that every job in
  `assurance/fixtures/pass/` meets every rule and every job in `assurance/fixtures/fail/` breaks the
  rule it names. A pass job whose artwork the brand's kit fits at no size by its method on its
  location is the brand's limit, not a fault in the rules: it MUST be reported as beyond that kit,
  never as a pass, and every pass job MUST meet every rule under at least one brand here. It MUST
  report a brand without a kit as unable to theme goods, never as a pass, and report each product
  the kit fits by no allowed method.

## Out of scope

- Proofs, mockups, and the order sent to a decorator: a consumer's tools make them from a job that
  passes `decoration.py`.
- Garment sizes, product suppliers and prices.
- Full-color process printing of the logo by any method other than direct-to-garment printing.

## Edge cases

- A lockup too detailed for a method at the location's size: the job fails, per FR-007; the icon is
  used instead.
- An icon too detailed for a method at any size the location allows: the product cannot carry the
  brand by that method; the harness reports it, per FR-010, and the brand's kit needs a simpler
  approved mark for it (0014-design-systems FR-047).
- Goods whose color is close to every ink: no ink reaches 3:1, per FR-009; other goods are chosen.
- A brand without a decoration kit: it cannot theme this design system, per FR-003.

## Assumptions

- A decorator reproduces a spot-color or thread match from its name in the matching system the kit
  names.

## Open questions

None.

## Key entities

- **Decoration method** — how artwork goes on goods: screen printing, embroidery, pad printing,
  laser engraving, direct-to-garment printing, debossing.
- **Imprint location** — where on a product artwork goes, and its largest size.
- **Decoration job** — one product, location, method, artwork, ink, goods color and width.
- **Substrate** — the goods' own color.

## Success criteria

- **SC-001**: `python3 assurance/run.py` exits zero with every brand here beside this design system.
- **SC-002**: Any job a consumer writes is accepted or refused by `decoration.py` with the rule it
  breaks named.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
