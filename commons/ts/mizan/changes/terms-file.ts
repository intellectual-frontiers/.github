/**
 * The ontology's citations of requirements as a harness states them for the offline trace (commons 0020-ifccm FR-036): a JSON file, or a TypeScript or JavaScript module, that gives each term and the
 * requirements its `mz:definedBy` names.
 *
 * @remarks
 * Host layer: a module is loaded with a dynamic `import()` of its `file:` URL (never of a bare path, which Windows reads as a drive and a scheme), so the same call works on Bun, on Node 26 and on
 * Windows. A module gives its terms as `export const terms` (or as its default export); an element is either `{ term, cites, file? }` or a record of an audit of terms (`{ values: { termIri,
 * definedBy } }`, the shape the audits of commons' ontologies and of a harness's own have). A JSON file is an array of the first shape, or an object with it as `terms`.
 *
 * @limits
 * A module is run, as any module is: it is the harness's own file, named by the harness on its command line. It reads no ontology other than the one it is given.
 *
 * @example
 * ```ts
 * import { readTermsFile } from "./terms-file.ts";
 * const r = await readTermsFile("ontology/terms.json");
 * if (r.kind === "ok") r.value.map((t) => t.term);
 * ```
 *
 * @module
 */
import { array, formatDecodeError, mapDecoder, object, oneOf, string } from "../../kernel/decode.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import type { OntologyCitation } from "../../kernel/trace.ts";
import { existsSync, readTextFileSync } from "../../runtime/fs.ts";
import { toFileUrl } from "../../runtime/path.ts";

const plain = mapDecoder(object({ term: string, cites: array(string) }, { file: string }), (t): OntologyCitation => ({
  term: t.term,
  cites: t.cites,
  file: t.file ?? "",
}));
const audit = mapDecoder(object({ values: object({ termIri: string }, { definedBy: array(string) }) }), (t): OntologyCitation => ({
  term: t.values.termIri,
  cites: t.values.definedBy ?? [],
  file: "",
}));
const terms = array(oneOf(plain, audit));

/** The citations a value holds, or why it holds none. */
function decodeTerms(value: unknown): Result<readonly OntologyCitation[], string> {
  const r = terms(value, "terms");
  return r.kind === "ok" ? ok(r.value) : err(formatDecodeError(r.error));
}

/** The citations of the file at `path`: JSON (by its `.json` name) or a module that exports `terms`. */
export async function readTermsFile(path: string): Promise<Result<readonly OntologyCitation[], string>> {
  if (!existsSync(path)) return err(`${path} does not exist`);
  if (path.endsWith(".json")) {
    let json: unknown;
    try {
      json = JSON.parse(readTextFileSync(path));
    } catch (e) {
      return err(`${path} is not JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    const list: unknown = typeof json === "object" && json !== null && !Array.isArray(json) ? Reflect.get(json, "terms") : json;
    return decodeTerms(list);
  }
  try {
    const mod: unknown = await import(toFileUrl(path).href);
    const named: unknown = typeof mod === "object" && mod !== null ? (Reflect.get(mod, "terms") ?? Reflect.get(mod, "default")) : undefined;
    if (named === undefined)
      return err(`${path} exports no terms: it exports \`terms\` (or a default) as a list of { term, cites } or of audit records`);
    return decodeTerms(named);
  } catch (e) {
    return err(`${path} could not be loaded: ${e instanceof Error ? e.message : String(e)}`);
  }
}
