// Spec: 0009-sql-features FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017, FR-018
/**
 * The feature extensions (commons data 0009-sql-features), on real engines: views, access (row-level security and grants), routines, partitions and vectors each do what they say on the engines
 * that can, and are an error value, or carried as data, on those that cannot.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import {
  annotate,
  attribute,
  concept,
  date,
  domain,
  identifier,
  instant,
  integer,
  relationship,
  text,
  vector,
  vocabularies,
} from "@intellectual-frontiers/data/governance";
import { dialect as duckdb } from "@intellectual-frontiers/data/sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { accessSource, scopeStatement, sealedScope } from "@intellectual-frontiers/data/sql/extensions/access";
import { sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";
import { partitions } from "@intellectual-frontiers/data/sql/extensions/partitions";
import { column, columnName, param, routinesSource, table } from "@intellectual-frontiers/data/sql/extensions/routines";
import { viewsSource } from "@intellectual-frontiers/data/sql/extensions/views";
import {
  bind,
  type BindOptions,
  camel,
  type Dialect,
  GROUPS,
  naming,
  type PhysicalError,
  render,
} from "@intellectual-frontiers/data/sql/physical";
import { type Engine, load, openEngine, refuses } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { projected } from "./logical-fixture.ts";

const { security } = vocabularies;

const author = concept("author", {
  definition: "Someone who writes",
  attributes: {
    id: attribute(identifier(), { definition: "What identifies it" }),
    name: attribute(text(), { definition: "What it is called" }),
    retiredAt: attribute(instant(), { definition: "When it stopped", multiplicity: "optional" }),
  },
  identifiedBy: ["id"],
});
const book = concept("book", {
  definition: "A written work",
  attributes: {
    id: attribute(identifier(), { definition: "What identifies it" }),
    title: attribute(text(), { definition: "What it is called" }),
    pages: attribute(integer(), { definition: "How long it is" }),
  },
  identifiedBy: ["id"],
  relationships: { author: relationship(author, { cardinality: "one", definition: "Who wrote it" }) },
});
const document = concept("document", {
  definition: "A paper kept for a tenant",
  attributes: {
    id: attribute(identifier(), { definition: "What identifies it" }),
    tenant: attribute(text(), { definition: "Whose it is", annotations: [annotate(security.scope, { name: "tenant" })] }),
    title: attribute(text(), { definition: "What it is called" }),
  },
  identifiedBy: ["id"],
  annotations: [annotate(security.access, { read: ["reader", "writer"], write: ["writer"] })],
});
const ledger = concept("ledger", {
  definition: "A paper anyone with a role may read",
  attributes: { id: attribute(identifier(), { definition: "What identifies it" }) },
  identifiedBy: ["id"],
  annotations: [annotate(security.access, { read: ["reader"], write: [] })],
});
const event = concept("event", {
  definition: "Something that happened",
  attributes: {
    id: attribute(identifier(), { definition: "What identifies it" }),
    happenedOn: attribute(date(), { definition: "The day" }),
  },
  identifiedBy: ["id", "happenedOn"],
});
const note = concept("note", {
  definition: "A text with its embedding",
  attributes: {
    id: attribute(identifier(), { definition: "What identifies it" }),
    embedding: attribute(vector(3), { definition: "Where it stands among other texts" }),
  },
  identifiedBy: ["id"],
});

const schemaOf = (...concepts: Parameters<typeof domain>[1]["concepts"]) => {
  const d = domain("features", { definition: "Features", concepts });
  if (d.kind === "err") throw new Error(JSON.stringify(d.error));
  return projected(d.value).schema;
};
const must = (dialect: Dialect, schema: ReturnType<typeof schemaOf>, options: Omit<BindOptions, "dialect"> = {}) => {
  const r = bind(schema, { dialect, ...options });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const errorsOf = (
  dialect: Dialect,
  schema: ReturnType<typeof schemaOf>,
  options: Omit<BindOptions, "dialect">,
): readonly PhysicalError[] => {
  const r = bind(schema, { dialect, ...options });
  if (r.kind === "ok") throw new Error("the binding did not fail");
  return r.error;
};
const whys = (e: readonly PhysicalError[]): string[] => e.map((x) => (x.kind === "unsupported" ? x.why : x.kind));
const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};

proves(
  ["0009-sql-features FR-001", "0009-sql-features FR-002"],
  "the groups run setup first and policy last, and the dialects name the features they have",
  () => {
    same(GROUPS, ["setup", "table", "constraint", "index", "data", "view", "routine", "documentation", "policy"]);
    for (const f of ["or-replace-view", "row-security", "grants", "routines", "partitions"] as const)
      assert(postgres.features.includes(f), f);
    assert(duckdb.features.includes("or-replace-view") && !duckdb.features.includes("routines"));
    assert(!sqlite.features.includes("routines") && !sqlite.features.includes("grants"));
  },
);

proves(
  ["0009-sql-features FR-016", "0009-sql-features FR-003", "0009-sql-features FR-017", "0009-sql-features FR-018"],
  "a vector is VECTOR(n) after the extension is made on PostgreSQL, FLOAT[n] on DuckDB where it is stored and read back, and refused on SQLite; zero dimensions is an error value",
  async () => {
    const schema = schemaOf(note);
    const pg = must(postgres, schema);
    same(pg.statements[0]?.group, "setup");
    same(pg.statements[0]?.sql, "CREATE EXTENSION IF NOT EXISTS vector;");
    assert(render(pg).includes('"embedding" VECTOR(3) NOT NULL'));
    assert(!render(must(postgres, schemaOf(author))).includes("CREATE EXTENSION"), "no vector, no extension");
    const lite = errorsOf(sqlite, schema, {});
    same(whys(lite), ["SQLite has no vector type"]);
    const d = must(duckdb, schema);
    assert(render(d).includes('"embedding" FLOAT[3] NOT NULL'));
    await withEngine("duckdb", async (e) => {
      await load(e, d);
      await e.run(`INSERT INTO "note" VALUES ('n1', [1.5, 2.5, 3.5])`);
      const rows = await e.rows(`SELECT embedding FROM "note"`);
      same(rows[0]?.["embedding"], [1.5, 2.5, 3.5]);
      assert(await refuses(e, `INSERT INTO "note" VALUES ('n2', [1.0, 2.0])`), "the engine refuses the wrong dimensions");
    });
    for (const bad of [0, -1, 1.5]) {
      const r = domain("bad", {
        definition: "d",
        concepts: [
          concept("n", {
            definition: "n",
            attributes: { id: attribute(identifier(), { definition: "i" }), v: attribute(vector(bad), { definition: "v" }) },
            identifiedBy: ["id"],
          }),
        ],
      });
      assert(r.kind === "err" && r.error.some((e) => e.kind === "dimensions" && e.dimensions === bad), `${bad} dimensions`);
    }
  },
);

const personView = {
  name: "activeAuthor",
  description: "The authors who have not stopped, with their books",
  from: "author",
  joins: [
    {
      table: "book",
      on: [
        { table: "book", column: "authorId" },
        { table: "author", column: "id" },
      ] as const,
    },
  ],
  columns: [
    { table: "author", column: "id" },
    { table: "author", column: "name", as: "authorName" },
    { table: "book", column: "title" },
  ],
  where: [{ table: "author", column: "retiredAt", is: "null" as const }],
};

proves(
  ["0009-sql-features FR-005", "0009-sql-features FR-006", "0009-sql-features FR-018"],
  "a view returns the rows its conditions give on all three engines, is made again without error, and has its description as a comment where the dialect has them",
  async () => {
    const schema = schemaOf(author, book);
    for (const name of ["sqlite", "duckdb", "postgres"] as const) {
      await withEngine(name, async (e) => {
        const p = must(e.dialect, schema, { sources: [viewsSource([personView])] });
        const sql = render(p);
        assert(sql.includes("AS\nSELECT"));
        assert(e.dialect.features.includes("or-replace-view") === sql.includes("CREATE OR REPLACE VIEW"), "replace or drop");
        assert(e.dialect.features.includes("comment-on") === sql.includes("COMMENT ON VIEW"), "comment where it can be");
        await load(e, p);
        await load(e, p, ["view"]);
        await e.run(`INSERT INTO "author" ("id", "name", "retired_at") VALUES ('a1', 'Ann', NULL), ('a2', 'Bo', CURRENT_TIMESTAMP)`);
        await e.run(`INSERT INTO "book" ("id", "title", "pages", "author_id") VALUES ('b1', 'One', 10, 'a1'), ('b2', 'Two', 20, 'a2')`);
        const rows = await e.rows(`SELECT * FROM "active_author"`);
        same(rows, [{ id: "a1", author_name: "Ann", title: "One" }]);
      });
    }
    const camelSql = render(must(sqlite, schema, { naming: naming(camel), sources: [viewsSource([personView])] }));
    assert(camelSql.includes('CREATE VIEW "activeAuthor" ("id", "authorName", "title")'));
  },
);

proves(
  ["0009-sql-features FR-007"],
  "a view that names what the schema does not have, shows no column, or is a table's name is an error value naming it, and a statement carries what it reads",
  () => {
    const schema = schemaOf(author, book);
    const run = (v: unknown) => whys(errorsOf(sqlite, schema, { sources: [viewsSource([v as typeof personView])] }));
    assert(run({ ...personView, from: "nope" })[0]?.includes("no table nope"));
    assert(run({ ...personView, columns: [{ table: "author", column: "nope" }] })[0]?.includes("no column nope"));
    assert(run({ ...personView, columns: [] })[0]?.includes("shows no column"));
    assert(run({ ...personView, name: "author" })[0]?.includes("is the name of a table"));
    const p = must(sqlite, schema, { sources: [viewsSource([personView])] });
    const view = p.statements.find((s) => s.sql.startsWith("CREATE VIEW"));
    assert(view !== undefined && view.of.length >= 4 && view.of.some((i) => i.startsWith("table:author")));
  },
);

proves(
  ["0009-sql-features FR-008", "0009-sql-features FR-009", "0009-sql-features FR-018"],
  "a scoped table shows a role only the rows of its scope and refuses it another's, grants follow the roles, and applying twice leaves the same policies",
  async () => {
    const schema = schemaOf(document, ledger);
    await withEngine("postgres", async (e) => {
      const p = must(postgres, schema, { sources: [accessSource()] });
      await e.run("CREATE ROLE reader; CREATE ROLE writer;");
      await load(e, p);
      await load(e, p, ["policy"]);
      const policies = await e.rows(`SELECT policyname, cmd FROM pg_policies WHERE tablename = 'document' ORDER BY policyname`);
      same(
        policies.map((r) => r["policyname"]),
        ["document_tenant_delete", "document_tenant_insert", "document_tenant_select", "document_tenant_update"],
      );
      await e.run(`INSERT INTO "document" VALUES ('d1', 'a', 'Alpha'), ('d2', 'b', 'Beta')`);
      await e.run("SET ROLE reader");
      await e.run("SET app.tenant = 'a'");
      same(
        (await e.rows(`SELECT id FROM "document"`)).map((r) => r["id"]),
        ["d1"],
      );
      await e.run("SET app.tenant = 'b'");
      same(
        (await e.rows(`SELECT id FROM "document"`)).map((r) => r["id"]),
        ["d2"],
      );
      assert(await refuses(e, `INSERT INTO "document" VALUES ('d3', 'b', 'x')`), "a reader may not write");
      await e.run("RESET ROLE");
      await e.run("SET ROLE writer");
      await e.run("SET app.tenant = 'a'");
      await e.run(`INSERT INTO "document" VALUES ('d4', 'a', 'Mine')`);
      assert(await refuses(e, `INSERT INTO "document" VALUES ('d5', 'b', 'Theirs')`), "a row of another scope is refused");
      assert(await refuses(e, `UPDATE "document" SET "tenant" = 'b' WHERE "id" = 'd4'`), "a row cannot be moved to another scope by an update");
      await e.run("RESET ROLE");
      const grants = await e.rows(
        `SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'ledger' AND grantee IN ('reader','writer')`,
      );
      same(grants, [{ grantee: "reader", privilege_type: "SELECT" }]);
      const sql = render(p);
      assert(sql.includes('GRANT SELECT ON "document" TO "reader", "writer";'));
      assert(!sql.includes('ALTER TABLE "ledger"'), "no scope, no row-level security");
    });
  },
);

proves(
  ["0009-sql-features FR-019"],
  "a sealed scope is trusted only with the mark of the issuer that holds the key: a session that sets the scope itself, forges its mark or reuses another's sees nothing, cannot read the key or make a mark, and the owner of the table cannot weaken row security without the unlock secret",
  async () => {
    const KEY = "issuer-key-kept-outside-the-database";
    const UNLOCK = "unlock-secret";
    const schema = schemaOf(document, ledger);
    await withEngine("postgres", async (e) => {
      const p = must(postgres, schema, { sources: [accessSource({ seal: { key: KEY, unlock: sha256Hex(UNLOCK) } })] });
      await e.run("CREATE ROLE reader; CREATE ROLE writer;");
      await load(e, p);
      await e.run(`INSERT INTO "document" VALUES ('d1', 'a', 'Alpha'), ('d2', 'b', 'Beta')`);
      const ids = async () => (await e.rows(`SELECT id FROM "document" ORDER BY id`)).map((r) => r["id"]);
      await e.run("SET ROLE reader");
      await e.run("SET app.tenant = 'a'");
      same(await ids(), [], "a scope the session set itself is not trusted");
      await e.run("SET app.tenant = 'a.0000000000000000000000000000000000000000000000000000000000000000'");
      same(await ids(), [], "a forged mark is not trusted");
      await e.run(scopeStatement(KEY, "tenant", "a", "app", false));
      same(await ids(), ["d1"], "the issuer's mark is");
      await e.run(`SET app.tenant = 'b.${sealedScope(KEY, "tenant", "a").slice(2)}'`);
      same(await ids(), [], "the mark of one value is not the mark of another");
      await e.run(scopeStatement(KEY, "tenant", "b", "app", false));
      same(await ids(), ["d2"]);
      assert(await refuses(e, `SELECT "secret" FROM "ifc_seal"."key"`), "the key cannot be read");
      assert(await refuses(e, `SELECT "ifc_seal"."mac"('tenant=a')`), "a mark cannot be made");
      assert(await refuses(e, `INSERT INTO "ifc_seal"."key" VALUES (true, 'mine')`), "the key cannot be replaced");
      await e.run("RESET ROLE");
      for (const attack of [
        `ALTER TABLE "document" DISABLE ROW LEVEL SECURITY`,
        `ALTER TABLE "document" NO FORCE ROW LEVEL SECURITY`,
        `DROP POLICY "document_tenant_select" ON "document"`,
        `DROP TABLE "document" CASCADE`,
      ])
        assert(await refuses(e, attack), `refused: ${attack}`);
      await e.run(`SELECT set_config('ifc.ddl_unlock', '${UNLOCK}', false)`);
      await e.run(`DROP POLICY "document_tenant_select" ON "document"`);
    });
  },
);

proves(
  ["0009-sql-features FR-010"],
  "where the dialect lacks the feature nothing is written and the annotation is left to the governance tables, unless the setting says error",
  () => {
    const schema = schemaOf(document, ledger);
    const quiet = must(sqlite, schema, { sources: [accessSource()] });
    assert(!quiet.statements.some((s) => s.group === "policy"));
    const loud = errorsOf(sqlite, schema, { sources: [accessSource({ unsupported: "error" })] });
    assert(whys(loud).some((w) => w.includes("security.scope")) && whys(loud).some((w) => w.includes("security.access")));
    const prefixed = render(must(postgres, schema, { sources: [accessSource({ settingPrefix: "myapp" })] }));
    assert(prefixed.includes("current_setting('myapp.tenant', true)"));
  },
);

proves(
  ["0009-sql-features FR-011", "0009-sql-features FR-012", "0009-sql-features FR-013", "0009-sql-features FR-018"],
  "a routine is made with the names the case style writes, runs on PostgreSQL and returns what its body says, and has a comment with its parameter types",
  async () => {
    const schema = schemaOf(author);
    const defs = [
      {
        kind: "procedure" as const,
        name: "retireAuthor",
        description: "Marks an author as stopped",
        params: [{ name: "who", type: { kind: "text" as const } }],
        language: "plpgsql" as const,
        body: [
          "BEGIN\n    UPDATE ",
          table("author"),
          " SET ",
          columnName("author", "retiredAt"),
          " = CURRENT_TIMESTAMP WHERE ",
          column("author", "id"),
          " = ",
          param("who"),
          ";\nEND;",
        ],
      },
      {
        kind: "function" as const,
        name: "authorCount",
        description: "How many authors there are",
        returns: { type: { kind: "integer" as const } },
        language: "sql" as const,
        volatility: "stable" as const,
        body: ["SELECT count(*)::int FROM ", table("author")],
      },
      {
        kind: "function" as const,
        name: "namesOf",
        description: "The authors",
        returns: { setOf: "author" },
        language: "sql" as const,
        body: ["SELECT * FROM ", table("author")],
      },
    ];
    await withEngine("postgres", async (e) => {
      const p = must(postgres, schema, { sources: [routinesSource(defs)] });
      await load(e, p);
      await load(e, p, ["routine"]);
      await e.run(`INSERT INTO "author" VALUES ('a1', 'Ann', NULL)`);
      same((await e.rows(`SELECT "author_count"() AS n`))[0]?.["n"], 1);
      await e.run(`CALL "retire_author"('a1')`);
      assert((await e.rows(`SELECT retired_at FROM "author"`))[0]?.["retired_at"] !== null);
      same((await e.rows(`SELECT id FROM "names_of"()`)).length, 1);
      const comment = await e.rows(`SELECT obj_description('"retire_author"(text)'::regprocedure, 'pg_proc') AS c`);
      same(comment[0]?.["c"], "Marks an author as stopped");
      assert(render(p).includes('"retire_author"."who"'), "a parameter is written with the routine's name");
    });
    same(whys(errorsOf(duckdb, schema, { sources: [routinesSource(defs)] })).length, 3);
    assert(whys(errorsOf(duckdb, schema, { sources: [routinesSource(defs)] }))[0]?.includes("has no routines"));
    const bad = errorsOf(postgres, schema, {
      sources: [
        routinesSource([
          { ...defs[1]!, name: "x", body: [table("nope"), column("author", "nope"), param("nope")] },
          { ...defs[1]!, name: "y", returns: { setOf: "nope" } },
        ]),
      ],
    });
    assert(whys(bad).length >= 4 && whys(bad).every((w) => w.startsWith("the routine")));
  },
);

proves(
  ["0009-sql-features FR-004", "0009-sql-features FR-014", "0009-sql-features FR-018"],
  "a partitioned table keeps each row in the partition of its bounds and refuses one that has none",
  async () => {
    const schema = schemaOf(event);
    const division = {
      table: "event",
      key: ["happenedOn"],
      strategy: "range" as const,
      partitions: [
        { name: "y2025", from: ["2025-01-01"], to: ["2026-01-01"] },
        { name: "y2026", from: ["2026-01-01"], to: ["2027-01-01"] },
      ],
    };
    await withEngine("postgres", async (e) => {
      const { clause, source } = partitions([division]);
      const p = must(postgres, schema, { sources: [source], tableClauses: [clause] });
      assert(render(p).includes('PARTITION BY RANGE ("happened_on");'));
      await load(e, p);
      await load(e, p);
      await e.run(`INSERT INTO "event" VALUES ('e1', '2025-06-01'), ('e2', '2026-02-01')`);
      same(
        (await e.rows(`SELECT id FROM "event_y_2025"`)).map((r) => r["id"]),
        ["e1"],
      );
      same(
        (await e.rows(`SELECT id FROM "event_y_2026"`)).map((r) => r["id"]),
        ["e2"],
      );
      assert(await refuses(e, `INSERT INTO "event" VALUES ('e3', '2030-01-01')`), "no partition for the row");
    });
    await withEngine("postgres", async (e) => {
      const lists = partitions([{ table: "event", key: ["id"], strategy: "list", partitions: [{ name: "low", values: ["a"] }] }]);
      const hashes = partitions([
        {
          table: "event",
          key: ["id"],
          strategy: "hash",
          partitions: [
            { name: "zero", modulus: 2, remainder: 0 },
            { name: "one", modulus: 2, remainder: 1 },
          ],
        },
      ]);
      const l = must(postgres, schema, { sources: [lists.source], tableClauses: [lists.clause] });
      assert(render(l).includes("PARTITION BY LIST") && render(l).includes("FOR VALUES IN ('a')"));
      const h = must(postgres, schema, { sources: [hashes.source], tableClauses: [hashes.clause] });
      assert(render(h).includes("WITH (MODULUS 2, REMAINDER 1)"));
      await load(e, h);
      await e.run(`INSERT INTO "event" VALUES ('x', '2025-01-01'), ('y', '2025-01-01')`);
      same(Number((await e.rows(`SELECT count(*) AS n FROM "event"`))[0]?.["n"]), 2);
    });
  },
);

proves(
  ["0009-sql-features FR-015"],
  "a division whose key is not a column, is not in the primary key, or whose dialect cannot partition is an error value naming the table",
  () => {
    const schema = schemaOf(event);
    const of = (key: readonly string[]) =>
      partitions([{ table: "event", key, strategy: "list" as const, partitions: [{ name: "a", values: ["a"] }] }]);
    const run = (dialect: Dialect, key: readonly string[]) => {
      const x = of(key);
      return whys(errorsOf(dialect, schema, { sources: [x.source], tableClauses: [x.clause] }));
    };
    assert(run(postgres, ["nope"])[0]?.includes("no column nope"));
    assert(run(postgres, ["nope"]).length === 1, "reported once");
    assert(run(postgres, [])[0]?.includes("no key"));
    assert(run(sqlite, ["id"])[0]?.includes("sqlite has no partitions"));
    const keyless = concept("keyless", {
      definition: "k",
      attributes: {
        id: attribute(identifier(), { definition: "i" }),
        other: attribute(text(), { definition: "o" }),
      },
      identifiedBy: ["id"],
    });
    const x = partitions([{ table: "keyless", key: ["other"], strategy: "list", partitions: [{ name: "a", values: ["a"] }] }]);
    assert(
      whys(errorsOf(postgres, schemaOf(keyless), { sources: [x.source], tableClauses: [x.clause] }))[0]?.includes("not in the primary key"),
    );
  },
);
