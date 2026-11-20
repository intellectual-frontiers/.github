// Spec: 0001-kanon-checker FR-007
/**
 * The host side of the check of Kanon (commons 0033-kanon FR-012, FR-014): it reads a library's manifest for its table, the `exports` of its package and its `.ts` files, and gives the findings of the
 * import check over them, judged against a baseline of findings that only shrinks. The pure check is `importFindings`; this is the only module of the package that reads files.
 *
 * @remarks
 * Effects are at the edge and behind a port: every function here takes `Files`, a typed record of the four functions it reads with, and `systemFiles` is the real one; a failure the host can cause (a
 * missing file, a package that is not JSON) is a `Result`, never a throw. Every `.ts` file under the library's root is read but `node_modules`, `dist` and the spec kit's folder, so that a file that
 * no unit of the table holds is found (`layers/unclassified`).
 *
 * @limits
 * It reads the manifest as data (`exportedLiteral`), never runs it.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { exportedLiteral } from "@intellectual-frontiers/formats/ts-literal";
import { existsSync, readDirSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { type Finding, importFindings, type SourceFile } from "./imports.ts";
import { decodeTable, type Table } from "./table.ts";

/** The name of a library's manifest in its folder. */
export const MANIFEST = "library.ts";
/** The name of the baseline of findings a library holds, in its folder. */
export const BASELINE = "kanon.baseline.txt";

/** What the host reads with: a port, a record of functions, so that a test or another host may give its own. */
export type Files = {
  readonly exists: (path: string) => boolean;
  readonly readDir: (path: string) => readonly { readonly name: string; readonly isDirectory: boolean }[];
  readonly readText: (path: string) => string;
};

/** The real file system. */
export const systemFiles: Files = {
  exists: (path) => existsSync(path),
  readDir: (path) => readDirSync(path).map((e) => ({ name: e.name, isDirectory: e.isDirectory })),
  readText: (path) => readTextFileSync(path),
};

/** An `exports` map: each subpath to its target, a string or an object of conditions of strings. */
export type Exports = Readonly<Record<string, string | { readonly [condition: string]: string }>>;

/** The folders that are not read. */
const SKIPPED: ReadonlySet<string> = new Set(["node_modules", "dist", "spec-kit", ".git"]);

/** Run a read that may fail on the host, as a `Result`. */
function attempt<T>(what: string, read: () => T): Result<T, string> {
  try {
    return ok(read());
  } catch (e) {
    return err(`${what}: ${e instanceof Error ? e.message : "it could not be read"}`);
  }
}

/** The table of the library at `root`, from the field `kanon` of its manifest; an error as a sentence where there is none or it is not a table. */
export function readTable(root: string, files: Files = systemFiles): Result<Table, string> {
  const file = `${root}/${MANIFEST}`;
  if (!files.exists(file)) return err(`${file} is not there`);
  const text = attempt(file, () => files.readText(file));
  if (text.kind === "err") return text;
  const lit = exportedLiteral(text.value, "library");
  if (lit.kind === "err") return err(`the manifest is not a literal: ${lit.error.expected}`);
  const input = lit.value;
  const field =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? Object.entries(input).find(([k]) => k === "kanon")?.[1]
      : undefined;
  if (field === undefined) return err("the manifest declares no kanon table");
  return decodeTable(field);
}

/** The `.ts` files under `dir`, as paths from `root` with `/`, in the order of their names. */
export function readSources(root: string, files: Files = systemFiles, dir = ""): Result<readonly SourceFile[], string> {
  const entries = attempt(root, () =>
    [...files.readDir(dir === "" ? root : `${root}/${dir}`)].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  );
  if (entries.kind === "err") return entries;
  const out: SourceFile[] = [];
  for (const e of entries.value) {
    const rel = dir === "" ? e.name : `${dir}/${e.name}`;
    if (e.isDirectory) {
      if (SKIPPED.has(e.name)) continue;
      const inner = readSources(root, files, rel);
      if (inner.kind === "err") return inner;
      out.push(...inner.value);
    } else if (e.name.endsWith(".ts")) {
      const text = attempt(rel, () => files.readText(`${root}/${rel}`));
      if (text.kind === "err") return text;
      out.push({ path: rel, text: text.value });
    }
  }
  return ok(out);
}

/** The `exports` of the package at `root`, each subpath to its target. */
export function readExports(root: string, files: Files = systemFiles): Result<Exports, string> {
  const file = `${root}/package.json`;
  const parsed = attempt(file, () => {
    const raw: unknown = JSON.parse(files.readText(file));
    return raw;
  });
  if (parsed.kind === "err") return parsed;
  const o =
    typeof parsed.value === "object" && parsed.value !== null
      ? Object.entries(parsed.value).find(([k]) => k === "exports")?.[1]
      : undefined;
  const out: Record<string, string | { readonly [condition: string]: string }> = {};
  if (typeof o !== "object" || o === null) return ok(out);
  for (const [key, v] of Object.entries(o)) {
    if (typeof v === "string") out[key] = v;
    else if (typeof v === "object" && v !== null) {
      const conds: Record<string, string> = {};
      for (const [c, t] of Object.entries(v)) if (typeof t === "string") conds[c] = t;
      out[key] = conds;
    }
  }
  return ok(out);
}

/** Every finding of the import check over the library at `root`, or why its table, its package or its files cannot be read. */
export function findings(root: string, files: Files = systemFiles): Result<readonly Finding[], string> {
  const table = readTable(root, files);
  if (table.kind === "err") return table;
  const exported = readExports(root, files);
  if (exported.kind === "err") return exported;
  const sources = readSources(root, files);
  if (sources.kind === "err") return sources;
  return ok(importFindings(table.value, sources.value, exported.value));
}

/** A baseline's keys, from its text: a line that is not a comment or blank. */
export function parseBaseline(text: string): ReadonlySet<string> {
  return new Set(
    text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#")),
  );
}

/** The judgement of findings against a baseline: the new ones, and the lines of the baseline that no longer occur (both fail the check). */
export function judge(
  found: readonly Finding[],
  baseline: ReadonlySet<string>,
): { readonly fresh: readonly Finding[]; readonly stale: readonly string[] } {
  const keys = new Set(found.map((f) => f.key));
  return { fresh: found.filter((f) => !baseline.has(f.key)), stale: [...baseline].filter((k) => !keys.has(k)).sort() };
}
