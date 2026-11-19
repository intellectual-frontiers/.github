// Spec: 0003-host FR-005
/**
 * The `lefthook.auto.yml` template (the lead's brief for 0003-host FR-005, amended in FR-024): the same three hooks as `hooks.ts`, in the form of a lefthook configuration, for a person who
 * runs lefthook in the workspace's own repository. It calls the generated scripts and holds no checker of its own, and no path but the relative one to them.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import { generated } from "../render.ts";
import type { Template } from "./data.ts";
import { HOOK_NAMES, type HookName } from "./hooks.ts";

const argument = (name: HookName): string => (name === "commit-msg" ? " {1}" : "");

/** The template: one file at the root. */
export const lefthookTemplate: Template = {
  name: "lefthook",
  render: () => {
    const text = HOOK_NAMES.flatMap((name) => [
      `${name}:`,
      "  commands:",
      "    ergonex:",
      `      run: sh .ergonex/hooks/${name}${argument(name)}`,
    ]).join("\n");
    const file = generated("lefthook.auto.yml", { format: "yaml", text }, { generator: "ergonex templates/lefthook" });
    return file.kind === "err" ? err([file.error]) : ok([file.value]);
  },
};
