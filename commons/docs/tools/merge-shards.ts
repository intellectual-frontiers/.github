// Spec: 0001-docs FR-049
/**
 * Puts the evidence of the shards of a library together again (docs 0001-docs FR-049): `bun tools/merge-shards.ts --evidence DIR` reads every `<library>.shard-K-of-N.ctrf.json`, `<library>.shard-K-of-N.lcov.json`
 * and `status-<slug>.json` that the cells of the night's run left in DIR, writes `<library>.ctrf.json`, `<library>.coverage.json` and `status-<library>.json` as one run of the whole suite would have kept them,
 * and removes the shard files. Where a shard is missing the library's report is of the shards there are, and its status says `missing`, so that the page shows a library with a part of its tests as it is. Never fails: what it cannot do is said.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { type CellStatus, type FileLines, mergeCtrf, mergeLines, mergeStatus, parseShardFile } from "../src/shards.ts";

const args = proc.args;
const flagAt = args.indexOf("--evidence");
const dir = path.resolve(flagAt < 0 ? "_evidence" : (args[flagAt + 1] ?? "_evidence"));
if (!fs.existsSync(dir)) {
  console.log(`merge-shards: no ${dir}`);
  proc.exit(0);
}
const names = [...fs.readDirSync(dir)].filter((e) => e.isFile).map((e) => e.name);
const libraries = new Map<string, { ctrf: string[]; lcov: string[]; n: number }>();
for (const name of names) {
  const s = parseShardFile(name);
  if (s === undefined) continue;
  const of = libraries.get(s.library) ?? { ctrf: [], lcov: [], n: s.n };
  of[s.kind].push(name);
  of.n = s.n;
  libraries.set(s.library, of);
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
for (const [library, of] of libraries) {
  const texts = of.ctrf.sort().map((n) => fs.readTextFileSync(path.join(dir, n)));
  const merged = mergeCtrf(texts);
  await fs.writeTextFile(path.join(dir, `${library}.ctrf.json`), merged.text);
  const shards: FileLines[][] = [];
  for (const n of of.lcov.sort()) {
    try {
      const j: unknown = JSON.parse(fs.readTextFileSync(path.join(dir, n)));
      if (isRecord(j) && Array.isArray(j["files"])) shards.push(j["files"] as FileLines[]);
    } catch {
      console.error(`merge-shards: ${n} is not JSON`);
    }
  }
  if (shards.length > 0) await fs.writeTextFile(path.join(dir, `${library}.coverage.json`), `${JSON.stringify({ library, files: mergeLines(shards) }, null, 1)}\n`);
  const cells: CellStatus[] = [];
  for (const n of names) {
    if (!n.startsWith("status-") || !n.endsWith(".json")) continue;
    try {
      const j: unknown = JSON.parse(fs.readTextFileSync(path.join(dir, n)));
      if (isRecord(j) && j["library"] === library && typeof j["shard"] === "string" && j["shard"] !== "") {
        cells.push({ library, install: String(j["install"] ?? ""), runner: String(j["runner"] ?? ""), tests: String(j["tests"] ?? ""), reported: j["reported"] === true, shard: j["shard"] });
        await fs.remove(path.join(dir, n));
      }
    } catch {
      // a status that cannot be read is no cell of this library
    }
  }
  const status = mergeStatus(library, cells, of.n);
  await fs.writeTextFile(path.join(dir, `status-${library}.json`), `${JSON.stringify(status)}\n`);
  for (const n of [...of.ctrf, ...of.lcov]) await fs.remove(path.join(dir, n));
  console.log(`merge-shards: ${library}: ${merged.merged} of ${of.n} shards, ${merged.skipped} unreadable, coverage from ${shards.length}`);
}
