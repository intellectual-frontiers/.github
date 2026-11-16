/**
 * The library of IFC Docs, `@intellectual-frontiers/ifc-docs` (commons 0011-documentation FR-021, FR-023, FR-026): the configuration's
 * types and its check, the command line's parts, the build of a site and its writing, and what a lens is given and uses (the build, the
 * areas and their API, the page model and its helpers). A repository's `docs.config.ts` needs only the types; a lens imports the rest
 * from here.
 *
 * @example
 * ```ts
 * import { buildSite, loadConfig, report } from "@intellectual-frontiers/ifc-docs";
 * const config = await loadConfig("docs.config.ts");
 * if (config.kind === "ok") console.log(report((await buildSite(config.value)).found));
 * ```
 *
 * @module
 */
export type {
  About,
  AboutArea,
  AboutCommand,
  AboutEnforcer,
  AboutExample,
  AboutFolder,
  AboutPhase,
  AboutPhaseState,
  AboutRule,
  AboutSpec,
  CitationsConfig,
  Config,
  DocsConfig,
  HomeConfig,
  LinkedRepository,
  PackageConfig,
  PackageSource,
  SpecKitConfig,
  SpecKitSource,
} from "./config.ts";
export { isAbout, normalDir, resolveConfig, under } from "./config.ts";
export type { Lens, LensPages } from "./lens.ts";
export { Build } from "./build.ts";
export { type Finding, message, type Problem, report } from "./check.ts";
export type { ApiExport, ApiMember, AreaApi, ExportKind } from "./extract/api.ts";
export type { Constitution, Enforcement, Spec, SpecKit } from "./extract/specs.ts";
export type { LinkScope } from "./links.ts";
export type { Badge, Block, Card, Href, Inline, Page, Section, Tab, TreeNode } from "./model.ts";
export { plain, possessive, slugOf } from "./model.ts";
export { areaPage, firstSentence } from "./pages/overview.ts";
export type { Area, Package } from "./sources.ts";
export { type DocComment, moduleComment } from "./tsdoc.ts";
export { type Built, buildSite, writeSite } from "./site.ts";
export { type Command, findConfig, loadConfig, main, parseArgs, USAGE } from "./cli.ts";
