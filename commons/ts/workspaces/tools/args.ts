/**
 * The arguments of `ifws tools` (commons 0025-ifws FR-018, 0023-if-workspaces FR-038 to FR-040), read once into a sum type: `list` shows the catalog and what is installed, `verify` checks each
 * installed tool against its install record and the probes of `git`, `bun` and `node`, and `export <oscal|spdx|cyclonedx>` writes the catalog or the inventory in the form an assessor reads.
 * `ifws tools` never installs (only `ifws setup --apply` does), so no argument names an install.
 *
 * @module
 */
import { err, ok, type Result } from "../../kernel/result.ts";
import { type ExportFormat, EXPORT_FORMATS, exportFormatOf } from "./inventory.ts";

/** What `ifws tools` was asked. */
export type ToolsArgs =
  { readonly command: "list" } | { readonly command: "verify" } | { readonly command: "export"; readonly format: ExportFormat };

/** A usage error: what is wrong and the way to say it right (exit status `Usage`). */
export type UsageError = { readonly kind: "usage"; readonly message: string };

const USAGE = `usage: ifws tools [list | verify | export <${EXPORT_FORMATS.join("|")}>]`;

/** The arguments after `ifws tools`: none means `list`. */
export function parseToolsArgs(argv: readonly string[]): Result<ToolsArgs, UsageError> {
  const [command, ...rest] = argv;
  if (command === undefined || command === "list")
    return rest.length === 0 ? ok({ command: "list" }) : err({ kind: "usage", message: `ifws tools list takes no argument; ${USAGE}` });
  if (command === "verify")
    return rest.length === 0 ? ok({ command: "verify" }) : err({ kind: "usage", message: `ifws tools verify takes no argument; ${USAGE}` });
  if (command === "export") {
    const [name, ...more] = rest;
    const format = name === undefined ? undefined : exportFormatOf(name);
    if (format === undefined || more.length > 0) return err({ kind: "usage", message: `ifws tools export names one form: ${USAGE}` });
    return ok({ command: "export", format });
  }
  if (command === "install" || command === "update" || command === "add")
    return err({
      kind: "usage",
      message: `ifws tools does not install anything; only \`ifws setup --apply\` installs the pinned tools of the catalog`,
    });
  return err({ kind: "usage", message: `${JSON.stringify(command)} is not a command of ifws tools; ${USAGE}` });
}
