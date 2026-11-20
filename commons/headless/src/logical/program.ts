// Spec: 0003-headless-output FR-001, FR-008, FR-010
// Spec: 0009-composition FR-006
// Spec: 0010-audience-tiers FR-002
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
import { DEFAULT_GENERIC_CODES, DEFAULT_LADDER, type GenericCodes, type TierLadder } from "@intellectual-frontiers/headless/governance";
import type { Catalogue, GuideLinks, RawPattern } from "./explain.ts";
import type { FixCommands } from "./fix.ts";
import type { Node } from "./model.ts";
import type { Target } from "./remote.ts";
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
  /** The names of the keys that are secret in this program (`APP_TOKEN`): the value of `KEY=value` is redacted. A sentence that only names a variable is not. */
  readonly secretKeys?: readonly string[];
  /** The targets `--on` can name. */
  readonly targets?: readonly Target[];
  /** How a run over targets is bounded: how many at once (4) and how long each may take (30 s). */
  readonly remote?: { readonly concurrency?: number; readonly perHostTimeoutMs?: number };
  /** The words to run where none are given (`status`); none by default, and the help is shown. */
  readonly defaultCommand?: readonly string[];
  /** The tiers of the program, lowest first, and the tier of a caller who says nothing (0010-audience-tiers): the default ladder where none is given. */
  readonly tiers?: TierLadder;
  /** Who contributed each command, by the words of its id (0009-composition): the run log says it. */
  readonly origins?: Readonly<Record<string, string>>;
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
  readonly secretKeys: readonly string[];
  readonly defaultCommand: readonly string[];
  readonly targets: readonly Target[];
  readonly remote: { readonly concurrency: number; readonly perHostTimeoutMs: number };
  readonly tiers: TierLadder;
  readonly origins: Readonly<Record<string, string>>;
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
    secretKeys: c.secretKeys ?? [],
    defaultCommand: c.defaultCommand ?? [],
    targets: c.targets ?? [],
    remote: { concurrency: c.remote?.concurrency ?? 4, perHostTimeoutMs: c.remote?.perHostTimeoutMs ?? 30_000 },
    tiers: c.tiers ?? DEFAULT_LADDER,
    origins: c.origins ?? {},
  };
}
