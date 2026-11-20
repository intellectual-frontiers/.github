// Spec: 0001-ergonex FR-022
/**
 * What the commands of `ergonex` share in their declarations (commons 0001-ergonex FR-022; commons headless 0002-headless-governance, 0005-reach-and-targets): the one option of its own that every command takes (`--home`), and the three ways a
 * command is an action with its reach policy: a report that only reads, a change that can be undone or repeated, and a destruction that must be previewed and confirmed. The options every command takes by its effect (`--json`, `--sarif`,
 * `--quiet`, `--verbose`, `--no-color`, `--non-interactive`, `--dry-run`, `--check`, `--yes`) are Headless' and are not declared here.
 *
 * @example
 * ```ts
 * import { reads } from "./options.ts";
 * reads().reach?.readOnly; // true
 * ```
 *
 * @module
 */
import { defineReach } from "@intellectual-frontiers/headless/governance";
import type { ActionTraits } from "@intellectual-frontiers/headless/logical";
import { value } from "../platform/k-args.ts";

/** The option every command takes: the root of the workspace for the run. */
export const HOME = {
  home: value({
    help: "The root of the workspace for this run (else $ERGONEX_HOME, else $HOME/workspaces).",
    valueName: "DIR",
  }),
};

/** A report: it only reads and is safe to repeat, so a tool server may call it as well as a person. */
export function reads(): ActionTraits {
  return { kind: "report", reach: defineReach({ channels: ["local", "mcp"], readOnly: true, idempotent: true }) };
}

/** A report that needs the terminal it is run in (a Git hook reads the working folder and the standard input), so that only the local channel reaches it. */
export function readsHere(): ActionTraits {
  return { kind: "report", reach: defineReach({ channels: ["local"], readOnly: true, idempotent: true }) };
}

/** A change: it writes something that can be repaired by running it again or by hand. `idempotent` says whether running it again with the same input changes nothing more; `dryRun` and `check` say that it can preview or check. */
export function changes(f: { readonly idempotent: boolean; readonly dryRun?: boolean; readonly check?: boolean }): ActionTraits {
  return {
    kind: "action",
    effect: "mutate",
    idempotent: f.idempotent,
    dryRun: f.dryRun ?? false,
    check: f.check ?? false,
    reach: defineReach({ channels: ["local"], idempotent: f.idempotent }),
  };
}

/** A destruction: it removes what cannot be had again, so it can preview itself (`--dry-run`) and is confirmed by the person or by `--yes`. */
export function destroys(): ActionTraits {
  return {
    kind: "action",
    effect: "destructive",
    idempotent: false,
    dryRun: true,
    reach: defineReach({ channels: ["local"], idempotent: false, confirmation: "flag" }),
  };
}
