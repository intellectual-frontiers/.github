// Spec: 0001-docs FR-002
/**
 * The library of IFC Docs, `@intellectual-frontiers/commons/docs` (commons 0011-documentation FR-021, FR-023, FR-026): the configuration's
 * types and its check, the command line's parts, the build of a site and its writing, and what a lens is given and uses (the build, the
 * areas and their API, the page model and its helpers). A repository's `docs.config.ts` needs only the types; a lens imports the rest
 * from here.
 *
 * @example
 * ```ts
 * import { buildSite, loadConfig, report } from "@intellectual-frontiers/commons/docs";
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
  BookPart,
  BookVolume,
  BooksConfig,
  CitationsConfig,
  EvidenceSource,
  IssueLike,
  IssuesOf,
  PageSelector,
  PresentationId,
  Config,
  DocsConfig,
  HomeConfig,
  LinkedRepository,
  PackageConfig,
  PackageSource,
  SpecKitConfig,
  SpecKitSource,
} from "./config.ts";
export { DEFAULT_PRESENTATIONS, isAbout, normalDir, PRESENTATION_IDS, resolveConfig, under } from "./config.ts";
export { Build } from "./build.ts";
export { type Evidence, isOpen, type LibraryResults, NONE, parseCtrf, parseTickets, readEvidence, requirementsIn, standing, type TestResult, type TestStatus, type Ticket, type TypedIssue } from "./evidence.ts";
export { type Finding, message, type Problem, report } from "./check.ts";
export type { ApiExport, ApiMember, AreaApi, ExportKind } from "./extract/api.ts";
export type { Constitution, Enforcement, Spec, SpecKit } from "./extract/specs.ts";
export type { LinkScope } from "./links.ts";
export { llmsIndex, markdownOf, twinOf } from "./emit/markdown.ts";
export type { Layer, LayerElement, LayeredFinding, LayeredModel, LayeredSource, LayeredSubject, Locate, SourceLocation, TraceEdge } from "./layered.ts";
export type { Lens, LensPages, SiteFile } from "./lens.ts";
export type { Badge, Block, Card, Href, Inline, Page, Section, Tab, TreeNode } from "./model.ts";
export { plain, possessive, slugOf } from "./model.ts";
export { areaPage, firstSentence } from "./pages/overview.ts";
export type { Area, Package } from "./sources.ts";
export { type DocComment, moduleComment } from "./tsdoc.ts";
export { type Built, buildSite, writeSite } from "./site.ts";
export { type Made, type OutFile, PRESENTATIONS, type Presentation, presentationFiles, staleFiles, writeFiles } from "./presentation.ts";
export { bookFiles, GENERATED, selection, volumeText, type BookFile } from "./book.ts";
export { type AdocScope, inlinesAdoc, pageAdoc, pageAnchor } from "./emit/asciidoc.ts";
export { type Command, findConfig, loadConfig, main, parseArgs, USAGE } from "./cli.ts";
