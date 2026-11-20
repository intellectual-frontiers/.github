// Spec: 0003-headless-output FR-001, FR-008, FR-010
/**
 * What a program tells Headless about itself (commons headless 0003-headless-output): the mechanisms of the library are configured with the program's
 * own data, never with the library's guesses. Its name and version, the prefix of its environment variables, the name of its folder of state,
 * the catalogue of codes it explains, the patterns of the raw errors it recognizes, where its guides are, which commands its fixes call, its secrets,
 * and its tree. Everything a program keeps for itself (its explanations, its guides, its paths, its prompts) is here as data, and stays its own.
 *
 * @example
 * ```ts
 * import { programOf } from "./program.ts";
 * const p = programOf({ name: "tool", summary: "A tool.", version: "1.0.0", children: [] });
 * p.envPrefix; // "TOOL"
 * ```
 *
 * @module
 */
import { DEFAULT_GENERIC_CODES, type GenericCodes } from "@intellectual-frontiers/headless/governance";
import type { Catalogue, GuideLinks, RawPattern } from "./explain.ts";
import type { FixCommands } from "./fix.ts";
import type { Node } from "./model.ts";
import { nestedNames, type NestedNames } from "./nested.ts";

/** What a program gives. */
export type ProgramConfig = {
  readonly name: string;
  readonly summary: string;
  readonly version: string;
  readonly children: readonly Node[];
  /** The prefix of the program's environment variables (`TOOL`): default, its name in capitals. */
  readonly envPrefix?: string;
  /** The name of its folder under the system's state folder: default, its name. */
  readonly stateApp?: string;
  /** What its fixes may call. */
  readonly fix?: FixCommands;
  readonly catalogue?: Catalogue;
  readonly patterns?: readonly RawPattern[];
  readonly guide?: GuideLinks;
  readonly generic?: GenericCodes;
  /** The secret values the program holds: redacted wherever they would be written. */
  readonly secrets?: () => readonly string[];
  /** The words to run where none are given (`status`); none by default, and the help is shown. */
  readonly defaultCommand?: readonly string[];
};

/** A program with every default filled. */
export type Program = {
  readonly name: string;
  readonly summary: string;
  readonly version: string;
  readonly children: readonly Node[];
  readonly envPrefix: string;
  readonly stateApp: string;
  readonly nested: NestedNames;
  readonly fix: FixCommands;
  readonly catalogue: Catalogue;
  readonly patterns: readonly RawPattern[];
  readonly guide: GuideLinks | undefined;
  readonly generic: GenericCodes;
  readonly secrets: () => readonly string[];
  readonly defaultCommand: readonly string[];
};

/** The program with the defaults of everything it did not give. */
export function programOf(c: ProgramConfig): Program {
  const envPrefix = c.envPrefix ?? c.name.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
  return {
    name: c.name,
    summary: c.summary,
    version: c.version,
    children: c.children,
    envPrefix,
    stateApp: c.stateApp ?? c.name,
    nested: nestedNames(envPrefix),
    fix: c.fix ?? { commands: [c.name], own: [c.name] },
    catalogue: c.catalogue ?? {},
    patterns: c.patterns ?? [],
    guide: c.guide,
    generic: c.generic ?? DEFAULT_GENERIC_CODES,
    secrets: c.secrets ?? (() => []),
    defaultCommand: c.defaultCommand ?? [],
  };
}
