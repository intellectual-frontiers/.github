/**
 * The configuration of the fixture repository (commons 0011-documentation FR-019, FR-023, FR-027): a repository with no `about.ts`,
 * whose one package and area are given here, a plain spec kit with a constitution, and citations that link commons' public site and show
 * erga's as text. The smoke test of the release copies this folder into an empty project and builds it with the packed package.
 *
 * @module
 */
import type { DocsConfig } from "@intellectual-frontiers/ifc-docs/config";

/** The fixture's site. */
export const config: DocsConfig = {
  name: "Fixture",
  subject: "the fixture",
  repository: "https://github.com/example/fixture",
  home: { dir: ".", about: { title: "Fixture", summary: "A repository with one package, one area and a plain spec kit, and no `about.ts`." } },
  packages: [
    {
      dir: ".",
      slug: "fixture",
      about: {
        title: "Fixture package",
        summary: "The package of the fixture, given by its configuration (FR-027 of commons 0011-documentation).",
        areas: [{ title: "Greeting", slug: "greeting", entryPoints: ["src/mod.ts"], spec: { repo: "fixture", id: "001-greeting" } }],
      },
    },
  ],
  specKits: [{ layout: "spec-kit", dir: "specs" }],
  citations: {
    prefix: "fixture",
    digits: 3,
    linked: [{ repo: "commons", site: "https://intellectual-frontiers.github.io/.github/", digits: 4 }],
    text: ["erga"],
  },
};

export default config;
