// Spec: 0003-host FR-003
/**
 * What a template is given and what it is (commons 0003-host FR-003): a template is a TypeScript function from the decoded data to a list of generated files, and not text in a template language,
 * so that the compiler checks it and no value of the data can become code. `TemplateData` is the manifest and the two facts a probe gave; `Template` names its generator, which the header of each
 * of its files says.
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Manifest } from "../manifest.ts";
import type { GeneratedFile, GenerateError } from "../render.ts";
import type { Tool } from "../tools/catalog.ts";

/** A tool as the resolved catalog lists it: the catalog's own `Tool`. */
export type ToolEntry = Tool;

/** What the templates read: the decoded manifest, whether `direnv` is wanted and found (0003-host FR-023), and the resolved tool catalog (the manifest's, empty where it names none). */
export type TemplateData = {
  readonly manifest: Manifest;
  /** The manifest says `direnv` is wanted and a probe found it. */
  readonly direnv: boolean;
  readonly tools: readonly ToolEntry[];
};

/** A template: its generator's name and what it makes. */
export type Template = {
  readonly name: string;
  readonly render: (data: TemplateData) => Result<readonly GeneratedFile[], readonly GenerateError[]>;
};
