// Spec: 0001-docs FR-032
/**
 * What the package `@intellectual-frontiers/commons` weighs and what a consumer reaches of it (docs 0001-docs FR-032), read from two files of the evidence: `package.report.json`, which the packer writes when it packs the package (`bun tools/pack.ts` in `commons/commons`; the bytes and
 * the files of the package, of each library and of each kind of file, its dependencies and peer dependencies and its budget), and `usage.<consumer>.json`, which `repoctl usage --json` writes for a consumer repository (the libraries it imports, those reached through them and those never
 * touched, with their bytes). The page of the site shows them as they are and works out nothing but the share of the budget.
 *
 * @example
 * ```ts
 * import { parsePackageReport } from "./package.ts";
 * "error" in parsePackageReport("{"); // true
 * ```
 *
 * @module
 */

/** The bytes and the files of a set of files, by kind. */
export interface Sizes {
  readonly files: number;
  readonly bytes: number;
  readonly byKind: Readonly<Record<string, { readonly files: number; readonly bytes: number }>>;
}

/** What the packer reports of the package. */
export interface PackageReport {
  readonly name: string;
  readonly version: string;
  readonly total: Sizes;
  readonly tarballBytes: number | undefined;
  readonly libraries: readonly (Sizes & { readonly name: string })[];
  readonly dependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalPeers: readonly string[];
  readonly budget: { readonly apparentBytes: number; readonly files: number; readonly tarballBytes: number };
}

/** What `repoctl usage` reports of a consumer: the three groups with their bytes. */
export interface ConsumerUsage {
  readonly consumer: string;
  readonly libraries: number;
  readonly bytes: number;
  readonly direct: readonly { readonly library: string; readonly bytes: number }[];
  readonly reached: readonly { readonly library: string; readonly via: string; readonly bytes: number }[];
  readonly untouched: readonly { readonly library: string; readonly bytes: number }[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function sizesOf(v: unknown): Sizes | undefined {
  if (!isRecord(v)) return undefined;
  const files = num(v["files"]);
  const bytes = num(v["bytes"]);
  const kinds = v["byKind"];
  if (files === undefined || bytes === undefined || !isRecord(kinds)) return undefined;
  const byKind: Record<string, { files: number; bytes: number }> = {};
  for (const [k, x] of Object.entries(kinds)) {
    if (!isRecord(x) || num(x["files"]) === undefined || num(x["bytes"]) === undefined) return undefined;
    byKind[k] = { files: x["files"] as number, bytes: x["bytes"] as number };
  }
  return { files, bytes, byKind };
}

const stringMap = (v: unknown): Readonly<Record<string, string>> => (isRecord(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "string") as [string, string][]) : {});

/** The report of the packer from its file, or why the file is not one. */
export function parsePackageReport(text: string): { readonly value: PackageReport } | { readonly error: string } {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { error: `is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!isRecord(doc) || typeof doc["name"] !== "string" || typeof doc["version"] !== "string") return { error: "is not a report of the package (a name and a version)" };
  const total = sizesOf(doc["total"]);
  const budget = doc["budget"];
  if (total === undefined || !Array.isArray(doc["libraries"]) || !isRecord(budget)) return { error: "is not a report of the package (the sizes, the libraries and the budget)" };
  const libraries: (Sizes & { name: string })[] = [];
  for (const l of doc["libraries"]) {
    const s = sizesOf(l);
    if (s === undefined || !isRecord(l) || typeof l["name"] !== "string") return { error: "has a library that is not a set of sizes with a name" };
    libraries.push({ name: l["name"], ...s });
  }
  const apparentBytes = num(budget["apparentBytes"]);
  const files = num(budget["files"]);
  const tarballBytes = num(budget["tarballBytes"]);
  if (apparentBytes === undefined || files === undefined || tarballBytes === undefined) return { error: "has a budget that is not bytes and files" };
  return {
    value: {
      name: doc["name"],
      version: doc["version"],
      total,
      tarballBytes: num(doc["tarballBytes"]),
      libraries,
      dependencies: stringMap(doc["dependencies"]),
      peerDependencies: stringMap(doc["peerDependencies"]),
      optionalPeers: Array.isArray(doc["optionalPeers"]) ? doc["optionalPeers"].filter((x): x is string => typeof x === "string") : [],
      budget: { apparentBytes, files, tarballBytes },
    },
  };
}

/** The usage of a consumer from its file (`usage.<consumer>.json`, the output of `repoctl usage --json`, whose answer is in `data`), or why the file is not one. */
export function parseUsage(consumer: string, text: string): { readonly value: ConsumerUsage } | { readonly error: string } {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { error: `is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const d = isRecord(doc) && isRecord(doc["data"]) ? doc["data"] : doc;
  if (!isRecord(d) || !Array.isArray(d["direct"]) || !Array.isArray(d["reached"]) || !Array.isArray(d["untouched"]) || num(d["libraries"]) === undefined || num(d["bytes"]) === undefined) return { error: "is not the answer of repoctl usage (the libraries, the bytes and the three groups)" };
  const rows = <T>(v: unknown, f: (r: Record<string, unknown>) => T | undefined): readonly T[] => (Array.isArray(v) ? v.flatMap((r) => (isRecord(r) ? [f(r)].filter((x): x is T => x !== undefined) : [])) : []);
  return {
    value: {
      consumer,
      libraries: d["libraries"] as number,
      bytes: d["bytes"] as number,
      direct: rows(d["direct"], (r) => (typeof r["library"] === "string" && num(r["bytes"]) !== undefined ? { library: r["library"], bytes: r["bytes"] as number } : undefined)),
      reached: rows(d["reached"], (r) => (typeof r["library"] === "string" && typeof r["via"] === "string" && num(r["bytes"]) !== undefined ? { library: r["library"], via: r["via"], bytes: r["bytes"] as number } : undefined)),
      untouched: rows(d["untouched"], (r) => (typeof r["library"] === "string" && num(r["bytes"]) !== undefined ? { library: r["library"], bytes: r["bytes"] as number } : undefined)),
    },
  };
}
