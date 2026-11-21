// Spec: 0002-sp800-package FR-003
// Spec: 0003-sp800-171-r2 FR-002
/**
 * Makes the package from NIST's OSCAL catalogs (0002-sp800-package FR-003). It refuses a source file whose SHA-256 is not the pinned one.
 *
 * ```sh
 * bun tools/generate.ts --source-dir <checkout of usnistgov/oscal-content> --pdf-dir <folder with NIST.SP.800-171r2.pdf and NIST.SP.800-171A.pdf>   write data/ (pdftotext is needed)
 * bun tools/generate.ts --source-dir <checkout of usnistgov/oscal-content> --check   write nothing; exit 1 where data/ differs
 * ```
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { PRINTED_SOURCES, SOURCES } from "../src/governance/source.ts";
import type { Catalog } from "../src/logical/convert.ts";
import { digestOf, makePackage, PACKAGE_DIR } from "../src/physical/package.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--source-dir");
const dir = at < 0 ? undefined : args[at + 1];
if (dir === undefined) {
  console.error("usage: bun tools/generate.ts --source-dir <usnistgov/oscal-content checkout> --pdf-dir <folder of the two PDFs> [--check]");
  process.exit(2);
}
const pdfAt = args.indexOf("--pdf-dir");
const pdfDir = pdfAt < 0 ? undefined : args[pdfAt + 1];
if (pdfDir === undefined) {
  console.error("usage: bun tools/generate.ts --source-dir <usnistgov/oscal-content checkout> --pdf-dir <folder with the two printed publications of Revision 2> [--check]");
  process.exit(2);
}
/** Every pinned file is read and its SHA-256 compared before anything is made; a missing file is a refusal too. */
const refusals: string[] = [];
const bytesOf = async (file: string, pinned: string): Promise<Uint8Array | undefined> => {
  const bytes = (await fs.exists(file)) ? await fs.readFile(file) : undefined;
  const digest = bytes === undefined ? "missing" : await digestOf(bytes);
  if (digest === pinned) return bytes;
  refusals.push(`refused: the SHA-256 of ${file} is ${digest}, and the package pins ${pinned}`);
  return undefined;
};
const catalogs: Partial<Record<"800-53" | "800-171", Catalog>> = {};
for (const s of SOURCES) {
  const bytes = await bytesOf(path.join(dir, s.path), s.sha256);
  if (bytes !== undefined) catalogs[s.id] = JSON.parse(new TextDecoder().decode(bytes)) as Catalog;
}
const printed: Partial<Record<"800-171r2" | "800-171a", string>> = {};
for (const s of PRINTED_SOURCES) {
  const file = path.join(pdfDir, s.url.slice(s.url.lastIndexOf("/") + 1));
  if ((await bytesOf(file, s.sha256)) === undefined) continue;
  const made = await proc.run(["pdftotext", "-raw", file, "-"], {});
  if (!made.success) {
    console.error(`pdftotext failed on ${file}: ${made.stderr}`);
    process.exit(3);
  }
  printed[s.id] = made.stdout;
}
if (refusals.length > 0) {
  for (const r of refusals) console.error(r);
  process.exit(1);
}
const files = await makePackage(catalogs as Record<"800-53" | "800-171", Catalog>, printed as Record<"800-171r2" | "800-171a", string>);
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
