/**
 * The harness's declaration, read for the judgements that depend on it (commons 0021-ifqs FR-011 and FR-046): the grade a requirement needs to be
 * counted proved and the floor of a proof's strength both rise for a harness that declares a regulated domain and production. The file is the one
 * `mizan/changes.ts` reads (`ifccm.declaration.ts`, data and never run, 0020-ifccm FR-010); it is read here once and handed to the pure functions
 * as an argument.
 *
 * @module
 */
import { err, ok, type Result } from "../../kernel/result.ts";
import { type Declaration, decodeHarnessRecord, formatRecordError } from "../../mizan/changes/declaration.ts";
import { exists, readTextFile } from "../../runtime/fs.ts";
import { join, resolve } from "../../runtime/path.ts";

/** The file of a harness's record, in the root of its repository (0020-ifccm FR-010). */
export const DECLARATION_FILE = "ifccm.declaration.ts";

/**
 * The declaration of the harness whose repository is `repo`: the one in `file` where given (a file that is not there is an error), else in
 * `ifccm.declaration.ts` of the repository, and none where the repository has no such file or its file declares nothing.
 */
export async function readDeclaration(repo: string, file?: string): Promise<Result<Declaration | undefined, string>> {
  const path = file === undefined ? join(repo, DECLARATION_FILE) : resolve(repo, file);
  if (!(await exists(path))) return file === undefined ? ok(undefined) : err(`${path} does not exist`);
  const record = decodeHarnessRecord(await readTextFile(path));
  if (record.kind === "err") return err(`${path}: ${formatRecordError(record.error)}`);
  return ok(record.value.declaration);
}
