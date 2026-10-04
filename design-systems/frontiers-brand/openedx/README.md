# frontiers-brand-openedx

frontiers-brand's brand for Open edX, in the shape of [openedx/brand-openedx](https://github.com/openedx/brand-openedx) for Paragon 23's design tokens. Written by `agora openedx generate` from the brand's `tokens.json`; do not edit, rewrite it.

- `dist/` is the built package: `core.css` and `light.css` (with `.min.css` and maps), `theme-urls.json`, the logos, favicon and fonts. A managed host that takes a theme by URL can be given `dist/` as it is.
- To rebuild: `npm install`, then `make build` (or `agora openedx build <brand> --paragon node_modules/.bin/paragon` from the repository).
- To install in a Tutor instance: publish or pack this directory (`npm pack`) and install it in place of `@openedx/brand-openedx`, as Tutor's MFE plugin documents.
