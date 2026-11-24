// Spec: 0001-docs FR-049
/**
 * The evidence of a library whose tests were run in shards, put together again (docs 0001-docs FR-049): each cell of the night's run keeps `<library>.shard-K-of-N.ctrf.json` (its tests as CTRF), `<library>.shard-K-of-N.lcov.json` (the
 * lines its tests reached, each with its hits) and `status-<slug>.json`, and `mergeCtrf`, `mergeLines` and `mergeStatus` make of them the files one run of the whole suite would have kept: the tests of every shard in one CTRF
 * document with the sums of its summary, the line coverage of the files with the hits added, and one status. Pure: nothing here reads a file.
 *
 * @module
 */
import type { FileCoverage } from "./coverage.ts";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** The place of a shard file: the library and `k` of `n`, and which of its files it is. */
export type ShardFile = { readonly library: string; readonly k: number; readonly n: number; readonly kind: "ctrf" | "lcov" };

/** The shard a file name says it is of (`data.shard-2-of-4.ctrf.json`), or undefined for any other name. */
export function parseShardFile(name: string): ShardFile | undefined {
  const m = /^(.+)\.shard-([1-9][0-9]*)-of-([1-9][0-9]*)\.(ctrf|lcov)\.json$/.exec(name);
  if (m === null) return undefined;
  const k = Number(m[2]);
  const n = Number(m[3]);
  return k <= n ? { library: m[1] ?? "", k, n, kind: m[4] === "lcov" ? "lcov" : "ctrf" } : undefined;
}

/** The tests of some CTRF documents, in one document: the tests in order of file and name, the counts of the summary added, the start the first and the stop the last. A document that is not CTRF is left out and counted in `skipped`. */
export function mergeCtrf(texts: readonly string[]): { readonly text: string; readonly merged: number; readonly skipped: number } {
  const tests: unknown[] = [];
  let start = Number.POSITIVE_INFINITY;
  let stop = 0;
  const sums = { passed: 0, failed: 0, skipped: 0, pending: 0, other: 0, notRun: 0, cancelled: 0, todo: 0 };
  const unproven = new Set<string>();
  const failures: string[] = [];
  let tool: unknown;
  let osPlatform: unknown;
  let commit: unknown;
  let merged = 0;
  let skipped = 0;
  for (const text of texts) {
    let j: unknown;
    try {
      j = JSON.parse(text);
    } catch {
      skipped++;
      continue;
    }
    const results = isRecord(j) ? j["results"] : undefined;
    const t = isRecord(results) ? results["tests"] : undefined;
    if (!isRecord(results) || !Array.isArray(t)) {
      skipped++;
      continue;
    }
    merged++;
    tests.push(...t);
    const s = isRecord(results["summary"]) ? results["summary"] : {};
    for (const key of ["passed", "failed", "skipped", "pending", "other"] as const) sums[key] += num(s[key]);
    if (typeof s["start"] === "number") start = Math.min(start, s["start"]);
    if (typeof s["stop"] === "number") stop = Math.max(stop, s["stop"]);
    const extra = isRecord(results["extra"]) ? results["extra"] : {};
    for (const key of ["notRun", "cancelled", "todo"] as const) sums[key] += num(extra[key]);
    if (Array.isArray(extra["unproven"])) for (const u of extra["unproven"]) if (typeof u === "string") unproven.add(u);
    if (Array.isArray(extra["failures"])) for (const f of extra["failures"]) if (typeof f === "string") failures.push(f);
    tool ??= results["tool"];
    const env = isRecord(results["environment"]) ? results["environment"] : {};
    osPlatform ??= env["osPlatform"];
    commit ??= env["commit"];
  }
  const key = (x: unknown): string => (isRecord(x) ? `${String(x["filePath"] ?? "")}\u0000${String(x["name"] ?? "")}` : "");
  tests.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  const doc = {
    reportFormat: "CTRF",
    specVersion: "0.0.0",
    results: {
      tool: tool ?? { name: "ifc quality" },
      summary: {
        tests: tests.length,
        passed: sums.passed,
        failed: sums.failed,
        skipped: sums.skipped,
        pending: sums.pending,
        other: sums.other,
        start: Number.isFinite(start) ? start : 0,
        stop,
      },
      tests,
      environment: { ...(osPlatform === undefined ? {} : { osPlatform }), ...(commit === undefined ? {} : { commit }) },
      extra: { notRun: sums.notRun, cancelled: sums.cancelled, todo: sums.todo, unproven: [...unproven].sort(), failures, shards: merged },
    },
  };
  return { text: `${JSON.stringify(doc, null, 2)}\n`, merged, skipped };
}

/** The lines of a source file with their hits, as one shard kept them. */
export type FileLines = { readonly path: string; readonly lines: Readonly<Record<string, number>> };

/** The lines of an LCOV text, file by file, with `DA:` hits: `base` is what its `SF:` paths are relative to, and `keep` says which paths are source files. */
export function linesOfLcov(lcov: string, base: string, keep: (path: string) => boolean): readonly FileLines[] {
  const files: FileLines[] = [];
  let sf: string | undefined;
  let lines: Record<string, number> = {};
  for (const line of lcov.split("\n")) {
    if (line.startsWith("SF:")) {
      sf = line.slice(3).trim();
      lines = {};
    } else if (line.startsWith("DA:")) {
      const [n, hits] = line.slice(3).split(",");
      if (n !== undefined && hits !== undefined) lines[n] = (lines[n] ?? 0) + (Number(hits) || 0);
    } else if (line.startsWith("end_of_record") && sf !== undefined) {
      const parts: string[] = [];
      for (const seg of `${base}/${sf}`.split("/")) {
        if (seg === "..") parts.pop();
        else if (seg !== "" && seg !== ".") parts.push(seg);
      }
      const p = parts.join("/");
      if (keep(p) && Object.keys(lines).length > 0) files.push({ path: p, lines });
      sf = undefined;
    }
  }
  return files;
}

/** The coverage of a library from the lines of its shards: a line is found once however many shards ran it, and hit where any shard reached it. */
export function mergeLines(shards: readonly (readonly FileLines[])[]): readonly FileCoverage[] {
  const byPath = new Map<string, Map<string, number>>();
  for (const files of shards)
    for (const f of files) {
      const into = byPath.get(f.path) ?? new Map<string, number>();
      for (const [line, hits] of Object.entries(f.lines)) into.set(line, (into.get(line) ?? 0) + hits);
      byPath.set(f.path, into);
    }
  return [...byPath.entries()]
    .map(([path, lines]) => ({ path, found: lines.size, hit: [...lines.values()].filter((h) => h > 0).length }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** What a cell says of its run: the outcome of each step, and the shard it was of. */
export type CellStatus = { readonly library: string; readonly install: string; readonly runner: string; readonly tests: string; readonly reported: boolean; readonly shard?: string };

/** One status for a library from the statuses of its cells: a step succeeded where every cell's did, and otherwise is the first outcome that was not `success`; the tests were reported where every cell reported them. */
export function mergeStatus(library: string, cells: readonly CellStatus[], expected: number): CellStatus {
  const step = (pick: (c: CellStatus) => string): string => {
    if (cells.length < expected) return "missing";
    return cells.map(pick).find((o) => o !== "success") ?? "success";
  };
  return { library, install: step((c) => c.install), runner: step((c) => c.runner), tests: step((c) => c.tests), reported: cells.length >= expected && cells.every((c) => c.reported) };
}
