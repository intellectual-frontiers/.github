// Spec: 0012-repoctl-query FR-004, FR-005
/**
 * `repoctl query` on Headless (commons repoctl 0012-repoctl-query FR-004, FR-005): one read-only SELECT over the libraries, specifications and requirements of the repository, answered as a table or as JSON. It reads the manifests and the
 * tables of the spec kits through the world's ports and changes nothing.
 *
 * @example
 * ```ts
 * import { queryVerb } from "@intellectual-frontiers/repoctl/physical";
 * typeof queryVerb; // "function"
 * ```
 *
 * @module
 */
import { askRepository, finding, type RepositorySource } from "@intellectual-frontiers/repoctl/logical";
import { value } from "@intellectual-frontiers/terminal/args";
import { defineVerb, outcomeOfDone, outcomeOfEnvironment, outcomeOfUsage } from "../define.ts";

const cell = (v: string | number | boolean | null): string => (v === null ? "" : String(v));

/** The rows as aligned text: a header, then a row for each, the columns padded to the widest value. */
export function tableText(columns: readonly string[], rows: readonly (readonly (string | number | boolean | null)[])[]): string {
  const text = rows.map((r) => r.map(cell));
  const width = columns.map((c, i) => Math.max(c.length, ...text.map((r) => (r[i] ?? "").length)));
  const line = (r: readonly string[]): string => r.map((c, i) => c.padEnd(width[i] ?? 0)).join("  ").trimEnd();
  return [line(columns), ...text.map(line)].join("\n");
}

/** `repoctl query`. */
export const queryVerb = defineVerb({
  name: "query",
  id: "query",
  options: {
    limit: value<never>({ help: "The most rows of the answer.", valueName: "N", default: "1000" }),
  },
  operands: [{ name: "SQL", help: "One SELECT over libraries, specs and requirements.", arity: "one" }],
  examples: [
    { args: ["SELECT library, count(*) AS n FROM requirements WHERE mechanism = 'none' GROUP BY library"], says: "Count the requirements that nothing verifies, library by library." },
    { args: ["SELECT name, version FROM libraries ORDER BY name", "--json"], says: "The libraries with their versions, as one JSON document." },
  ],
  run: async (args, _ctx, w, host) => {
    if (host.config.libraries === undefined) return outcomeOfEnvironment("this repository's configuration has no libraries");
    const limit = Number(args.options.limit);
    if (!Number.isInteger(limit) || limit < 0) return outcomeOfUsage(`${args.options.limit} is not a number of rows`, "E-USAGE", "repoctl query --help");
    const listed = await w.libraries.list();
    if (listed.kind === "err") return outcomeOfEnvironment(listed.error);
    const sources: RepositorySource[] = [];
    for (const library of listed.value) {
      const kit = library.specKit === undefined ? undefined : `${w.repo}/${library.folder}/${library.specKit}`;
      sources.push({ library, registry: kit === undefined ? undefined : await w.files.read(`${kit}/registry.tsv`), enforcement: kit === undefined ? undefined : await w.files.read(`${kit}/enforcement.tsv`) });
    }
    const answer = askRepository(sources, args.positionals[0] ?? "", { limit });
    if (answer.kind === "err") return outcomeOfDone({ data: null, text: answer.error, findings: [finding("fail", "E-USAGE", answer.error, "repoctl query --help")] });
    const { columns, rows, truncated } = answer.value;
    return outcomeOfDone({
      data: { columns, rows, truncated },
      text: [tableText(columns, rows), ...(truncated ? [`(cut at ${limit} rows)`] : [])].join("\n"),
      findings: [],
      title: `${rows.length} row${rows.length === 1 ? "" : "s"}`,
    });
  },
});
