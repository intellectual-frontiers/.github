// Spec: 0007-physical FR-014
/**
 * References for text written by people (commons data 0007-physical FR-014): names by words, in any case style, qualified as the schema is, and what is not there an error as a value.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { naming, refsOf } from "@intellectual-frontiers/data/sql/physical";
import { same } from "./governance-fixture.ts";
import { libraryAt } from "./lifecycle-fixture.ts";

proves(
  ["0007-physical FR-014"],
  "the written names of tables and columns are given by words in any case style, qualified where the schema is, and a name that is not there is an error value, the tables asked for being kept in order",
  () => {
    const kit = refsOf(libraryAt(2), postgres, naming(), "data");
    same(kit.refs.table("author"), '"data"."author"');
    same(kit.refs.table("Author"), '"data"."author"');
    same(kit.refs.column("author", "born"), '"born"');
    same(kit.refs.own("load ledger"), '"data"."load_ledger"');
    same(kit.used(), [{ name: "author", via: "schema" }]);
    assert(kit.errors().length === 0);
    kit.refs.table("nope");
    kit.refs.column("author", "shoe");
    same(kit.errors(), [{ kind: "unknown-table", name: "nope" }, { kind: "unknown-column", table: "author", column: "shoe" }]);
    const prefixed = refsOf(libraryAt(2), sqlite, naming(), "data", (n) => (n === "model" ? '"m"' : undefined));
    same([prefixed.refs.table("author"), prefixed.refs.table("model"), prefixed.refs.own("x")], ['"data_author"', '"m"', '"data_x"']);
    same(prefixed.used(), [{ name: "author", via: "schema" }, { name: "model", via: "relation" }]);
  },
);
