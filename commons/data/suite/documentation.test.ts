// Spec: 0008-sql-documentation FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * The documentation extensions (commons data 0008-sql-documentation), on real engines: the comments are kept by PostgreSQL and DuckDB under the descriptions of governance; SQLite, which has no
 * comment, gets a table of them; the governance tables hold every annotation and the trace of each table and column; the settings and the composition switch each off; a load is whole and
 * run twice leaves the same rows; and a table of the schema that has a name of an extension is an error value.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import { compose } from "@intellectual-frontiers/data/engine";
import { attribute, concept, elementsOf, identifier, text } from "@intellectual-frontiers/data/governance";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import {
  defaultDocumentation,
  defaults,
  documentationSources,
  settingsOf,
} from "@intellectual-frontiers/data/sql/extensions/documentation";
import { bind, camel, type Dialect, naming, type Physical, sourcesFrom } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, type Engine, load, openEngine, type Row } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { arcaDomain, arcaSchema, projected, snake, tableOf, world } from "./logical-fixture.ts";

const boundFor = (dialect: Dialect, given: Parameters<typeof documentationSources>[0] = {}, n = naming()): Physical => {
  const r = bind(arcaSchema(), { dialect, naming: n, sources: documentationSources(given) });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};
const tableNames = async (e: Engine): Promise<string[]> => {
  switch (e.name) {
    case "sqlite":
      return (await e.rows("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => String(r["name"])).sort();
    case "duckdb":
      return (await e.rows("SELECT table_name n FROM duckdb_tables()")).map((r) => String(r["n"])).sort();
    case "postgres":
      return (await e.rows("SELECT table_name n FROM information_schema.tables WHERE table_schema = 'public'"))
        .map((r) => String(r["n"]))
        .sort();
  }
};
/** A JSON value as the engine returns it: PGlite has decoded a JSONB, the others give the text. */
const decoded = (e: Engine, v: unknown): unknown => (e.name === "postgres" ? v : JSON.parse(String(v)));
const count = async (e: Engine, table: string): Promise<number> => Number((await e.rows(`SELECT COUNT(*) AS n FROM "${table}"`))[0]?.["n"]);

/** The comment of every table and column that the engine holds, by `table` and `table.column`. */
const commentsHeld = async (e: Engine): Promise<Record<string, string>> => {
  const out: Record<string, string> = {};
  const rows: Row[] =
    e.name === "postgres"
      ? [
          ...(await e.rows(
            "SELECT c.relname AS k, obj_description(c.oid, 'pg_class') AS d FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'",
          )),
          ...(await e.rows(
            "SELECT c.relname || '.' || a.attname AS k, col_description(c.oid, a.attnum) AS d FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 WHERE n.nspname = 'public' AND c.relkind = 'r'",
          )),
        ]
      : [
          ...(await e.rows("SELECT table_name AS k, comment AS d FROM duckdb_tables()")),
          ...(await e.rows("SELECT table_name || '.' || column_name AS k, comment AS d FROM duckdb_columns() WHERE NOT internal")),
        ];
  for (const r of rows) if (r["d"] !== null && r["d"] !== undefined) out[String(r["k"])] = String(r["d"]);
  return out;
};

proves(
  ["0008-sql-documentation FR-001", "0008-sql-documentation FR-004"],
  "PostgreSQL and DuckDB keep the description of every table and column as a comment, as governance wrote it, and SQLite is given none",
  async () => {
    const s = arcaSchema();
    const want: Record<string, string> = {};
    for (const t of s.tables) {
      want[snake(t.name)] = t.comment;
      for (const c of t.columns) if (c.comment.trim() !== "") want[`${snake(t.name)}.${snake(c.name)}`] = c.comment;
    }
    for (const name of ["postgres", "duckdb"] as const) {
      const dialect = DIALECTS.find((d) => d.name === name)?.dialect as Dialect;
      await withEngine(name, async (e) => {
        await load(e, boundFor(dialect));
        const held = await commentsHeld(e);
        for (const [k, v] of Object.entries(want)) same(held[k], v, `${name}: ${k}`);
      });
    }
    same(
      boundFor(sqlite).statements.filter((x) => x.sql.startsWith("COMMENT")),
      [],
    );
    const person = tableOf(s, "person");
    same(want["person.given_name"], person.columns.find((c) => snake(c.name) === "given_name")?.comment);
    same(want["person.given_name"], "The name a person is given, as they write it");
    assert(
      !JSON.stringify(boundFor(postgres).statements.filter((x) => x.sql.startsWith("COMMENT"))).includes("privacy"),
      "no machine-readable governance in a comment",
    );
  },
);

proves(
  ["0008-sql-documentation FR-001"],
  "a description with a quote is written with the quote doubled, a column with none has no comment",
  async () => {
    const c = concept("quoted", {
      definition: "It's a thing",
      attributes: { id: attribute(identifier(), { definition: "What identifies it" }), note: attribute(text(), { definition: "" }) },
      identifiedBy: ["id"],
    });
    const p = bind(projected(world([c], [])).schema, { dialect: postgres, sources: documentationSources({ governanceTables: "off" }) });
    assert(p.kind === "ok");
    if (p.kind !== "ok") return;
    const comments = p.value.statements.filter((x) => x.sql.startsWith("COMMENT")).map((x) => x.sql);
    same(comments, [`COMMENT ON TABLE "quoted" IS 'It''s a thing';`, `COMMENT ON COLUMN "quoted"."id" IS 'What identifies it';`]);
  },
);

proves(
  ["0008-sql-documentation FR-002", "0008-sql-documentation FR-005", "0001-layers FR-007"],
  "the documentation table is made where there is no comment, everywhere, or nowhere, as its setting says",
  async () => {
    const s = arcaSchema();
    const rows = s.tables.reduce(
      (n, t) => n + (t.comment.trim() === "" ? 0 : 1) + t.columns.filter((c) => c.comment.trim() !== "").length,
      0,
    );
    await withEngine("sqlite", async (e) => {
      await load(e, boundFor(sqlite));
      assert((await tableNames(e)).includes("documentation"));
      same(await count(e, "documentation"), rows);
      const row = (await e.rows(`SELECT description FROM "documentation" WHERE table_name = 'person' AND column_name = 'given_name'`))[0];
      same(row?.["description"], "The name a person is given, as they write it");
      const table = (await e.rows(`SELECT description FROM "documentation" WHERE table_name = 'person' AND column_name = ''`))[0];
      same(table?.["description"], "A party who is a human being; what is true of a person and not of every party");
    });
    await withEngine("postgres", async (e) => {
      await load(e, boundFor(postgres));
      assert(!(await tableNames(e)).includes("documentation"), "PostgreSQL has COMMENT ON, so no table by default");
    });
    await withEngine("postgres", async (e) => {
      await load(e, boundFor(postgres, { documentationTables: "always" }));
      same(await count(e, "documentation"), rows);
      assert(Object.keys(await commentsHeld(e)).length > 0, "and the comments too");
    });
    await withEngine("sqlite", async (e) => {
      await load(e, boundFor(sqlite, { documentationTables: "never" }));
      assert(!(await tableNames(e)).includes("documentation"));
    });
    same([settingsOf().comments, settingsOf().documentationTables, settingsOf().governanceTables], ["dialect", "when-no-comment", "on"]);
    same(settingsOf({ documentationTables: "always", names: { documentation: "docs" } }).names, {
      documentation: "docs",
      governanceAnnotation: "governanceAnnotation",
      governanceTrace: "governanceTrace",
    });
    same(defaults, settingsOf());
    assert(boundFor(postgres, { comments: "never" }).statements.every((x) => !x.sql.startsWith("COMMENT")));
  },
);

for (const { name, dialect } of DIALECTS) {
  proves(
    ["0008-sql-documentation FR-003", "0008-sql-documentation FR-009"],
    `${name}: the governance tables hold every annotation of the domain and the trace of every table and column`,
    async () => {
      const d = arcaDomain();
      const annotations = elementsOf(d).flatMap((el) =>
        el.annotations.map((a, position) => ({ element: String(el.id), position, kind: a.kind, value: a.value })),
      );
      await withEngine(name, async (e) => {
        await load(e, boundFor(dialect));
        same(await count(e, "governance_annotation"), annotations.length);
        const stored = await e.rows(
          `SELECT element_id, position, annotation, value FROM "governance_annotation" ORDER BY element_id, position`,
        );
        same(
          stored.map((r) => [String(r["element_id"]), Number(r["position"]), String(r["annotation"]), decoded(e, r["value"])]),
          [...annotations]
            .sort((a, b) => (a.element === b.element ? a.position - b.position : a.element < b.element ? -1 : 1))
            .map((a) => [a.element, a.position, a.kind, JSON.parse(JSON.stringify(a.value))]),
        );
        const personal = await e.rows(
          `SELECT value FROM "governance_annotation" WHERE element_id = 'arcaParty/person.givenName' AND annotation = 'privacy.personal'`,
        );
        same(decoded(e, personal[0]?.["value"]), { category: "Name", purposes: ["address the person by name"] });
        const s = arcaSchema();
        same(
          await count(e, "governance_trace"),
          s.tables.reduce((n, t) => n + 1 + t.columns.length, 0),
        );
        const given = await e.rows(
          `SELECT element_id, logical_id FROM "governance_trace" WHERE table_name = 'person' AND column_name = 'given_name'`,
        );
        same([given[0]?.["element_id"], given[0]?.["logical_id"]], ["arcaParty/person.givenName", "column:person/given.name"]);
        const table = await e.rows(`SELECT element_id FROM "governance_trace" WHERE table_name = 'person' AND column_name = ''`);
        same(table[0]?.["element_id"], "arcaParty/person");
        const closed = await e.rows(
          `SELECT annotation FROM "governance_annotation" WHERE element_id = 'arcaParty/list:contactMedium' ORDER BY position`,
        );
        same(
          closed.map((r) => r["annotation"]),
          ["quality.openness", "requirements.cites"],
        );
      });
    },
  );

  proves(
    ["0008-sql-documentation FR-008"],
    `${name}: a load is whole, run twice it leaves the same rows, and what changed or is gone is not read as current`,
    async () => {
      await withEngine(name, async (e) => {
        const p = boundFor(dialect);
        await load(e, p);
        const snapshot = async (): Promise<unknown> => ({
          a: await e.rows(`SELECT element_id, position, annotation FROM "governance_annotation" ORDER BY element_id, position`),
          t: await e.rows(`SELECT table_name, column_name, element_id FROM "governance_trace" ORDER BY table_name, column_name`),
        });
        const first = await snapshot();
        await load(e, p, ["data"]);
        same(await snapshot(), first);
        await e.run(`INSERT INTO "governance_annotation" (element_id, position, annotation, value) VALUES ('gone/thing', 0, 'x.y', '1')`);
        await e.run(`UPDATE "governance_trace" SET element_id = 'changed' WHERE table_name = 'person' AND column_name = ''`);
        await load(e, p, ["data"]);
        same(await snapshot(), first, "a row of what is gone is removed and a changed row is restored");
      });
    },
  );
}

proves(
  ["0008-sql-documentation FR-003", "0008-sql-documentation FR-006"],
  "the governance tables are left out by a setting, or by leaving the extension out of the composition",
  () => {
    assert(!boundFor(sqlite, { governanceTables: "off" }).statements.some((x) => x.sql.includes("governance_annotation")));
    const ext = defaultDocumentation();
    assert(ext.kind === "ok");
    if (ext.kind !== "ok") return;
    same(
      ext.value.map((x) => x.id),
      ["sql.documentation.comments", "sql.documentation.tables", "sql.documentation.governance"],
    );
    const all = compose(ext.value);
    assert(all.kind === "ok");
    if (all.kind !== "ok") return;
    same(sourcesFrom(all.value).length, 3);
    const through = bind(arcaSchema(), { dialect: sqlite, sources: sourcesFrom(all.value) });
    assert(through.kind === "ok");
    if (through.kind === "ok") same(through.value.statements, boundFor(sqlite).statements);
    const without = compose(ext.value.filter((x) => x.id !== "sql.documentation.governance"));
    assert(without.kind === "ok");
    if (without.kind !== "ok") return;
    const dropped = bind(arcaSchema(), { dialect: sqlite, sources: sourcesFrom(without.value) });
    assert(
      dropped.kind === "ok" &&
        !dropped.value.statements.some((x) => x.sql.includes("governance_")) &&
        dropped.value.statements.some((x) => x.sql.includes('"documentation"')),
    );
    const tuned = defaultDocumentation({ governanceTables: "off", documentationTables: "never" });
    assert(tuned.kind === "ok");
    if (tuned.kind !== "ok") return;
    const tc = compose(tuned.value);
    assert(tc.kind === "ok");
    if (tc.kind !== "ok") return;
    const quiet = bind(arcaSchema(), { dialect: sqlite, sources: sourcesFrom(tc.value) });
    assert(quiet.kind === "ok" && quiet.value.statements.length === 22);
  },
);

proves(
  ["0008-sql-documentation FR-007"],
  "the tables are made by the physical machinery with the naming of the schema, and a table of the schema with their name is an error value",
  () => {
    const camelCase = boundFor(sqlite, {}, naming(camel));
    const sql = camelCase.statements.map((x) => x.sql).join("\n");
    assert(
      sql.includes('CREATE TABLE IF NOT EXISTS "governanceAnnotation" (') &&
        sql.includes('"elementId" TEXT NOT NULL') &&
        sql.includes('PRIMARY KEY ("elementId", "position")'),
    );
    assert(sql.includes('CREATE TABLE IF NOT EXISTS "documentation" (') && sql.includes('PRIMARY KEY ("tableName", "columnName")'));
    const pg = boundFor(postgres)
      .statements.map((x) => x.sql)
      .join("\n");
    assert(pg.includes('"value" JSONB NOT NULL') && pg.includes('"position" INTEGER NOT NULL'));
    const clash = concept("documentation", {
      definition: "d",
      attributes: { id: attribute(identifier(), { definition: "i" }) },
      identifiedBy: ["id"],
    });
    const r = bind(projected(world([clash], [])).schema, { dialect: sqlite, sources: documentationSources() });
    assert(r.kind === "err");
    if (r.kind === "err")
      same(
        r.error.map((e) => [e.kind, e.kind === "collision" ? e.name : ""]),
        [["collision", "documentation"]],
      );
    const renamed = bind(projected(world([clash], [])).schema, {
      dialect: sqlite,
      sources: documentationSources({ names: { documentation: "docs" } }),
    });
    assert(renamed.kind === "ok", "a project renames the table");
  },
);
