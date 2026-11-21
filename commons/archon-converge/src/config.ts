// Spec: 0002-converge-command FR-001
/**
 * What a fleet gives the plugin: the dialect that converges (Archon orchestrates and a dialect carries out), where the dialect's render is kept on the machine, how the tool's version is read, the options of the fleet's own that its commands need, and the one function that says, for an
 * asset, what must be true of it and how to reach it, or why it is not for this plugin to change (a machine that is adopted, or that another system converges). Which machines there are and where the requirements are kept is the fleet's.
 *
 * @example
 * ```ts
 * import type { ConvergePluginConfig } from "./config.ts";
 * // a fleet builds a ConvergePluginConfig in its composition root and passes it to convergePlugin
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { Dialect } from "@intellectual-frontiers/archon/dialect";
import type { Requirement } from "@intellectual-frontiers/archon/governance";
import type { Executor } from "@intellectual-frontiers/headless/logical";
import type { ValueOption } from "@intellectual-frontiers/terminal/args";

/** An option of the fleet's own, made with `value` of the terminal's arguments. */
export type FleetOption = ValueOption<string, "none" | "required" | "default", never>;

/** What must be true of an asset and how to reach it. */
export type ConvergeSubject = {
  /** The requirements the dialect carries out, in any order (the order is made from their dependencies). */
  readonly requirements: readonly Requirement[];
  /** The requirements that no dialect carries: they are said, never left out silently. */
  readonly unexpressed: readonly Requirement[];
  /** The way to run a program on the machine. */
  readonly executor: Executor;
  /** The prefix that raises rights where the account needs it (empty for none). */
  readonly elevate: readonly string[];
};

/** Why an asset is not for the plugin to converge: the words, a code, and how the command ends. */
export type Refusal = { readonly message: string; readonly code: string; readonly exit: "usage" | "findings" | "environment" };

/** What a fleet gives the plugin. */
export type ConvergePluginConfig = {
  /** The version of the plugin as published. */
  readonly version: string;
  /** The program the plugin extends: `archon` by default; another command (a fleet's own) may use the same plugin. */
  readonly program?: string;
  /** The dialect that converges: given by the fleet. */
  readonly dialect: Dialect;
  /** The folder on the machine that the dialect renders into (the dialect's own `renderRoot`). */
  readonly renderRoot: string;
  /** The argument vector that prints the tool's version, which must hold the version the dialect pins. */
  readonly toolVersion: readonly string[];
  /** The options of the fleet's own (where the tenant is, how to reach the machine), by name. */
  readonly options?: Readonly<Record<string, FleetOption>>;
  /** What must be true of an asset, given the options the person gave. */
  readonly subject: (asset: string, options: Readonly<Record<string, string>>) => Promise<Result<ConvergeSubject, Refusal>>;
};
