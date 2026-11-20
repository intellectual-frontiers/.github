/**
 * The configuration of commons' documentation site (commons 0011-documentation FR-023): the site the generator in `docs/` makes from
 * commons' TypeScript and spec kit, with the SQL Aide and File Aide lenses commons keeps beside the generator (FR-026). `bun main.ts build`
 * and `bun main.ts check` in `docs/` find it, since it is the first `docs.config.ts` from there up to the repository's root.
 *
 * @module
 */
import type { DocsConfig } from "./docs/config.ts";
import { fileAide } from "./docs/lens/file-aide.ts";
import { sqlAide } from "./docs/lens/sql-aide.ts";

/** Commons' site: its packages, its spec kit, how its specifications are cited, and its lenses. */
export const config: DocsConfig = {
  name: "IF Commons",
  subject: "commons",
  root: "..",
  repository: "https://github.com/intellectual-frontiers/.github",
  home: { dir: "commons" },
  packages: [
    { dir: "commons/ts", slug: "ifc-typescript" },
    { dir: "commons/ts/data", slug: "data" },
    { dir: "commons/docs", slug: "docs" },
  ],
  specKits: [
    { layout: "commons", dir: "commons/spec-kit" },
    { layout: "commons", dir: "commons/core/spec-kit" },
    { layout: "commons", dir: "commons/rdf/spec-kit" },
    { layout: "commons", dir: "commons/terminal/spec-kit" },
    { layout: "commons", dir: "commons/system/spec-kit" },
    { layout: "commons", dir: "commons/telemetry/spec-kit" },
    { layout: "commons", dir: "commons/crypto/spec-kit" },
    { layout: "commons", dir: "commons/formats/spec-kit" },
    { layout: "commons", dir: "commons/data/spec-kit" },
    { layout: "commons", dir: "commons/ergonex/spec-kit" },
  ],
  citations: { prefix: "commons", digits: 4, text: ["erga", "archon", "stolos", "thyra"] },
  lenses: [sqlAide, fileAide],
  lintRules: "commons/ts/lint/rules",
  out: "_site",
};

export default config;
