/**
 * `verify.ts`, the command of the offline verifier (commons 0022-trust FR-014, FR-016): reads a pack's folder and runs `verifyPack` on it,
 * with no network and no account. It is in the pack, beside `verify-pack.ts`, so that a pack checks itself:
 *
 * ```sh
 * bun verify/verify.ts            # the pack that holds this file
 * node verify/verify.ts ./pack    # a pack at another place (Node 26)
 * ```
 *
 * Exit status: 0 where the pack is verified, 1 where a check failed, 3 where part of the pack could not be checked and so it is not
 * reported verified, 2 where the command line does not fit.
 *
 * @module
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { argv, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { type PackFiles, showReport, verifyPack } from "./verify-pack.ts";

/** The files of a folder, by path with `/` under it. */
export async function readPack(root: string): Promise<PackFiles> {
  const out = new Map<string, Uint8Array>();
  const walk = async (dir: string, prefix: string): Promise<void> => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const path = prefix === "" ? e.name : `${prefix}/${e.name}`;
      if (e.isDirectory()) await walk(join(dir, e.name), path);
      else out.set(path, new Uint8Array(await readFile(join(dir, e.name))));
    }
  };
  await walk(root, "");
  return out;
}

if (import.meta.main) {
  const given = argv[2];
  if (argv.length > 3 || given === "--help") {
    stderr.write("usage: verify.ts [PACK-FOLDER]\n");
    exit(2);
  }
  const root = resolve(given ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
  const report = await verifyPack(await readPack(root));
  stdout.write(showReport(report));
  exit(report.verified ? 0 : report.checks.some((c) => c.status === "fail") ? 1 : 3);
}
