# Frontiers imagery pool

The approved frontier artwork every design system `frontiers-brand` themes chooses from: a book
cover, a web page's hero, a share image. Its rules are `frontiers-brand` FR-012 and FR-015; the
pool's shape is 0014-design-systems FR-043. Which work uses which piece is never recorded here: each
work's production pipeline keeps its own record.

| Path | What it is |
| --- | --- |
| `<id>.png` | The master: the approved file byte for byte, with real transparency. |
| `web/<id>-<width>.webp` | The master as WebP for the web, at half and full width. |
| `catalog.json` | What each piece shows and can stand for, and its files. Its `fields` block defines every field. |

`agora check imagery --scope frontiers-brand` checks the pool; `agora imagery list frontiers-brand` and
`agora imagery show frontiers-brand/<id>` read it, with what each master measures; `agora imagery build frontiers-brand`
writes the WebP files, the share card and the app icons; `agora imagery add frontiers-brand --master <png> ...` adds a
piece (with `--dry-run`, it only measures the candidate).

## Choosing a piece

Start from what the work is about, not its subject:

1. What is difficult or unknown?
2. What path is being taken through it?
3. What did people build to cross, observe, control, inhabit or understand it?
4. What should the reader understand differently afterward?

Then search `catalog.json` by `metaphors`, `visual_anchor`, `route` and `suggested_subjects`. Aim for
metaphor: a telegraph line, not a hospital; a mine headframe, not a stock chart. A strong existing
match beats a speculative new piece.

## The rule every piece follows

- The natural frontier is grayscale.
- Human intervention is selectively colored.
- Water may also be colored.

Color marks where people have passed through, built, measured, or learned to live: trails, fences,
signposts, bridges, railways, tunnels, aqueducts, dams, pipelines, cableways, lookouts,
lighthouses, cabins, mills, outposts, telegraph lines, lanterns, docks. Rock, earth, trees, snow, sky
and fog stay gray. A piece implies reality, exploration, traversal, observation, building and
understanding, and is never an empty scenic view.

## Making a new piece

Make one when no piece suits a work, or when the pool is thin in an environment. It leans alpine;
forest, volcanic, subterranean, badlands and plains, polar, wetland and river-delta frontiers are
underused.

Write down the frontier (the environment), the route (how people move through it), the anchor (the
one built thing the eye lands on) and the metaphor. Upload two or three pieces from this pool as
style references, from a different environment than the one wanted, so the generator copies the
style and not the scene, and send:

```
Using the attached images as a strict style reference, create one new
illustration in exactly the same style.

Scene: [the frontier]. A [route] leads in from the foreground to
[anchor]. [Optional supporting details.]

Style rules, all required:
- Hand-drawn pen-and-ink engraving, like a 19th-century expedition
  journal or geological survey: fine cross-hatching, stippling, and
  topographic detail.
- The natural world (rock, earth, trees, mountains, snow, sky, fog)
  is grayscale only: black, charcoal, and gray.
- Only human-made things are in color: [list them]. Use restrained,
  naturalistic color: weathered timber browns, brick and barn reds,
  iron rust, lamplight amber.
- Water is colored in natural blues and teals.
- Strong foreground, middle ground, and distant horizon. A clear
  route leading in from the foreground. One dominant anchor, not a
  cluttered panorama.
- Landscape format, about 4:3.
- Transparent background. The drawing's outer edges are irregular
  and organic, like a vignette cut from a larger engraving; no
  rectangular frame, no border, no white box.
- Absolutely no text anywhere: no words, letters, numbers, labels,
  captions, arrows, legends, map text, or writing on signs. Signposts
  are blank boards.
- No people in the foreground, no photographic realism, no glossy
  digital rendering, no fantasy or storybook look.
```

Ask for three or four variations and pick the best rather than editing a weak one, since each edit
drifts the style. If natural elements come back colored, ask for the same image with every natural
element in pure grayscale; if a sign has lettering, ask for blank boards; if the background is
white, ask for a transparent one. Never cut a background out by hand. Download the full-resolution
PNG.

## Accepting a piece

Accept it only if every answer is yes:

- [ ] Land, trees, sky and snow are grayscale; color appears only on human-made things and water.
- [ ] There is a visible route and at least one built structure.
- [ ] One dominant anchor reads at thumbnail size (about 1.5 inches wide).
- [ ] No text, numbers, arrows, labels or lettering anywhere.
- [ ] Real transparent background with irregular edges; no rectangle, border or white box.
- [ ] It sits on the same shelf as the pool's style and palette.
- [ ] It is not a near-duplicate of a piece already here.
- [ ] It is about 4:3 landscape.
- [ ] `agora imagery add --dry-run` reports real transparency and a colored share near the pool's 9–24%. Too high
      usually means colored rock or foliage; too low, built things that came out gray.
- [ ] The brand's owner has approved it.

## Adding it

1. Name the approved PNG environment first, then the anchor, lowercase with hyphens
   (`river-delta-survey-tower.png`); its name without `.png` is the id.
2. Run `agora imagery add frontiers-brand --master river-delta-survey-tower.png --name ... --environment ...` with every
   field the catalog needs, describing what is drawn, not what was asked for. It copies the PNG here unchanged, measures it
   and writes the `catalog.json` entry. A genuinely new kind of frontier adds a value to `environments` first.
3. Run `agora imagery build frontiers-brand`, then `agora check imagery --scope frontiers-brand`, and fix everything
   `check` reports.
