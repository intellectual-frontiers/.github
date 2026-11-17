/**
 * Import a slice of an outside vocabulary into a generated TypeScript module (commons 0019-mizan-integrations FR-005 to FR-009), from a manifest written in TypeScript.
 *
 *     bun commons/ts/mizan/integrations/host/import.ts MANIFEST.ts           write the module the manifest names
 *     bun commons/ts/mizan/integrations/host/import.ts MANIFEST.ts --check   exit 1, writing nothing, where the module is not what the import makes; for a URL source it compares
 *                                                                            the manifest to the module's header offline, and with --fetch fetches the source and compares fully
 *
 * The manifest is a module that exports `manifest`: the pinned `standard` (issuer, version, license, whether it may be copied, the SHA-256 of the source), the `source` (a file
 * relative to the manifest, or an `https://` URL fetched once and held to the SHA-256 pin, 0019-mizan-integrations FR-014), its `format` (`turtle` or `n-triples`), the `namespace` and the `slice` of local names to take, the `out` file and the `rdfImport` specifier of the
 * module that gives `namespace` and `vocabulary`. The manifest is read once, here, into a typed record; a finding stops the run with exit 2 and one sentence each.
 *
 * @module
 */
import process from "node:process";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "../../../runtime/path.ts";
import { existsSync, readTextFileSync, writeTextFileSync } from "../../../runtime/fs.ts";
import { stdio } from "../../../runtime/mod.ts";
import { err, ok, type Result } from "../../../kernel/result.ts";
import { importVocabulary } from "../pure/import-vocabulary.ts";
import { provenanceTurtle } from "../pure/provenance.ts";
import { describeFinding, type StandardRecord } from "../pure/types.ts";

/** What a manifest says, read into a typed record. */
export type ImportManifest = {
  readonly standard: StandardRecord;
  readonly source: string;
  readonly format: "turtle" | "n-triples";
  readonly namespace: { readonly prefix: string; readonly iri: string };
  readonly slice: readonly string[];
  readonly out: string;
  /** Where the PROV-O record is written, relative to the manifest: beside it, named after `out`, by default. */
  readonly provOut?: string;
  readonly rdfImport: string;
  readonly exportName?: string;
};

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === "object" && x !== null && !Array.isArray(x);
const text = (x: unknown): string | undefined => (typeof x === "string" && x !== "" ? x : undefined);

/** A manifest module's `manifest` export, checked once: every field there and of its type, or the sentence that says which is not. */
export function decodeManifest(x: unknown): Result<ImportManifest, string> {
  if (!isRecord(x)) return err("the manifest is not an object");
  const st = x["standard"];
  if (!isRecord(st)) return err("the manifest has no standard");
  const fields = ["id", "issuer", "name", "version", "location", "license", "sha256"] as const;
  const got: Record<string, string> = {};
  for (const f of fields) {
    const v = text(st[f]);
    if (v === undefined) return err(`standard.${f} must be a non-empty string`);
    got[f] = v;
  }
  if (typeof st["redistributable"] !== "boolean") return err("standard.redistributable must be true or false");
  const ns = x["namespace"];
  if (!isRecord(ns) || text(ns["prefix"]) === undefined || text(ns["iri"]) === undefined)
    return err("namespace must have a prefix and an iri");
  const slice = x["slice"];
  if (!Array.isArray(slice) || slice.some((s) => typeof s !== "string")) return err("slice must be a list of local names");
  const format = x["format"];
  if (format !== "turtle" && format !== "n-triples") return err("format must be turtle or n-triples");
  const [source, out, rdfImport, provOut] = [text(x["source"]), text(x["out"]), text(x["rdfImport"]), text(x["provOut"])];
  if (source === undefined || out === undefined || rdfImport === undefined)
    return err("source, out and rdfImport must be non-empty strings");
  const exportName = text(x["exportName"]);
  return ok({
    standard: {
      id: got["id"] ?? "",
      issuer: got["issuer"] ?? "",
      name: got["name"] ?? "",
      version: got["version"] ?? "",
      location: got["location"] ?? "",
      license: got["license"] ?? "",
      redistributable: st["redistributable"],
      sha256: got["sha256"] ?? "",
    },
    source,
    format,
    namespace: { prefix: text(ns["prefix"]) ?? "", iri: text(ns["iri"]) ?? "" },
    slice: slice.map(String),
    out,
    ...(provOut === undefined ? {} : { provOut }),
    rdfImport,
    ...(exportName === undefined ? {} : { exportName }),
  });
}

/** Whether a source is a URL: `https://`, or `http://` on the loopback address, which only a test serves (the SHA-256 pin holds either to the same bytes). */
export function isUrl(source: string): boolean {
  return source.startsWith("https://") || source.startsWith("http://127.0.0.1:") || source.startsWith("http://localhost:");
}

/** The text of a source: a file relative to the manifest's folder, or the body of an `https://` URL; a failure to read it is the sentence that says why. */
export async function readSource(source: string, dir: string): Promise<Result<string, string>> {
  if (isUrl(source)) {
    try {
      const r = await fetch(source);
      return r.ok ? ok((await r.text()).replaceAll("\r\n", "\n")) : err(`${source}: HTTP ${r.status}`);
    } catch (e) {
      return err(`${source}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const file = resolve(dir, source);
  return existsSync(file) ? ok(readTextFileSync(file).replaceAll("\r\n", "\n")) : err(`${source}: no such file`);
}

/** What a generated module's header and vocabulary say, read back without the source: its pinned hash and the local names of its terms. */
export function readModuleHeader(moduleText: string): { readonly sha256: string; readonly terms: readonly string[] } | undefined {
  const sha = /^\/\/ source_sha256=([0-9a-f]{64})$/m.exec(moduleText)?.[1];
  const block = /export const [a-z][A-Za-z0-9_]* = vocabulary\([A-Z0-9_]+, \{\n([\s\S]*?)\n\}\);/.exec(moduleText)?.[1];
  if (sha === undefined || block === undefined) return undefined;
  return { sha256: sha, terms: [...block.matchAll(/^ {2}"?([A-Za-z0-9_]+)"?: "/gm)].map((m) => m[1] ?? "") };
}

/** The command line. Returns the exit status: 0, 1 where the module is stale (`--check`), 2 where the manifest or the import has findings. */
export async function main(argv: readonly string[]): Promise<number> {
  const file = argv.find((a) => !a.startsWith("--"));
  if (file === undefined) {
    stdio.stderr.writeSync("usage: import.ts MANIFEST.ts [--check [--fetch]]\n");
    return 2;
  }
  const path = resolve(file);
  const loaded: unknown = await import(pathToFileURL(path).href);
  const m = decodeManifest(isRecord(loaded) ? loaded["manifest"] : undefined);
  if (m.kind === "err") {
    stdio.stderr.writeSync(`${file}: ${m.error}\n`);
    return 2;
  }
  const dir = dirname(path);
  const out = resolve(dir, m.value.out);
  const provOut = resolve(dir, m.value.provOut ?? `${(m.value.out.split("/").pop() ?? "module").replace(/\.ts$/, "")}.prov.ttl`);
  const check = argv.includes("--check");
  const remote = isUrl(m.value.source);
  if (check && remote && !argv.includes("--fetch")) {
    const head = existsSync(out) ? readModuleHeader(readTextFileSync(out)) : undefined;
    const want = [...new Set(m.value.slice)].sort();
    const stale =
      head === undefined || head.sha256 !== m.value.standard.sha256 || head.terms.join(",") !== want.join(",") || !existsSync(provOut);
    if (stale)
      stdio.stderr.writeSync(
        `${m.value.out} is not what the manifest pins (its source hash or its terms differ); run: bun commons/ts/mizan/integrations/host/import.ts ${file}\n`,
      );
    return stale ? 1 : 0;
  }
  const text = await readSource(m.value.source, dir);
  if (text.kind === "err") {
    stdio.stderr.writeSync(`${file}: ${text.error}\n`);
    return 2;
  }
  const made = await importVocabulary({
    standard: m.value.standard,
    sourceText: text.value,
    format: m.value.format,
    namespace: m.value.namespace,
    slice: m.value.slice,
    rdfImport: m.value.rdfImport,
    ...(m.value.exportName === undefined ? {} : { exportName: m.value.exportName }),
  });
  if (made.kind === "err") {
    stdio.stderr.writeSync(made.error.map((f) => `${file}: ${describeFinding(f)}\n`).join(""));
    return 2;
  }
  for (const f of made.value.findings) stdio.stderr.writeSync(`${file}: ${describeFinding(f)}\n`);
  const prov = provenanceTurtle(made.value.record, m.value.out);
  if (check) {
    const current =
      existsSync(out) && readTextFileSync(out) === made.value.module && existsSync(provOut) && readTextFileSync(provOut) === prov;
    if (!current)
      stdio.stderr.writeSync(
        `${m.value.out} is not what the import makes; run: bun commons/ts/mizan/integrations/host/import.ts ${file}\n`,
      );
    return current ? 0 : 1;
  }
  writeTextFileSync(out, made.value.module);
  writeTextFileSync(provOut, prov);
  stdio.stdout.writeSync(`wrote ${m.value.out}: ${made.value.terms.length} terms\n`);
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
