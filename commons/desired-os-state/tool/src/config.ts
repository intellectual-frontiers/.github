// Spec: 0002-tool-command FR-001
/**
 * What a fleet gives the plugin: the catalog of tools it needs, the dialects it chose with the way each is run and observed, the pins, the policy tools are resolved under, which computer this is and the
 * folder the rendered files go in. The plugin holds none of it, so that two fleets with different tools and different dialects use the same plugin.
 *
 * @example
 * ```ts
 * import type { ToolPluginConfig } from "./config.ts";
 * // a fleet builds a ToolPluginConfig in its composition root and passes it to toolPlugin
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { Dialect } from "@intellectual-frontiers/desired-os-state/dialect";
import type { DialectId, JsonValue, ProfileName, Requirement, RequirementId } from "@intellectual-frontiers/desired-os-state/governance";
import type { Permit, Refusal } from "@intellectual-frontiers/estate/governance";
import type { Catalog, Platform } from "@intellectual-frontiers/toolchain/governance";
import type { Context, PinSource, ToolDialect } from "@intellectual-frontiers/toolchain/logical";

/** A dialect the fleet chose, with what the plugin needs to resolve, carry out, observe and clean with it. */
export type ToolRuntime = {
  /** How Toolchain reads it: its id, its manager, what it guarantees. */
  readonly tool: ToolDialect;
  /** How Desired OS State renders and steps it. */
  readonly dialect: Dialect;
  /** What is installed, as the desired state itself for a tool that is as asked and a state that differs for one that is not. */
  readonly observe: (requirements: readonly Requirement[]) => Promise<ReadonlyMap<RequirementId, JsonValue>>;
  /** Removes what can be got again; the lines say what was removed. A dialect with nothing to clean leaves it out. */
  readonly clean?: (o: { readonly programs: boolean }) => Promise<readonly string[]>;
};

/** What a fleet gives the plugin. */
export type ToolPluginConfig = {
  /** The version of the plugin as published. */
  readonly version: string;
  /** The program the plugin extends: `desired-os-state` by default; another command (a fleet's own) may use the same plugin. */
  readonly program?: string;
  readonly catalog: Catalog;
  readonly runtimes: readonly ToolRuntime[];
  /** The dialects, most preferred first. */
  readonly preference: readonly DialectId[];
  readonly pins: PinSource;
  /** The policy tools are resolved under (the platform, the control `toolIntegrity`, whether a copy on the path counts, whether source builds are approved). */
  readonly policy: Omit<Context, "preference" | "platform"> & { readonly platform: Platform };
  /** The name of this computer, as the fleet names it. */
  readonly subject: string;
  /** The interlock of the fleet (`permits` of estate over its approved boundaries): the permit for `apply` on this computer at an instant, or why it is refused. No step of a plan is made without it. */
  readonly interlock: (subject: string, at: string) => Result<Permit<"apply">, Refusal>;
  /** The assurance profile of the fleet. */
  readonly assurance: ProfileName;
  /** The folder the rendered files go in, under `.desired-os-state/<digest>/`, and the working folder of every step. */
  readonly workFolder: string;
};
