# Frontiers Merchandise

How the brand goes on physical goods (branded merchandise, or promotional products): T-shirts,
polos, caps, mugs, tumblers, pens and totes. Its rules are [`spec.md`](spec.md); it is governed by
[`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md). See
[`../README.md`](../README.md) for what a design system is and how theming works.

| Path | What it is |
| --- | --- |
| `data/methods.json` | Each decoration method (screen printing, embroidery, pad printing, laser engraving, direct-to-garment printing, debossing): its kind of ink, most inks, finest line or gap, and whether it can reproduce imagery. |
| `data/products.json` | Each product, its category, the methods allowed on it, and each imprint location's largest artwork in inches. |
| `decoration.py` | These rules as a checker: give it a decoration job and a brand, and it names every rule the job breaks. |
| `assurance/` | Fixture jobs that must pass and must fail, and `run.py`, which checks them under every brand here. |

## Using it

This design system is themed by a brand's **decoration kit** (0014-design-systems FR-047): a
one-color vector lockup and icon, and optionally a wordmark for small goods, each with its finest
detail, and the spot-color and thread match of each color role allowed on goods. It holds no artwork
or color of its own. A brand without a kit cannot theme it.

Write a decoration job:

```json
{"product": "polo", "location": "left-chest", "method": "embroidery",
 "artwork": "icon", "ink": "text", "substrate": "#ffffff", "width_in": 2.4}
```

and check it before sending it to a decorator:

```
python3 design-systems/frontiers-merchandise/decoration.py job.json --brand design-systems/example-brand
```

`artwork` is `lockup`, `icon`, or `imagery:<id>` (a piece of the brand's imagery pool, only by
direct-to-garment printing). `ink` is a role in the kit's `inks`, left out for laser engraving and
debossing. `substrate` is the goods' color. The decorator gets the kit's vector file in the ink's
spot-color or thread match, at the job's width.
