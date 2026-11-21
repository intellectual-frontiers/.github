// Spec: 0001-docs FR-027
/**
 * The mutation score of a library (docs 0001-docs FR-027): the share of the changes a mutation tool made to the library's code (a `>` made `>=`, a string made empty, a body emptied) that its tests noticed. `summariseStryker` reads the
 * report of Stryker (the mutation-testing-elements schema) into the small form the evidence keeps, `parseMutation` reads that form, and `scoreOf` is the share that the tests killed. A mutant that survives is a change no test
 * notices: the place where the tests prove least.
 *
 * @module
 */

/** A change that no test noticed. */
export interface Survivor {
  readonly line: number;
  readonly mutator: string;
  readonly replacement: string;
  /** `Survived` (a test ran it and passed) or `NoCoverage` (no test ran it). */
  readonly status: string;
}

/** The mutants of one source file, by what became of them. */
export interface FileMutation {
  /** From the root of the repository. */
  readonly path: string;
  readonly killed: number;
  readonly timeout: number;
  readonly survived: number;
  readonly noCoverage: number;
  readonly survivors: readonly Survivor[];
}

/** The mutation run of one library. */
export interface LibraryMutation {
  readonly library: string;
  readonly files: readonly FileMutation[];
}

/** The most survivors kept for a file. */
const KEPT = 25;

/** The share of the mutants that the tests detected, as a percent with a decimal, or undefined where there were none to detect (errors and ignored mutants are not counted). */
export function scoreOf(files: readonly Pick<FileMutation, "killed" | "timeout" | "survived" | "noCoverage">[]): number | undefined {
  const detected = files.reduce((n, f) => n + f.killed + f.timeout, 0);
  const all = files.reduce((n, f) => n + f.killed + f.timeout + f.survived + f.noCoverage, 0);
  return all === 0 ? undefined : Math.round((detected / all) * 1000) / 10;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Stryker's report as the small form: `base` is the folder of the library from the root, which the paths of the report are relative to. */
export function summariseStryker(text: string, library: string, base: string): { readonly value: LibraryMutation } | { readonly error: string } {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch (e) {
    return { error: `is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!isRecord(j) || !isRecord(j["files"])) return { error: "is not a mutation report (it has no files)" };
  const files: FileMutation[] = [];
  for (const [path, f] of Object.entries(j["files"])) {
    if (!isRecord(f) || !Array.isArray(f["mutants"]) || /(^|\/)(suite|tests|node_modules)\//.test(path)) continue;
    const count = { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0 } as Record<string, number>;
    const survivors: Survivor[] = [];
    for (const m of f["mutants"]) {
      if (!isRecord(m) || typeof m["status"] !== "string") continue;
      if (!(m["status"] in count)) continue;
      count[m["status"]] = (count[m["status"]] ?? 0) + 1;
      if (m["status"] === "Survived" || m["status"] === "NoCoverage") {
        const start = isRecord(m["location"]) && isRecord(m["location"]["start"]) ? num(m["location"]["start"]["line"]) : 0;
        survivors.push({ line: start, mutator: typeof m["mutatorName"] === "string" ? m["mutatorName"] : "", replacement: typeof m["replacement"] === "string" ? m["replacement"].replace(/\s+/g, " ").slice(0, 120) : "", status: m["status"] });
      }
    }
    survivors.sort((a, b) => a.line - b.line);
    files.push({ path: `${base === "" ? "" : `${base}/`}${path}`, killed: count["Killed"] ?? 0, timeout: count["Timeout"] ?? 0, survived: count["Survived"] ?? 0, noCoverage: count["NoCoverage"] ?? 0, survivors: survivors.slice(0, KEPT) });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  return { value: { library, files } };
}

/** What `tools/mutation.ts` kept (`{ "library": ..., "files": [...] }`), or why it cannot be read. */
export function parseMutation(text: string): { readonly value: LibraryMutation } | { readonly error: string } {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch (e) {
    return { error: `is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!isRecord(j) || typeof j["library"] !== "string" || !Array.isArray(j["files"])) return { error: "is not a mutation record (a library and its files)" };
  const files = j["files"].flatMap((f): FileMutation[] => {
    if (!isRecord(f) || typeof f["path"] !== "string") return [];
    const survivors = (Array.isArray(f["survivors"]) ? f["survivors"] : []).flatMap((s): Survivor[] => (isRecord(s) ? [{ line: num(s["line"]), mutator: String(s["mutator"] ?? ""), replacement: String(s["replacement"] ?? ""), status: String(s["status"] ?? "") }] : []));
    return [{ path: f["path"], killed: num(f["killed"]), timeout: num(f["timeout"]), survived: num(f["survived"]), noCoverage: num(f["noCoverage"]), survivors }];
  });
  return { value: { library: j["library"], files } };
}
