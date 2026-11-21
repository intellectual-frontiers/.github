// Spec: 0002-objective-evidence FR-007
/**
 * The store of records on disk (0002-objective-evidence FR-007): the records of a folder read in the order of their paths, with a problem for each file that is not a valid record, and a record written to its place without replacing one that is there (evidence is added, never changed).
 *
 * @example
 * ```ts
 * import { readStore } from "./store.ts";
 * (await readStore("/nonexistent")).records.length; // 0
 * ```
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import type { Evidence } from "@intellectual-frontiers/assessment/governance";
import { decodeRecord, encodeRecord, recordPath } from "@intellectual-frontiers/assessment/logical";

/** What a folder holds: its valid records and what is wrong with the files that are not. */
export type Store = { readonly records: readonly Evidence[]; readonly problems: readonly string[] };

async function* files(dir: string): AsyncIterable<string> {
  if (!(await fs.exists(dir))) return;
  const entries: { name: string; isDirectory: boolean }[] = [];
  for await (const e of fs.readDir(dir)) entries.push({ name: e.name, isDirectory: e.isDirectory });
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory) yield* files(full);
    else if (e.name.endsWith(".json5")) yield full;
  }
}

/** The records under a folder. */
export async function readStore(dir: string): Promise<Store> {
  const records: Evidence[] = [];
  const problems: string[] = [];
  for await (const file of files(dir)) {
    const r = decodeRecord(await fs.readTextFile(file));
    if (r.kind === "ok") records.push(r.value);
    else problems.push(`${path.relative(dir, file)}: ${r.error}`);
  }
  return { records, problems };
}

/** Writes a record to its place under a folder; where a file is there already it refuses, naming the path. */
export async function addRecord(dir: string, e: Evidence): Promise<{ readonly kind: "ok"; readonly path: string } | { readonly kind: "err"; readonly error: string }> {
  const target = path.join(dir, recordPath(e));
  if (await fs.exists(target)) return { kind: "err", error: `${recordPath(e)} is there already: evidence is added, never changed` };
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeTextFile(target, encodeRecord(e));
  return { kind: "ok", path: target };
}
