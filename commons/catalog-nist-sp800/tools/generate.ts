// Spec: 0002-sp800-package FR-003
/**
 * Makes the package from NIST's OSCAL catalogs (0002-sp800-package FR-003). It refuses a source file whose SHA-256 is not the pinned one.
 *
 * ```sh
 * bun tools/generate.ts --source-dir <checkout of usnistgov/oscal-content>           write data/
 * bun tools/generate.ts --source-dir <checkout of usnistgov/oscal-content> --check   write nothing; exit 1 where data/ differs
 * ```
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { SOURCES } from "../src/governance/source.ts";
import type { Catalog } from "../src/logical/convert.ts";
import { digestOf, makePackage, PACKAGE_DIR } from "../src/physical/package.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--source-dir");
const dir = at < 0 ? undefined : args[at + 1];
if (dir === undefined) {
  console.error("usage: bun tools/generate.ts --source-dir <usnistgov/oscal-content checkout> [--check]");
  process.exit(2);
}
const catalogs: Partial<Record<"800-53" | "800-171", Catalog>> = {};
for (const s of SOURCES) {
  const bytes = await fs.readFile(path.join(dir, s.path));
  const digest = await digestOf(bytes);
  if (digest !== s.sha256) {
    console.error(`refused: the SHA-256 of ${s.path} is ${digest}, and the package pins ${s.sha256}`);
    process.exit(1);
  }
  catalogs[s.id] = JSON.parse(new TextDecoder().decode(bytes)) as Catalog;
}
const files = await makePackage(catalogs as Record<"800-53" | "800-171", Catalog>);
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
