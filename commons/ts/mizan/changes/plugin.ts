/**
 * The `changes` check as a rule plugin of Mizan (commons 0020-ifccm FR-032), for what a folder of specifications can judge offline: the shape of a harness's declaration (a regulated domain
 * claimed with no production day). The rules that read commits need a range and are the command's (`changes.ts`).
 *
 * @remarks
 * A plugin runs once for each specification, and a declaration is one for the harness, so the plugin reports it only for the specification it is anchored to (the first of the folder), and
 * `holdHarness` anchors it. A finding of it is in the gate phase: a declaration that is wrong by itself is refused whatever the baseline holds.
 *
 * @limits
 * It reads no Git and no host.
 *
 * @example
 * ```ts
 * import { declarationPlugin } from "./plugin.ts";
 * declarationPlugin({ regulatedDomains: ["DeviceQuality"] }, "ifccm.declaration.ts", "0001-x").check({ slug: "0001-x", spec: "" }).length; // 1
 * ```
 *
 * @module
 */
import type { RulePlugin } from "../rules.ts";
import { type Declaration } from "./declaration.ts";
import { declarationFindings } from "./rules.ts";

/** The plugin that finds a declaration wrong by itself, reporting it for the specification named `anchor` only. */
export function declarationPlugin(declaration: Declaration | undefined, file: string, anchor: string | undefined): RulePlugin {
  return {
    id: "changes/declaration",
    check: (s) => (s.slug === (anchor ?? "") ? declarationFindings(declaration, file) : []),
  };
}
