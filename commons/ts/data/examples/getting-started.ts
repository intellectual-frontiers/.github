/**
 * The first model of SQL Aide (commons 0009-sql-aide FR-006, FR-015): two tables, the type of a row the compiler works out from them, and
 * the same model rendered as PostgreSQL and as SQLite write it. What a dialect lacks does not compile where the model is rendered for it:
 * a table with an array column renders for PostgreSQL and DuckDB and is a type error for SQLite.
 *
 * @module
 */
import { context, date, definitions, fk, pk, postgres, render, type RowOf, sqlite, table, text } from "../sql-aide/mod.ts";

/** A party: whoever a business deals with. */
export const party = table("party", { party_id: pk.ulid(), name: text() });

/** A person: a party, born on a day that may not be known. */
export const person = table("person", { party_id: fk(party.c.party_id).primaryKey(), born: date().nullable() });

/** A row of `person`: `{ readonly party_id: Brand<string, "party">; readonly born: string | null }`. */
export type Person = RowOf<typeof person>;

/** The model as PostgreSQL writes it: `CREATE TABLE IF NOT EXISTS "party" ...` then `"person"`, in the order the references need. */
export const asPostgres = (): string => render(definitions([person, party]), context({ dialect: postgres() }));

/** The same model, as SQLite writes it. */
export const asSqlite = (): string => render(definitions([person, party]), context({ dialect: sqlite() }));
