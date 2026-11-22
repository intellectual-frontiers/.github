// Spec: 0001-kanon-checker FR-007, FR-012
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
import { existsSync, readDirSync, readFileSync, readTextFileSync } from "@intellectual-frontiers/system/fs";
import { splitPackage } from "./family.ts";
import { MANIFEST as BUNDLE_MANIFEST } from "./bundle.ts";
import { extensionFindings } from "./extensions.ts";
import { type ExportsMap, type Finding, importFindings, type SourceFile } from "./imports.ts";
import { decodeTable, type Table } from "./table.ts";

/** The name of a library's manifest in its folder. */
export const MANIFEST = "library.ts";
/** The name of the manifest of a consumer, a package that is not a library of commons (0033-kanon FR-027): the export `kanon`, a table in the form of the field `kanon` of `library.ts`. */
export const CONSUMER_MANIFEST = "kanon.ts";
/** The name of the baseline of findings a library holds, in its folder. */
export const BASELINE = "kanon.baseline.txt";

/** What the host reads with: a port, a record of functions, so that a test or another host may give its own. */
export type Files = {
  readonly exists: (path: string) => boolean;
  readonly readDir: (path: string) => readonly { readonly name: string; readonly isDirectory: boolean }[];
  readonly readText: (path: string) => string;
  /** The bytes of a file, for a bundle (0002-kanon-content-checks FR-011). */
  readonly readBytes?: (path: string) => Uint8Array;
};

/** The real file system. */
export const systemFiles: Files = {
  exists: (path) => existsSync(path),
  readDir: (path) => readDirSync(path).map((e) => ({ name: e.name, isDirectory: e.isDirectory })),
  readText: (path) => readTextFileSync(path),
  readBytes: (path) => readFileSync(path),
};

/** An `exports` map: each subpath to its target, a string or an object of conditions of strings. */
export type Exports = ExportsMap;

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
  const r = readTableOf(root, files);
  return r.kind === "ok" ? ok(r.value.table) : r;
}

/** The table of a package and the manifest it was read from: `library.ts` (its field `kanon`) or, where there is none, the consumer's `kanon.ts` (0002-kanon-content-checks FR-007). */
export function readTableOf(root: string, files: Files = systemFiles): Result<{ readonly table: Table; readonly manifest: typeof MANIFEST | typeof CONSUMER_MANIFEST }, string> {
  const file = `${root}/${MANIFEST}`;
  if (!files.exists(file)) {
    const consumer = `${root}/${CONSUMER_MANIFEST}`;
    if (!files.exists(consumer)) return err(`neither ${file} nor ${consumer} is there`);
    const own = attempt(consumer, () => files.readText(consumer));
    if (own.kind === "err") return own;
    const table = exportedLiteral(own.value, "kanon");
    if (table.kind === "err") return err(`${CONSUMER_MANIFEST} is not a literal: ${table.error.expected}`);
    const decoded = decodeTable(table.value);
    return decoded.kind === "ok" ? ok({ table: decoded.value, manifest: CONSUMER_MANIFEST }) : decoded;
  }
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
  const decoded = decodeTable(field);
  return decoded.kind === "ok" ? ok({ table: decoded.value, manifest: MANIFEST }) : decoded;
}

/** The files of a bundle in a folder, and the text of its manifest, read and nothing written: every file under the folder but the manifest, by its path from the folder with `/` (0002-kanon-content-checks FR-011). */
export function readBundle(dir: string, files: Files = systemFiles): Result<{ readonly manifest: string; readonly files: ReadonlyMap<string, Uint8Array> }, string> {
  if (files.readBytes === undefined) return err("this host reads no bytes");
  const read = files.readBytes;
  const found = new Map<string, Uint8Array>();
  const walk = (rel: string): Result<true, string> => {
    const entries = attempt(dir, () => files.readDir(rel === "" ? dir : `${dir}/${rel}`));
    if (entries.kind === "err") return entries;
    for (const e of [...entries.value].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const path = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory) {
        const inner = walk(path);
        if (inner.kind === "err") return inner;
      } else if (path !== BUNDLE_MANIFEST) {
        const b = attempt(path, () => read(`${dir}/${path}`));
        if (b.kind === "err") return b;
        found.set(path, b.value);
      }
    }
    return ok(true);
  };
  const walked = walk("");
  if (walked.kind === "err") return walked;
  const manifest = attempt(BUNDLE_MANIFEST, () => files.readText(`${dir}/${BUNDLE_MANIFEST}`));
  return manifest.kind === "err" ? manifest : ok({ manifest: manifest.value, files: found });
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
  if (table.value.extends === undefined) return ok(importFindings(table.value, sources.value, exported.value));
  // an extension is a folder beside its host's, which its package names (0027-commons-libraries FR-013: a package's folder is its name)
  const hostRoot = `${root}/../${splitPackage(table.value.extends).base}`;
  const host = readTable(hostRoot, files);
  if (host.kind === "err") return err(`the host ${table.value.extends}: ${host.error}`);
  const hostExports = readExports(hostRoot, files);
  if (hostExports.kind === "err") return hostExports;
  return ok(extensionFindings(host.value, hostExports.value, table.value, sources.value, exported.value));
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
