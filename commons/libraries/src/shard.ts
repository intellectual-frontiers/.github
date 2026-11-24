// Spec: 0001-libraries FR-034
/**
 * The tests of a library split among the cells of CI (commons 0001-libraries FR-034): a library whose record in `LIBRARY_CI` names `shards: N` runs in N cells, and the cell `k/N` runs the test files
 * of the folder that `shardOf` gives it, so that each file is run by exactly one cell and no cell is left with all the long ones.
 *
 *     bun shard.ts --first COMMAND...  runs COMMAND in the first shard only (and where IFC_SHARD is empty), for what one cell of the library's cells has to do once: a check of the whole site, the packing
 *     bun shard.ts [--node] DIR      runs the tests of DIR with `bun test`, or with `node --test` where `--node` is given: all the files where IFC_SHARD is empty, and the files of the shard `k/N` where it names one
 *
 * @module
 */
import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

/** A test file with its size, which is what the files are balanced by. */
export type TestFile = { readonly path: string; readonly bytes: number };

/** A shard: its place `k`, from 1, among `n`. */
export type Shard = { readonly k: number; readonly n: number };

/** The shard that `text` (`k/N`) names, or undefined where it names none. */
export function parseShard(text: string | undefined): Shard | undefined {
  const m = /^([1-9][0-9]*)\/([1-9][0-9]*)$/.exec(text ?? "");
  if (m === null) return undefined;
  const k = Number(m[1]);
  const n = Number(m[2]);
  return k <= n ? { k, n } : undefined;
}

/**
 * The files of shard `k` of `n`: the files in order of size, the largest first (and by path for equal sizes), each given to the shard that holds the fewest bytes so far, the lowest numbered of equals.
 * The same files give the same shards in every cell, and each file is in exactly one of the `n` shards.
 */
export function shardOf(files: readonly TestFile[], shard: Shard): readonly string[] {
  const sorted = [...files].sort((a, b) => b.bytes - a.bytes || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const load = Array.from({ length: shard.n }, () => 0);
  const mine: string[] = [];
  for (const f of sorted) {
    let at = 0;
    for (let i = 1; i < shard.n; i++) if ((load[i] ?? 0) < (load[at] ?? 0)) at = i;
    load[at] = (load[at] ?? 0) + Math.max(f.bytes, 1);
    if (at === shard.k - 1) mine.push(f.path);
  }
  return mine.sort();
}

/** The `*.test.ts` files under `dir`, with their sizes. */
export function testFilesUnder(dir: string): readonly TestFile[] {
  const out: TestFile[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".test.ts")) out.push({ path: p, bytes: statSync(p).size });
    }
  };
  walk(dir);
  return out;
}

/** Whether the cell of this shard does what is done once for the library: the first, and the one of a library that is not split. */
export const doesOnce = (shard: Shard | undefined): boolean => shard === undefined || shard.k === 1;

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args[0] === "--first") {
    if (!doesOnce(parseShard(process.env["IFC_SHARD"]))) process.exit(0);
    const [program, ...rest] = args.slice(1);
    const r = spawnSync(program ?? "true", rest, { stdio: "inherit", shell: false });
    process.exit(r.status ?? 1);
  }
  const node = args.includes("--node");
  const dir = args.find((a) => !a.startsWith("--")) ?? "suite";
  const shard = parseShard(process.env["IFC_SHARD"]);
  const files = shard === undefined ? undefined : shardOf(testFilesUnder(dir), shard);
  if (files !== undefined && files.length === 0) process.exit(0);
  const argv = node ? ["node", "--test", ...(files ?? [`${dir}/**/*.test.ts`])] : ["bun", "test", ...(files ?? [`${dir}/`])];
  const r = spawnSync(argv[0] ?? "bun", argv.slice(1), { stdio: "inherit", shell: false });
  process.exit(r.status ?? 1);
}
