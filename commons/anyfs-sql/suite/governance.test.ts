/**
 * Tests of the governance of the SQL stores (commons anyfs-sql 0002-sql-governance FR-001 to FR-004): the dialects and their limits, the names of the tables, the documented layout and the media types of names.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { DEFAULT_MAX_OBJECT, DIALECTS, HARD_MAX_OBJECT, LAYOUT, MIGRATION_PLAN, SCHEMA_VERSION, TABLE_ROLES, defaultMaxObject, isDialect, mediaTypeOf, parseNaming, parseWord, tableOf } from "../src/governance/mod.ts";
import { sqlFor } from "../src/physical/mod.ts";
import { migrate } from "../src/physical/mod.ts";
import { sqliteMemory } from "./kit.ts";

proves(["0002-sql-governance FR-001"], "the dialects are three, each with a hard limit, and the default largest object is 64 MiB and below every limit", () => {
  assertEquals([...DIALECTS], ["sqlite", "postgres", "duckdb"]);
  assert(isDialect("sqlite") && !isDialect("oracle"));
  for (const d of DIALECTS) {
    assertEquals(defaultMaxObject(d), 64 * 1024 * 1024);
    assert(HARD_MAX_OBJECT[d] > DEFAULT_MAX_OBJECT);
  }
});

proves(["0002-sql-governance FR-002"], "a word of a name is lower case letters, digits and underscores from a letter, the default prefix is anyfs, and the table of a role is the prefix, an underscore and the role", () => {
  for (const bad of ["Fleet", "1a", "a-b", "", "a b", 'a"b', "x".repeat(33), "é"]) assertEquals(parseWord(bad).kind, "err", bad);
  assertEquals(parseWord("fleet_2").kind, "ok");
  const n = parseNaming();
  assert(n.kind === "ok");
  assertEquals(TABLE_ROLES.map((r) => tableOf(n.value, r)), ["anyfs_meta", "anyfs_objects", "anyfs_revisions", "anyfs_search"]);
  const s = parseNaming({ prefix: "fleet", schema: "ops" });
  assert(s.kind === "ok" && s.value.schema === "ops");
  assertEquals(parseNaming({ prefix: "Bad" }).kind, "err");
  assertEquals(parseNaming({ schema: "no way" }).kind, "err");
});

proves(["0002-sql-governance FR-003"], "the layout is documented column by column and agrees with the tables the migrations make, and the plan of the migrations lists each version in order", async () => {
  assertEquals(SCHEMA_VERSION, 2);
  assertEquals(MIGRATION_PLAN.map((m) => m.version), [1, 2]);
  assert(MIGRATION_PLAN.every((m) => !m.destructive));
  const port = await sqliteMemory();
  const n = parseNaming();
  assert(n.kind === "ok");
  const made = await migrate(port, n.value, { search: "auto" });
  assert(made.kind === "ok" && made.value.version === 2);
  const sql = sqlFor("sqlite", n.value);
  for (const role of ["meta", "objects", "revisions"] as const) {
    const rows = await port.query(`PRAGMA table_info(${sql.table(role)})`, []);
    const have = rows.map((r) => String(r["name"]));
    assertEquals(have, LAYOUT.filter((c) => c.table === role).map((c) => c.column), role);
  }
  const search = await port.query(`PRAGMA table_info(${sql.table("search")})`, []);
  assertEquals(search.map((r) => String(r["name"])), LAYOUT.filter((c) => c.table === "search").map((c) => c.column));
  assert(LAYOUT.every((c) => c.means.length > 5 && c.since >= 1 && c.since <= SCHEMA_VERSION));
});

proves(["0002-sql-governance FR-004"], "the media type of a path is the one its last extension says, none for a name with no known extension, and nothing is read from bytes", () => {
  assertEquals(mediaTypeOf("a/b.json"), "application/json");
  assertEquals(mediaTypeOf("a/b.JSON"), "application/json");
  assertEquals(mediaTypeOf("fleet/olympia/asset.yaml"), "application/yaml");
  assertEquals(mediaTypeOf("README"), undefined);
  assertEquals(mediaTypeOf(".json"), undefined);
  assertEquals(mediaTypeOf("a.unknownext"), undefined);
  assertEquals(mediaTypeOf("a.json/b"), undefined);
  assertEquals(mediaTypeOf("a/__proto__"), undefined);
  assertEquals(mediaTypeOf("a/x.constructor"), undefined);
});
