// Spec: 0004-onboarding FR-008
/**
 * The installers, written from the pins (commons ergonex 0004-onboarding FR-008):
 *
 *     bun tools/generate-installers.ts            write install/ergonex-install.auto.sh and install/ergonex-install.auto.ps1
 *     bun tools/generate-installers.ts --check    write nothing and exit 1 where a file is not what the generator makes
 *
 * @module
 */
import process from "node:process";
import { fs, path } from "@intellectual-frontiers/commons/ts/runtime";
import { installerPs1, installerSh, withBom } from "../src/install/scripts.ts";
import { ERGONEX_VERSION } from "../src/state-record.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

/** The files the generator makes, by their path from the library's folder. */
export function outputs(): ReadonlyMap<string, Uint8Array> {
  return new Map([
    ["install/ergonex-install.auto.sh", new TextEncoder().encode(installerSh(ERGONEX_VERSION))],
    ["install/ergonex-install.auto.ps1", withBom(installerPs1(ERGONEX_VERSION))],
  ]);
}

const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** Writes the files, or with `check` only compares them; the paths that are not what the generator makes. */
export async function synchronize(root: string, check: boolean): Promise<readonly string[]> {
  const stale: string[] = [];
  for (const [file, bytes] of outputs()) {
    const at = path.join(root, file);
    const now = (await fs.exists(at)) ? await fs.readFile(at) : undefined;
    // a Windows checkout of the shell script has CR LF; the generator's own line ends are what is compared
    const norm = (b: Uint8Array): Uint8Array =>
      file.endsWith(".sh") ? new TextEncoder().encode(new TextDecoder().decode(b).replace(/\r\n/g, "\n")) : b;
    if (now !== undefined && same(norm(now), bytes)) continue;
    stale.push(file);
    if (!check) {
      await fs.mkdir(path.dirname(at), { recursive: true });
      await fs.writeFile(at, bytes);
    }
  }
  return stale;
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const stale = await synchronize(ROOT, check);
  for (const f of stale) console.log(check ? `${f} is not what the generator makes; run: bun tools/generate-installers.ts` : `wrote ${f}`);
  process.exit(check && stale.length > 0 ? 1 : 0);
}
