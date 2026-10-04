# Frontiers Figures

How every figure is drawn, in any medium: a book, a paper, a web page or a slide. Its rules are
[`spec.md`](spec.md); it is governed by
[`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md). See
[`../README.md`](../README.md) for what a design system is and how theming works.

| Path | What it is |
| --- | --- |
| `roles.json` | The figure roles (ink, primary, emphasis, ...) and, per variant, the brand role or mix each takes; the standard and compact canvases; the families shipped and their x-heights. |
| `svgkit.py` | Drawing primitives: boxes, labels, arrows, curves, titles. Every color is a role, and text is measured in the theme's sans. |
| `layouts.py` | The figure types: process, comparison, cycle, layer, relationship, decision and hierarchy diagrams, and the charts: bar, line and timeline, every series labelled directly (spec FR-012). |
| `figcheck.py` | These rules as a check: canvas, roles not colors, minimum type, labels fitting their boxes. In this repository: `agora check figures --scope PATH`, with `--brand` to measure in a brand's sans. |
| `theme.py` | The stylesheet a brand and a variant give a figure; `apply` puts it in one and sets its type at the brand sans's optical size. In this repository: `agora figure build PATH --brand SLUG --variant VARIANT [--embed-fonts] [-o OUT]`. |
| `fonts/` | Inter, which the kit measures in and a renderer sets the labels in. |
| `assurance/` | `run.py`: every figure type on both canvases, under every brand and variant, plus fixtures that must fail. |

## Using it

Draw a figure (Python 3 with Pillow):

```python
import sys; sys.path.insert(0, "design-systems/frontiers-figures")
import layouts, svgkit
svgkit.use_brand("design-systems/frontiers-brand")      # measure in the theme's sans
layouts.gate("fig-2.1.svg", "Ship or test again?", None,
             "Does the evidence hold?", "Ship it", "Go back and test")
```

and check it:

```
python3 design-systems/frontiers-figures/figcheck.py --brand design-systems/frontiers-brand fig-2.1.svg
```

The figure names roles, never colors. Theme it when it is rendered or placed:

```
python3 design-systems/frontiers-figures/theme.py apply fig-2.1.svg \
    --brand design-systems/frontiers-brand --variant default -o fig-2.1.themed.svg
```

In this repository the same two steps are `agora check figures --scope fig-2.1.svg --brand frontiers-brand` and
`agora figure build fig-2.1.svg --brand frontiers-brand -o fig-2.1.themed.svg`.

- **Print:** render the themed figure with `rsvg-convert -f pdf`, with `fonts/` where fontconfig finds it.
- **The web:** inline the themed figure, or serve it as an image.
- **A dark page or slide:** `--variant on-dark`. **One-color print:** `--variant grayscale`.
- **A narrow slot:** draw it on the compact canvas (`width=svgkit.CANVAS["compact"]`).

A different brand needs no change to the figure: theme it with that brand.

## Charts

A chart takes the roles `series-1` to `series-4` (at most four series) and, for a scale, `seq-1` to `seq-5`. The
harness checks that every series meets 3:1 on the surface and stays apart from every other to normal and color-blind
vision under every brand and variant, so a brand's palette cannot ship a chart nobody can read. Label every series
directly; the layouts do:

```python
layouts.line_chart("fig-3.2.svg", "Stopped pilots cost less every year", "Median spend, in thousands",
                   ["2023", "2024", "2025"], [("With a failure test", [80, 62, 48]), ("Without one", [190, 170, 165])],
                   unit="k", source="Our 2025 pilot reviews")
```
