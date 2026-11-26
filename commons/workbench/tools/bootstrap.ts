// Spec: 0007-workbench-operate FR-011
/**
 * Writes the public bootstrap scripts of the commons, `bin/bootstrap.sh` and `bin/bootstrap.ps1`, from the renderers of this library (0007-workbench-operate FR-010): they are generated and never edited. The test of the library fails
 * where the files are not what this writes.
 *
 * ```sh
 * bun tools/bootstrap.ts        write the two files
 * ```
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { bootstrapPs1, bootstrapSh } from "@intellectual-frontiers/workbench/logical";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "../../..");

/** The two files, by path from the root of the commons. */
export const BOOTSTRAP_FILES: ReadonlyMap<string, string> = new Map([
  ["bin/bootstrap.sh", bootstrapSh()],
  ["bin/bootstrap.ps1", bootstrapPs1()],
]);

if (import.meta.main) {
  for (const [p, t] of BOOTSTRAP_FILES) {
    await fs.writeTextFile(path.join(ROOT, p), t);
    console.log(`wrote ${p}`);
  }
}
