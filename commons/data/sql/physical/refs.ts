// Spec: 0007-physical FR-014
/**
 * References for text written by people (commons data 0007-physical FR-014): a query or a transform is SQL a person writes, and the names in it are a schema's, written by the naming layer for a
 * dialect and a schema qualifier. A `Refs` gives the written, quoted name of a table or a column from the words of its name, and keeps what is not there as an error value, so that a name that
 * does not exist is found when the SQL is made and not when it is run.
 *
 * @module
 */
import { words } from "@intellectual-frontiers/data/governance";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import type { Naming } from "./case.ts";
import type { Dialect } from "./dialect.ts";
import { writeNames } from "./express.ts";
import type { PhysicalError } from "./statement.ts";

/** What is wrong with a name in a text. */
export type RefError =
  | { readonly kind: "unknown-table"; readonly name: string }
  | { readonly kind: "unknown-column"; readonly table: string; readonly column: string }
  | { readonly kind: "names"; readonly errors: readonly PhysicalError[] };

/** The names of a schema, for the text of a person. */
export interface Refs {
  /** The reference to a table, written and qualified, by the words of its name; or what the caller's `relation` gives for the name. */
  table(name: string): string;
  /** A column of a table, written and quoted, by the words of both names. */
  column(table: string, column: string): string;
  /** A name written by the schema's naming for a table of the caller's own: with the schema's words added where the dialect has no schemas. */
  own(name: string): string;
}

/** The names a text asked for, and what was wrong with them. */
export interface RefsKit {
  readonly refs: Refs;
  errors(): readonly RefError[];
  /** The tables asked for, once each, in the order first asked, with where each came from. */
  used(): readonly { readonly name: string; readonly via: "schema" | "relation" }[];
}

const dotted = (s: string): string => words(s).join(".");

/**
 * The references of a schema.
 *
 * @param schema - the logical schema
 * @param dialect - the dialect
 * @param naming - the case styles
 * @param inSchema - the schema the tables are in, as `bind` was given it
 * @param relation - what the caller gives for a name that is not a table of the schema (a model of its own), or nothing
 * @returns the references and what they found wrong
 */
export function refsOf(
  schema: LogicalSchema,
  dialect: Dialect,
  naming: Naming,
  inSchema?: string,
  relation?: (name: string) => string | undefined,
): RefsKit {
  const problems: PhysicalError[] = [];
  const names = writeNames(schema, dialect, naming, problems, inSchema);
  const errors: RefError[] = problems.length > 0 ? [{ kind: "names", errors: problems }] : [];
  const used: { name: string; via: "schema" | "relation" }[] = [];
  const note = (name: string, via: "schema" | "relation"): void => {
    if (!used.some((u) => dotted(u.name) === dotted(name))) used.push({ name, via });
  };
  const find = (name: string) => schema.tables.find((t) => t.name.join(".") === dotted(name));
  const refs: Refs = {
    table: (name) => {
      const own = relation?.(name);
      if (own !== undefined) {
        note(name, "relation");
        return own;
      }
      const t = find(name);
      if (t === undefined) {
        errors.push({ kind: "unknown-table", name });
        return dialect.quote("?");
      }
      note(name, "schema");
      return names.ref(t.id);
    },
    column: (table, column) => {
      const t = find(table);
      const c = t?.columns.find((x) => x.name.join(".") === dotted(column));
      if (t === undefined || c === undefined) {
        errors.push(t === undefined ? { kind: "unknown-table", name: table } : { kind: "unknown-column", table, column });
        return dialect.quote("?");
      }
      return dialect.quote(names.column(c.id) ?? "?");
    },
    own: (name) => names.qualify(naming.names.write(words(name))),
  };
  return { refs, errors: () => errors, used: () => used };
}
