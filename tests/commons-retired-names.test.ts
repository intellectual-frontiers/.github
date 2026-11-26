/**
 * A retired name stays retired: the old name of the library family now called `desired-os-state` appears in no tracked file of the repository (the owner's decision: no alias, no legacy).
 * It runs the real `git ls-files` on this checkout; where the folder is not a Git checkout the test has nothing to list and passes.
 *
 * @module
 */
import { fs, path, proc } from "../commons/system/src/mod.ts";
import { assert, proves } from "../commons/test/src/test.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
/** The retired word, written in two parts so that this file does not hold it. */
const WORD = ["arc", "hon"].join("");
const RETIRED = new RegExp(WORD, "i");
const R = ["0034-desired-os-state FR-001"] as const;

proves(R, "the retired name of desired-os-state appears in no tracked file, in its path or in its text, outside the lockfiles", async () => {
  const tracked = await proc.run(["git", "ls-files", "-z"], { cwd: ROOT });
  if (tracked.code !== 0) return;
  const hits: string[] = [];
  for (const file of tracked.stdout.split("\0").filter((f) => f !== "" && !/(^|\/)(bun\.lock|bun\.lockb|package-lock\.json)$/.test(f))) {
    if (RETIRED.test(file)) hits.push(`${file} (path)`);
    const bytes = await fs.readFile(path.join(ROOT, file)).catch(() => undefined);
    if (bytes === undefined || bytes.includes(0)) continue;
    if (RETIRED.test(new TextDecoder().decode(bytes))) hits.push(file);
  }
  assert(hits.length === 0, `the name ${WORD} is retired and must not come back (it is now desired-os-state): ${hits.join(", ")}`);
});
