/**
 * The command line wired to a process: a project module ends with `await main(project)`, and the words after the program's name are
 * the command (commons 0009-sql-aide FR-046).
 *
 * @example
 * ```ts
 * import { main } from "./sql-aide/runtime/cli.ts";
 * await main({ name: "arca", entities: partyModel, docs: [partyDocs] });
 * ```
 *
 * @module
 */
import { fs, proc } from "../../../runtime/mod.ts";
import { cli, type Project } from "../cli/cli.ts";

/**
 * Runs the command line for a project with the process's words, writing to its standard output and error, and sets its exit status.
 *
 * @param project - the project
 */
export async function main(project: Project): Promise<void> {
  const status = await cli(project, proc.args, {
    out: (t) => process.stdout.write(t),
    err: (t) => process.stderr.write(t),
    read: (path) => fs.readTextOr(path),
    write: (path, text) => fs.writeTextFile(path, text),
  });
  process.exitCode = status;
}
