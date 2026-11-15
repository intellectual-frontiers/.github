/**
 * The examples the documentation shows run as written (commons 0011-documentation FR-005): SQL Aide's first model renders for PostgreSQL
 * and SQLite, and File Aide's query finds the PDFs of the synthetic IFRFS tree in both of its forms.
 *
 * @module
 */
import { path } from "../../runtime/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../../runtime/test.ts";
import { asPostgres, asSqlite } from "../examples/getting-started.ts";
import { markdown, pdfsIn, same } from "../examples/file-aide.ts";

proves(["0011-documentation FR-005"], "SQL Aide's first model renders for PostgreSQL and SQLite, party before person", () => {
  for (const sql of [asPostgres(), asSqlite()]) {
    assertStringIncludes(sql, 'CREATE TABLE IF NOT EXISTS "party"');
    assert(
      sql.indexOf('CREATE TABLE IF NOT EXISTS "party"') < sql.indexOf('CREATE TABLE IF NOT EXISTS "person"'),
      "the referenced table comes first",
    );
  }
});

proves(
  ["0011-documentation FR-005"],
  "File Aide's example finds the books' PDFs of the synthetic tree, and its text form parses",
  async () => {
    const tree = path.fromFileUrl(new URL("./ifrfs/tree", import.meta.url));
    const rows = await pdfsIn(tree);
    assert(rows.length > 0, "the tree has books with PDFs");
    assertEquals(same.kind, "ok");
    assertEquals(markdown.kind, "ok");
  },
);
