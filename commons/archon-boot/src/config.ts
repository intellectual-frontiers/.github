// Spec: 0002-boot-command FR-001
/**
 * What a fleet gives the plugin: for an asset, the order of what the machine must be, the two dialects that render its install and its playbook, and where the rendered files are kept; a guard for what may be installed at all; and the boot server's view of the fleet (the hosts, the rendered
 * install data, the secret that is put in as it is served). Which machines there are, where they are written and who may install them is the fleet's.
 *
 * @example
 * ```ts
 * import type { BootPluginConfig } from "./config.ts";
 * // a fleet builds a BootPluginConfig in its composition root and passes it to bootPlugin
 * ```
 *
 * @module
 */
import type { Result } from "@intellectual-frontiers/core";
import type { Dialect } from "@intellectual-frontiers/archon/dialect";
import type { Requirement } from "@intellectual-frontiers/archon/governance";
import type { BootProvider } from "@intellectual-frontiers/netboot/physical";
import type { ValueOption } from "@intellectual-frontiers/terminal/args";

/** An option of the fleet's own, made with `value` of the terminal's arguments. */
export type FleetOption = ValueOption<string, "none" | "required" | "default", never>;

/** What is rendered for one asset. */
export type BootSubject = {
  /** The requirements of the machine, all of them: each dialect takes the ones it carries. */
  readonly requirements: readonly Requirement[];
  /** The dialect that renders the install (the autoinstall), made for this asset with the placeholders of the secret and the address. */
  readonly install: Dialect;
  /** The dialect that renders the playbook the machine converges itself with. */
  readonly playbook: Dialect;
  /** The folder the rendered files are written in (the fleet's layout). */
  readonly dir: string;
  /** The files' paths as the person is told them (relative to the fleet's repository). */
  readonly shown: string;
};

/** Why an asset may not be installed: the words, a code and how the command ends. */
export type Refusal = { readonly message: string; readonly code: string; readonly exit: "usage" | "findings" | "environment" };

/** What a fleet gives the plugin. */
export type BootPluginConfig = {
  /** The version of the plugin as published. */
  readonly version: string;
  /** The program the plugin extends: `archon` by default. Its upper-case name prefixes the variables the plugin reads: `<PROGRAM>_BOOT_STATE`, `<PROGRAM>_BOOT_ASSETS` and `<PROGRAM>_SECRETS`. */
  readonly program?: string;
  /** The options of the fleet's own (where the tenant is), by name. */
  readonly options?: Readonly<Record<string, FleetOption>>;
  /** What is rendered for an asset, or why it is not to be installed. */
  readonly subject: (asset: string, options: Readonly<Record<string, string>>) => Promise<Result<BootSubject, Refusal>>;
  /** The boot server's view of the fleet for a secrets folder (or none). */
  readonly provider: (options: Readonly<Record<string, string>>, secrets: string | undefined) => BootProvider;
};
