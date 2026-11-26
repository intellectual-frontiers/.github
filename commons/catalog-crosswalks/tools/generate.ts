// Spec: 0002-crosswalks FR-003
/**
 * Makes the package from the proposals in `src/governance/` (0002-crosswalks FR-003), recording the SHA-256 of each source file.
 *
 * ```sh
 * bun tools/generate.ts           write data/
 * bun tools/generate.ts --check   write nothing; exit 1 where data/ differs
 * ```
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { SOURCE_FILES } from "../src/governance/source.ts";
import { digestOf, makePackage, PACKAGE_DIR } from "../src/physical/package.ts";

const root = path.resolve(PACKAGE_DIR, "..");
const digests: Record<string, string> = {};
for (const file of SOURCE_FILES) digests[file] = await digestOf(await fs.readFile(path.join(root, file)));
const files = await makePackage(digests);
const check = process.argv.slice(2).includes("--check");
let differs = 0;
for (const [name, text] of files) {
  const target = path.join(PACKAGE_DIR, name);
  const have = (await fs.exists(target)) ? await fs.readTextFile(target) : undefined;
  if (have === text) continue;
  differs++;
  if (check) console.error(`differs: data/${name}`);
  else {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeTextFile(target, text);
    console.log(`wrote data/${name}`);
  }
}
process.exit(check && differs > 0 ? 1 : 0);
