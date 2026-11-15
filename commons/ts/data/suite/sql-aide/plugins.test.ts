/**
 * Typed hooks and plugins: naming, emit, lint, the classification of a change, the sources of an integration, materializations and
 * generators, each passed to a context and to nothing else; the pgvector example plugin; and the command line as a function of a
 * project (commons 0009-sql-aide FR-023, FR-024, FR-046).
 *
 * @module
 */
import { ok } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertStringIncludes, assertThrows, proves } from "../../../runtime/test.ts";
import { partyDocs, partyModel, partyTables } from "../../arca/mod.ts";
import {
  cli,
  context,
  definitions,
  fn,
  from,
  fromSource,
  inspect,
  integer,
  lint,
  mermaidErd,
  model,
  type Plugin,
  pgvectorExtension,
  pgvectorPlugin,
  pk,
  plan,
  postgres,
  readAdapter,
  render,
  scalar,
  type Runner,
  sqlite,
  table,
  text,
  vector,
} from "../../sql-aide/mod.ts";
import { sqliteEngine } from "../helpers.ts";

const kind = table("kind", { code: pk.text(), label: text() });

proves(["0009-sql-aide FR-024", "0009-sql-aide FR-036"], "a plugin may classify a change of a plan again", async () => {
  const engine = await sqliteEngine();
  try {
    const v1 = table("t", { id: pk.text() });
    const v2 = table("t", { id: pk.text(), note: text().nullable() });
    await engine.exec(render(v1.ddl, context({ dialect: sqlite() })));
    const lenient: Plugin = {
      name: "lenient",
      version: "1",
      hooks: { classify: (c) => (c.what === "add-column" && c.text.endsWith("TEXT;") ? { classification: "idempotent" } : undefined) },
    };
    const catalog = await inspect(engine as Runner, context({ dialect: sqlite() }));
    assert(catalog.kind === "ok");
    const plain = await plan({ entities: [v2] }, catalog.value, context({ dialect: sqlite() }));
    const said = await plan({ entities: [v2] }, catalog.value, context({ dialect: sqlite(), plugins: [lenient] }));
    assertEquals([plain.changes[0]?.classification, said.changes[0]?.classification], ["non-idempotent", "idempotent"]);
  } finally {
    await engine.close();
  }
});

proves(["0009-sql-aide FR-024", "0009-sql-aide FR-034"], "a source of an integration may be given by a plugin, by name", async () => {
  const fromCrm = fromSource("kinds_crm", kind, "crm", ["code", "label"]);
  const crm: Plugin = {
    name: "crm",
    version: "1",
    hooks: { sources: [{ name: "crm", read: () => Promise.resolve(ok([{ code: "c", label: "C" }])) }] },
  };
  const lite = context({ dialect: sqlite(), plugins: [crm] });
  const read = await readAdapter(fromCrm, lite);
  assert(read.kind === "ok");
  assertStringIncludes(render(read.value.load, lite), `('c', 'C')`);
  // without the plugin there is no such source, and that is a value
  const none = await readAdapter(fromCrm, context({ dialect: sqlite() }));
  assert(none.kind === "err" && none.error.message === "no plugin of the context gives the source crm");
  const wrong: Plugin = {
    name: "w",
    version: "1",
    hooks: { sources: [{ name: "crm", read: () => Promise.resolve(ok([{ code: "c", label: "C", colour: "red" }])) }] },
  };
  const refused = await readAdapter(fromCrm, context({ dialect: sqlite(), plugins: [wrong] }));
  assert(refused.kind === "err" && refused.error.message.includes("colour"));
});

proves(["0009-sql-aide FR-024", "0009-sql-aide FR-043"], "a plugin may keep a transform model a way of its own", async () => {
  const snapshotted: Plugin = {
    name: "snapshots",
    version: "1",
    hooks: {
      materializations: {
        dated: (query, self, ctx) => {
          const name = self.map((p) => ctx.dialect.quoteName(p)).join(".");
          return `CREATE TABLE IF NOT EXISTS ${name} AS ${render(query as never, ctx as never)};`;
        },
      },
    },
  };
  const labels = model(
    "kind_labels",
    from(kind).select((s) => ({ label: s.kind.label })),
    { materialized: "plugin:dated" },
  );
  const lite = context({ dialect: sqlite(), plugins: [snapshotted] });
  const engine = await sqliteEngine();
  try {
    await engine.exec(render(kind.ddl, lite));
    await engine.exec(`INSERT INTO "kind" VALUES ('a', 'A')`);
    await engine.exec(render(labels.ddl, lite));
    assertEquals(
      (await engine.query(`SELECT "label" FROM "kind_labels"`)).map((r) => r["label"]),
      ["A"],
    );
  } finally {
    await engine.close();
  }
  assertThrows(() => render(labels.ddl, context({ dialect: sqlite() })), Error, "no plugin of the context keeps a model as dated");
});

proves(
  ["0009-sql-aide FR-023", "0009-sql-aide FR-024"],
  "pgvector is an extension a context is made with, and a plugin with a lint rule and a generator",
  () => {
    const embedding = table("embedding", { id: pk.text(), v: vector(3), wide: vector(4096), n: integer() }, { owner: "t", doc: "x" });
    const withVector = context({ dialect: postgres().with(pgvectorExtension), plugins: [pgvectorPlugin] });
    // the control: a PostgreSQL with pgvector writes the column as pgvector names it
    assertStringIncludes(render(embedding.ddl, withVector), `"v" vector(3) NOT NULL`);
    // @ts-expect-error a PostgreSQL without pgvector has no vector type
    const plainPg = (): unknown => render(embedding.ddl, context({ dialect: postgres() }));
    // @ts-expect-error nor does SQLite
    const lite = (): unknown => render(embedding.ddl, context({ dialect: sqlite() }));
    assertEquals([typeof plainPg, typeof lite], ["function", "function"]);
    assertEquals(pgvectorExtension.install, "CREATE EXTENSION IF NOT EXISTS vector");
    assertEquals(
      lint([embedding], withVector)
        .filter((f) => f.rule === "vector-dimensions")
        .map((f) => f.column),
      ["wide"],
    );
    assertEquals(
      lint([embedding], context({ dialect: postgres() })).filter((f) => f.rule === "vector-dimensions"),
      [],
    );
    // nothing registers by being imported: a context made without the plugin has none
    assertEquals(context({ dialect: postgres() }).plugins, []);
  },
);

/** A command line run in memory: its status and what it wrote. */
async function run(words: readonly string[]): Promise<{ readonly status: number; readonly out: string; readonly err: string }> {
  let out = "",
    err = "";
  const status = await cli(
    { name: "arca", entities: partyModel, tables: partyTables, docs: [partyDocs], plugins: [pgvectorPlugin] },
    words,
    {
      out: (t) => (out += t),
      err: (t) => (err += t),
    },
  );
  return { status, out, err };
}

proves(["0009-sql-aide FR-046", "0009-sql-aide FR-045"], "the command line is a function a project calls with its project", async () => {
  const sql = await run(["sql", "--dialect", "sqlite"]);
  assertEquals([sql.status, sql.out], [0, `${render(definitions(partyModel), context({ dialect: sqlite(), docs: [partyDocs] }))}\n`]);
  const erd = await run(["generate", "mermaid"]);
  assertEquals([erd.status, erd.out], [0, mermaidErd(partyTables)]);
  assertEquals((await run(["lint"])).status, 0);
  assertEquals((await run(["list"])).out, "mermaid\nd2\ndictionary\nrust\nzod\nvectors\n");
  assertEquals((await run(["generate", "vectors"])).out, "");
  const help = await run(["--help"]);
  assert(help.status === 0 && help.out.includes("--dialect"));
  assertEquals((await run(["migrate"])).status, 2);
  assertEquals((await run(["generate", "uml"])).status, 2);
  assertEquals((await run(["sql", "--dialect", "oracle"])).status, 2);
  assertEquals((await run(["sql", "--colour"])).status, 2);
  // a model that does not render for the dialect asked is a failure the command line says: SQLite stores no functions
  let said = "";
  const one = fn("one", { args: {}, returns: scalar(integer()), body: (_, pl) => pl.block(pl.ret(1)) });
  const status = await cli({ name: "f", entities: [one] }, ["sql", "-d", "sqlite"], { out: () => undefined, err: (t) => (said += t) });
  assertEquals(status, 1);
  assertStringIncludes(said, "stores no functions");
});
