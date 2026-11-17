/**
 * Import a slice of an outside vocabulary into a generated TypeScript module (commons 0019-mizan-integrations FR-005 to FR-009), from a manifest written in TypeScript.
 *
 *     bun commons/ts/mizan/integrations/host/import.ts MANIFEST.ts           write the module the manifest names
 *     bun commons/ts/mizan/integrations/host/import.ts MANIFEST.ts --check   exit 1, writing nothing, where the module is not what the import makes
 *
 * The manifest is a module that exports `manifest`: the pinned `standard` (issuer, version, license, whether it may be copied, the SHA-256 of the source), the `source` file
 * (relative to the manifest), its `format` (`turtle` or `n-triples`), the `namespace` and the `slice` of local names to take, the `out` file and the `rdfImport` specifier of the
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
import { describeFinding, type StandardRecord } from "../pure/types.ts";

/** What a manifest says, read into a typed record. */
export type ImportManifest = {
  readonly standard: StandardRecord;
  readonly source: string;
  readonly format: "turtle" | "n-triples";
  readonly namespace: { readonly prefix: string; readonly iri: string };
  readonly slice: readonly string[];
  readonly out: string;
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
  const [source, out, rdfImport] = [text(x["source"]), text(x["out"]), text(x["rdfImport"])];
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
    rdfImport,
    ...(exportName === undefined ? {} : { exportName }),
  });
}

/** The command line. Returns the exit status: 0, 1 where the module is stale (`--check`), 2 where the manifest or the import has findings. */
export async function main(argv: readonly string[]): Promise<number> {
  const file = argv.find((a) => !a.startsWith("--"));
  if (file === undefined) {
    stdio.stderr.writeSync("usage: import.ts MANIFEST.ts [--check]\n");
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
  const made = await importVocabulary({
    standard: m.value.standard,
    sourceText: readTextFileSync(resolve(dir, m.value.source)).replaceAll("\r\n", "\n"),
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
  const out = resolve(dir, m.value.out);
  if (argv.includes("--check")) {
    if (existsSync(out) && readTextFileSync(out) === made.value.module) return 0;
    stdio.stderr.writeSync(`${m.value.out} is not what the import makes; run: bun commons/ts/mizan/integrations/host/import.ts ${file}\n`);
    return 1;
  }
  writeTextFileSync(out, made.value.module);
  stdio.stdout.writeSync(`wrote ${m.value.out}: ${made.value.terms.length} terms\n`);
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
