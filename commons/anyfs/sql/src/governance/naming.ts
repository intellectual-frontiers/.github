// Spec: 0002-sql-governance FR-002
/**
 * The names of the tables of a store: a prefix, which every table carries, and a schema where the database has schemas. Both are made only by `parseNaming`, from lower case words, so that a name
 * is written into a statement only as an identifier of the language and never by hand, and so that several stores live in one database side by side.
 *
 * @example
 * ```ts
 * import { parseNaming, tableOf } from "./naming.ts";
 * const n = parseNaming({ prefix: "fleet" });
 * n.kind === "ok" && tableOf(n.value, "versions"); // "fleet_versions"
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";

/** A word of a table name: lower case letters, digits and underscores, starting with a letter, at most 32 characters. Made only by `parseWord`. */
export type Word = Brand<string, "anyfs sql word">;

/** The tables a dump carries, by what each holds: the version rows and the blobs. */
export const MERGEABLE_ROLES = ["versions", "blobs"] as const;
/** The tables that belong to one replica and that no import writes: its facts and identity, whom it trusts, the epochs it holds and its caches (the deltas held back, and the index of search). */
export const LOCAL_ROLES = ["meta", "trust", "epochs", "cache", "search"] as const;
/** The views made from the rows and nothing else: the heads of every path, the files that are there, the siblings and the version vector. */
export const VIEW_ROLES = ["heads", "names", "siblings", "vector"] as const;
/** Every name of a store, by what it holds. */
export const TABLE_ROLES = [...MERGEABLE_ROLES, ...LOCAL_ROLES, ...VIEW_ROLES] as const;
/** The role of one table or view. */
export type TableRole = (typeof TABLE_ROLES)[number];

/** The names of the tables of one store. */
export type Naming = { readonly prefix: Word; readonly schema?: Word };

const WORD = /^[a-z][a-z0-9_]{0,31}$/u;

/** A word of a name, or why the text is not one. */
export function parseWord(text: string): Result<Word, string> {
  return WORD.test(text) ? ok(text as Word) : err(`${JSON.stringify(text.slice(0, 40))} is not a word of a name: lower case letters, digits and underscores, starting with a letter, at most 32 characters`);
}

/** The options a naming is made from: the prefix is `anyfs` where none is given. */
export type NamingOptions = { readonly prefix?: string; readonly schema?: string };

/** A naming from text, or the reason a word of it is not one. */
export function parseNaming(options: NamingOptions = {}): Result<Naming, string> {
  const prefix = parseWord(options.prefix ?? "anyfs");
  if (prefix.kind === "err") return prefix;
  if (options.schema === undefined) return ok({ prefix: prefix.value });
  const schema = parseWord(options.schema);
  return schema.kind === "err" ? schema : ok({ prefix: prefix.value, schema: schema.value });
}

/** The name of the table of a role: the prefix, an underscore and the role. */
export function tableOf(naming: Naming, role: TableRole): string {
  return `${naming.prefix}_${role}`;
}

/** The name of an index of a table of a role, by what it is on. */
export function indexOf(naming: Naming, role: TableRole, on: string): string {
  return `${naming.prefix}_${role}_${on}`;
}
