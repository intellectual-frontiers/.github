// Spec: 0002-csf2-package FR-003
/**
 * Makes the package from NIST's source file (0002-csf2-package FR-003). It refuses a source whose SHA-256 is not the pinned one.
 *
 * ```sh
 * bun tools/generate.ts --source csf.json           write data/
 * bun tools/generate.ts --source csf.json --check   write nothing; exit 1 where data/ differs
 * ```
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { SOURCE } from "../src/governance/source.ts";
import { digestOf, makePackage, PACKAGE_DIR } from "../src/physical/package.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--source");
const file = at < 0 ? undefined : args[at + 1];
if (file === undefined) {
  console.error("usage: bun tools/generate.ts --source <csf_2_0_0.json> [--check]");
  process.exit(2);
}
const bytes = await fs.readFile(file);
const digest = await digestOf(bytes);
if (digest !== SOURCE.sha256) {
  console.error(`refused: the SHA-256 of ${file} is ${digest}, and the package pins ${SOURCE.sha256}`);
  process.exit(1);
}
const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { response: { elements: { elements: never[]; relationships: never[] } } };
const files = await makePackage(parsed.response.elements);
const check = args.includes("--check");
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
