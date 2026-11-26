// Spec: 0012-repoctl-query FR-001, FR-002, FR-003
/**
 * Questions of the repository in SQL (commons repoctl 0012-repoctl-query): the libraries, their specifications and the requirements each specification keeps, read from the manifests and the tables of the spec kits and made into relations,
 * and a read-only SQL answered over them with the SQL language library (its guard judges that the text is one read and binds it to the catalog, its engine answers). Pure: it is given the texts it reads.
 *
 * @example
 * ```ts
 * import { askRepository } from "./query.ts";
 * // askRepository(sources, "SELECT library, count(*) AS n FROM requirements WHERE mechanism = 'none' GROUP BY library");
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { catalogFromTables, type Catalog, type Type } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { guard } from "@intellectual-frontiers/lang-sql/aide/guard";
import { astsql, createEngine, type Table, type Value } from "@intellectual-frontiers/lang-sql/aide/relational";
import { renderDiagnostic } from "@intellectual-frontiers/lang-sql/aide/text";
import type { LibraryInfo } from "./ports.ts";

/** What is read of one library: its manifest facts and the texts of its two tables (`registry.tsv`, `enforcement.tsv`), or none where it has no kit. */
export type RepositorySource = { readonly library: LibraryInfo; readonly registry: string | undefined; readonly enforcement: string | undefined };

/** What may be given to a question. */
export type RepositoryQueryOptions = { readonly limit?: number; readonly params?: readonly Value[] };

/** What a question gives. */
export type RepositoryAnswer = { readonly columns: readonly string[]; readonly rows: readonly (readonly Value[])[]; readonly truncated: boolean };

const SCHEMA: Readonly<Record<string, readonly (readonly [string, Type])[]>> = {
  libraries: [["name", "text"], ["package", "text"], ["folder", "text"], ["version", "text"], ["level", "text"], ["npm", "bool"], ["maturity", "text"]],
  specs: [["library", "text"], ["number", "text"], ["slug", "text"], ["state", "text"]],
  requirements: [["library", "text"], ["spec", "text"], ["fr", "text"], ["mechanism", "text"], ["by", "text"], ["note", "text"]],
};

/** The catalog of the relations. */
export function repositoryCatalog(): Catalog {
  return catalogFromTables(Object.entries(SCHEMA).map(([name, columns]) => ({ name, columns: columns.map(([c, t]) => ({ name: c, type: t })) })), { text: "text", bool: "bool" });
}

const lines = (text: string | undefined): readonly (readonly string[])[] =>
  text === undefined ? [] : text.split("\n").filter((l) => l.trim() !== "").map((l) => l.split("\t")).slice(0);

/** The relations of the sources: a header line of a table is left out, a line that is not a row is left out. */
export function repositoryRelations(sources: readonly RepositorySource[]): Readonly<Record<string, Table>> {
  const columns = (name: string): readonly string[] => (SCHEMA[name] ?? []).map(([c]) => c);
  const libraries: (readonly Value[])[] = [];
  const specs: (readonly Value[])[] = [];
  const requirements: (readonly Value[])[] = [];
  for (const { library: l, registry, enforcement } of sources) {
    libraries.push([l.name, l.package, l.folder, l.version, l.level, l.npm, l.maturity]);
    for (const [number, slug, state] of lines(registry)) if (number !== undefined && /^\d+$/.test(number)) specs.push([l.name, number, slug ?? "", state ?? ""]);
    for (const [id, mechanism, by, note] of lines(enforcement)) {
      const m = /^(\S+) (FR-\d+)$/.exec(id ?? "");
      if (m !== null) requirements.push([l.name, m[1] ?? "", m[2] ?? "", mechanism ?? "", by ?? "", note ?? ""]);
    }
  }
  return {
    libraries: { columns: columns("libraries"), rows: libraries },
    specs: { columns: columns("specs"), rows: specs },
    requirements: { columns: columns("requirements"), rows: requirements },
  };
}

/** The answer to one read-only question over the repository, or why it is refused (with its place) or cannot be answered. */
export function askRepository(sources: readonly RepositorySource[], sql: string, options: RepositoryQueryOptions = {}): Result<RepositoryAnswer, string> {
  const checked = guard(sql, astsql, { catalog: repositoryCatalog() });
  if (checked.kind === "err") return err(checked.error.map((v) => renderDiagnostic(sql, v)).join("\n") || "the question is refused");
  const lookup = new Map(Object.entries(repositoryRelations(sources)));
  const r = createEngine((name) => lookup.get(name.toLowerCase())).run(sql, options.params ?? []);
  if (r.kind === "err") return err(r.error.message);
  const limit = Math.max(0, options.limit ?? 1000);
  return ok({ columns: r.value.columns, rows: r.value.rows.slice(0, limit), truncated: r.value.rows.length > limit });
}
