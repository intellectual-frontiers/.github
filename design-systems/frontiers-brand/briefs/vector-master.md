# Brief: a vector master of the lockup and icon

**For:** an illustrator or identity designer. **From:** Intellectual Frontiers. **Governs:** `../spec.md` FR-006 to
FR-011, FR-017.

## Why it is needed

The lockup (the engraved frontier landscape beside the two-line "Intellectual / Frontiers" wordmark) exists only as
raster PNG, largest 1229×362 px. Everything downstream works around that:

- Goods: the one-color decoration artwork is a mechanical trace of the PNG. Its finest detail is 0.12% of its width,
  so the landscape cannot be embroidered on a cap or polo at any size; small goods carry the wordmark alone.
- Large print: at the 150 pixels per inch a printed sign needs, the lockup can be no wider than 8.2 inches, so a
  roll-up banner or a poster carries it small.
- Screens: high-density displays enlarge the PNG past its pixels above about 600 px wide.

## What to deliver

1. **The lockup and the icon as vector masters**: SVG and PDF (and the source file, such as `.ai`), with the
   wordmark's letters converted to outlines, in a light and a dark version (the dark for Deep Ink backgrounds).
   Drawn from the approved master's composition, proportions and landscape, not reinterpreted (FR-006, FR-009).
2. **One-color versions** of the lockup and icon for decoration (screen print, pad print, laser, deboss): every
   shape a single fill, no gradient, no hairline, with the engraving's line weights opened up so the finest line or
   gap is at least **1% of the artwork's width** (the lockup then embroiders from 4 inches wide; FR-017).
3. **A simplified landscape mark** for the smallest goods (a cap's side, a polo's sleeve, a pen): the landscape
   alone, reduced to the few masses that read at 1.5 inches, finest detail at least **2.5% of its width**.
4. **The wordmark as it is set**: the lockup's wordmark is Inter at its Display optical size, weight 850, tracked
   −0.04em, baselines 0.88em apart (FR-004). Keep that setting; correct the spacing by eye only where the outlined
   letters need it, and say where.

## Colors

The landscape's engraving is grayscale with color only where people have built or measured things (FR-012). The
full-color masters keep the approved master's colors; give each a value in sRGB. The one-color versions take a
single ink, set by whoever orders the goods from the brand's ink roles (`tokens.json`, decoration kit).

## How the delivery is checked

The files go into `logos/vector/` beside the traced ones they replace, listed in `tokens.json`, and the brand's
contract runs over them (`node assurance/run.mjs`): one-color files in `currentColor` with no raster, live text,
gradient or filter; each one's finest detail is measured by `agora decoration show`, and must meet the
figures above. When they pass, FR-017 is amended to name the vector masters in place of the trace, and the
merchandise and signage design systems pick them up with no change of their own.

## What not to do

- Do not redraw the landscape as a different scene, simplify it into an emblem or a circle, or add a frame (FR-009).
- Do not generate any part of it with a generative tool (FR-009, 0014-design-systems FR-047).
