/**
 * A fixture schema for the SQL Aide lens (commons 0011-documentation FR-013): two tables, one pointing at the other, one column of
 * personal data, and a documentation map.
 *
 * @module
 */
import { type Docs, docsOf, fk, pk, table, text } from "../../../ts/data/sql-aide/mod.ts";

/** A shelf of a library. */
export const shelf = table("shelf", { shelf_id: pk.ulid(), label: text() }, { owner: "fixture" });

/** A book on a shelf. */
export const book = table("book", { book_id: pk.ulid(), shelf_id: fk(shelf.c.shelf_id), borrower: text().personal("Name").nullable() });

/** The documentation map of the fixture: the descriptions of its tables and columns. */
export const fixtureDocs: Docs = docsOf({ shelf, book }, {
  shelf: { summary: "A shelf of a library.", members: { shelf_id: "The shelf's key.", label: "What is written on it." } },
  book: { summary: "A book on a shelf.", members: { book_id: "The book's key.", shelf_id: "The shelf it is on.", borrower: "Who has it." } },
});
