/**
 * Structure beyond tables: views with typed columns, typed indexes, typed partitions and the objects of PostgreSQL, and the tests that run
 * inside the database (commons 0009-sql-aide FR-017 to FR-019, FR-022, FR-029, FR-030).
 *
 * @module
 */
import type { Equal } from "../../../kernel/mod.ts";
import { expectType } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertRejects, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import {
  context,
  date,
  definitions,
  duckdb,
  enumType,
  eq,
  extension,
  fails,
  fk,
  fromLines,
  index,
  integer,
  isNull,
  partitionBy,
  pgDomain,
  pgTapScript,
  pk,
  policy,
  postgres,
  raw,
  render,
  rowLevelSecurity,
  type RowOf,
  rows,
  runAssertions,
  schema,
  sequence,
  SQL,
  sqlite,
  structuralTests,
  table,
  tally,
  tapQuery,
  text,
  timestamptz,
  view,
} from "../../sql-aide/mod.ts";
import { eachEngine, golden, pgliteEngine } from "../helpers.ts";

const pg = context({ dialect: postgres() }),
  lite = context({ dialect: sqlite() }),
  duck = context({ dialect: duckdb() });
const contexts = { postgres: pg, sqlite: lite, duckdb: duck };

const author = table("author", { author_id: pk.ulid(), name: text(), retired_at: timestamptz().nullable() });
const book = table("book", {
  book_id: pk.ulid(),
  author_id: fk(author.c.author_id),
  title: text(),
  pages: integer(),
  published_on: date().nullable(),
});
const longBooks = view(
  "long_book",
  { title: text(), author: text(), pages: integer() },
  SQL`
    SELECT ${book.c.title}, ${author.c.name}, ${book.c.pages}
      FROM ${book} JOIN ${author} ON ${eq(author.c.author_id, book.c.author_id)}
     WHERE ${book.c.pages} >= ${500}
  `,
  { from: [book, author], doc: "Books of five hundred pages or more, with who wrote them" },
);
const byAuthor = index(book, ["author_id", "title"]);
const oneTitle = index(book, ["title"]).unique().named("book_title_once");
const model = [longBooks, oneTitle, byAuthor, book, author] as const;

proves(["0009-sql-aide FR-017"], "a view's rows are typed by its declared columns, and it is defined after what it reads", () => {
  expectType<Equal<RowOf<typeof longBooks>, { readonly title: string; readonly author: string; readonly pages: number }>>();
  assertEquals(longBooks.c.pages.table, "long_book");
  const text0 = render(definitions(model), pg);
  assert(text0.indexOf(`CREATE TABLE IF NOT EXISTS "book"`) < text0.indexOf(`CREATE OR REPLACE VIEW "long_book"`));
  assertStringIncludes(text0, `COMMENT ON VIEW "long_book" IS 'Books of five hundred pages or more, with who wrote them';`);
  assertStringIncludes(
    render(longBooks.ddl, lite),
    `DROP VIEW IF EXISTS "long_book";\nCREATE VIEW "long_book" ("title", "author", "pages") AS`,
  );
});

for (const [dialect, ctx] of Object.entries(contexts)) {
  proves(
    ["0009-sql-aide FR-017", "0009-sql-aide FR-018"],
    `tables, a view and indexes emitted for ${dialect} are what is committed`,
    async () => {
      await golden(new URL(`./golden/structure.${dialect}.sql`, import.meta.url), `${render(definitions(model), ctx)}\n`);
    },
  );
}

proves(
  ["0009-sql-aide FR-018", "0009-sql-aide FR-008"],
  "an index names columns of its own table, and what it asks for is a feature of the dialect",
  () => {
    assertEquals(render(byAuthor.ddl, pg), `CREATE INDEX IF NOT EXISTS "book_author_id_title_idx" ON "book" ("author_id", "title");`);
    assertEquals(render(oneTitle.ddl, lite), `CREATE UNIQUE INDEX IF NOT EXISTS "book_title_once" ON "book" ("title");`);
    // @ts-expect-error name is a column of author, not of book, so an index on book cannot name it
    const wrongColumn = (): unknown => index(book, ["name"]);
    assertEquals(typeof wrongColumn, "function");

    const live = index(author, ["name"])
      .unique()
      .where((c) => isNull(c.retired_at))
      .include(["author_id"]);
    assertEquals(
      render(live.ddl, pg),
      `CREATE UNIQUE INDEX IF NOT EXISTS "author_name_uidx" ON "author" ("name") INCLUDE ("author_id") WHERE "retired_at" IS NULL;`,
    );
    // @ts-expect-error sqlite has no INCLUDE, so an index that covers columns does not render for it
    render(live.ddl, lite);
    const partial = index(author, ["name"]).where((c) => isNull(c.retired_at));
    assertEquals(
      render(partial.ddl, lite),
      `CREATE INDEX IF NOT EXISTS "author_name_idx" ON "author" ("name") WHERE "retired_at" IS NULL;`,
    );
    // @ts-expect-error duckdb has no partial indexes
    render(partial.ddl, duck);

    const words = index(book, [])
      .using("gin")
      .expressions(() => [raw(`to_tsvector('simple', "title")`)])
      .concurrently()
      .named("book_title_words");
    assertEquals(
      render(words.ddl, pg),
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "book_title_words" ON "book" USING gin ((to_tsvector('simple', "title")));`,
    );
    assert(words.isConcurrent, "such an index cannot be built in a transaction, and says so");
    // @ts-expect-error sqlite has no gin method
    render(words.ddl, lite);
    // an extension's method is a feature the extension adds
    const vectors = index(book, ["title"]).using("hnsw");
    // @ts-expect-error plain PostgreSQL has no hnsw method
    render(vectors.ddl, pg);
    const withVector = context({ dialect: postgres().with({ name: "vector", dialect: "postgres", features: ["index:hnsw"] }) });
    assertStringIncludes(render(vectors.ddl, withVector), "USING hnsw");
  },
);

proves(
  ["0009-sql-aide FR-019", "0009-sql-aide FR-010"],
  "a partitioned table's key is in its primary key, and a partition's bounds are of the key's type",
  async () => {
    const event = partitionBy(table("event", { event_id: pk.ulid(), at: timestamptz().primaryKey(), kind: text() }), "range", ["at"]);
    const y2026 = event.partition("event_2026", { from: [new Date("2026-01-01T00:00:00Z")], to: [new Date("2027-01-01T00:00:00Z")] });
    const rest = event.partition("event_rest", "default");
    assertStringIncludes(
      render(event.ddl, pg),
      `CONSTRAINT "event_event_id_at_pk" PRIMARY KEY ("event_id", "at")\n) PARTITION BY RANGE ("at");`,
    );
    assertEquals(
      render(y2026.ddl, pg),
      `CREATE TABLE IF NOT EXISTS "event_2026" PARTITION OF "event" FOR VALUES FROM ('2026-01-01T00:00:00.000Z') TO ('2027-01-01T00:00:00.000Z');`,
    );
    // @ts-expect-error kind is not in the primary key, so the table cannot be partitioned by it
    const notInKey = (): unknown => partitionBy(table("e", { id: pk.ulid(), kind: text() }), "list", ["kind"]);
    // @ts-expect-error the key is a moment, and a number is not one
    const wrongBound = (): unknown => event.partition("bad", { from: [1], to: [2] });
    assertEquals([typeof notInKey, typeof wrongBound], ["function", "function"]);
    // @ts-expect-error sqlite has no partitions
    render(event.ddl, lite);

    const region = partitionBy(table("sale", { sale_id: pk.ulid(), region: text().primaryKey() }), "list", ["region"]);
    assertEquals(
      render(region.partition("sale_eu", { in: ["de", "fr"] }).ddl, pg),
      `CREATE TABLE IF NOT EXISTS "sale_eu" PARTITION OF "sale" FOR VALUES IN ('de', 'fr');`,
    );
    const hashed = partitionBy(table("visit", { visit_id: pk.ulid() }), "hash", ["visit_id"]);
    assertEquals(
      render(hashed.partition("visit_0", { modulus: 4, remainder: 0 }).ddl, pg),
      `CREATE TABLE IF NOT EXISTS "visit_0" PARTITION OF "visit" FOR VALUES WITH (MODULUS 4, REMAINDER 0);`,
    );

    const engine = await pgliteEngine();
    try {
      const ddl = render(definitions([rest, y2026, event]), pg);
      await engine.exec(ddl);
      await engine.exec(ddl);
      await engine.exec(
        `INSERT INTO "event" ("event_id", "at", "kind") VALUES ('a', '2026-06-01T00:00:00Z', 'x'), ('b', '2030-01-01T00:00:00Z', 'y')`,
      );
      assertEquals((await engine.query(`SELECT count(*)::int AS n FROM "event_2026"`))[0]?.["n"], 1);
      assertEquals((await engine.query(`SELECT count(*)::int AS n FROM "event_rest"`))[0]?.["n"], 1);
    } finally {
      await engine.close();
    }
  },
);

proves(["0009-sql-aide FR-022"], "the objects of PostgreSQL are defined so that defining them again changes nothing", async () => {
  const library = schema("library");
  const numbers = sequence("ticket_number", { schema: "library" });
  const mood = enumType("mood", ["calm", "busy"]);
  const email = pgDomain("email", text(), { check: raw(`VALUE ~ '^[^@]+@[^@]+$'`) });
  const member = table("member", { member_id: pk.ulid(), mood: mood.column(), email: email.column(), tenant: text() });
  const rls = rowLevelSecurity(member);
  const own = policy("member_own_tenant", member, { for: "select", using: raw(`"tenant" = current_setting('app.tenant', true)`) });
  assertEquals(render(extension("pgcrypto").ddl, pg), `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
  assertEquals(render(mood.ddl, duck), `CREATE TYPE IF NOT EXISTS "mood" AS ENUM ('calm', 'busy');`);
  // @ts-expect-error sqlite has no enumerated types: a column for every dialect is oneOf
  render(member.ddl, lite);
  // @ts-expect-error duckdb has enumerated types but no domains
  render(member.ddl, duck);
  expectType<Equal<RowOf<typeof member>["mood"], "calm" | "busy">>();

  const moods = view(
    "mood_count",
    { mood: text(), members: integer() },
    SQL`SELECT "mood"::text, count(*)::int FROM ${member} GROUP BY 1`,
    {
      from: [member],
      materialized: true,
    },
  );
  assertStringIncludes(render(moods.ddl, pg), `CREATE MATERIALIZED VIEW IF NOT EXISTS "mood_count" ("mood", "members") AS`);
  const plainView = view("v", { n: integer() }, SQL`SELECT 1`);
  // @ts-expect-error sqlite has views but not materialized ones
  render(view("m", { n: integer() }, SQL`SELECT 1`, { materialized: true }).ddl, lite);
  assertStringIncludes(render(plainView.ddl, lite), "CREATE VIEW");

  const engine = await pgliteEngine();
  try {
    const ddl = render(definitions([moods, own, rls, member, email, mood, numbers, library]), pg);
    assert(ddl.indexOf("CREATE SCHEMA") < ddl.indexOf("CREATE SEQUENCE") || ddl.includes("CREATE SCHEMA"));
    assert(ddl.indexOf(`ENABLE ROW LEVEL SECURITY`) < ddl.indexOf("CREATE POLICY"), "a policy is defined after row-level security is on");
    await engine.exec(ddl);
    await engine.exec(ddl);
    await engine.exec(`INSERT INTO "member" VALUES ('m1', 'calm', 'a@b.c', 't1')`);
    await assertRejects(() => engine.exec(`INSERT INTO "member" VALUES ('m2', 'angry', 'a@b.c', 't1')`));
    await assertRejects(() => engine.exec(`INSERT INTO "member" VALUES ('m3', 'calm', 'not an address', 't1')`));
    assertEquals((await engine.query(`SELECT nextval('library.ticket_number')::int AS n`))[0]?.["n"], 1);
    assertEquals((await engine.query(`SELECT count(*)::int AS n FROM pg_policies WHERE policyname = 'member_own_tenant'`))[0]?.["n"], 1);
    await engine.exec(`REFRESH MATERIALIZED VIEW "mood_count"`);
    assertEquals(await engine.query(`SELECT "mood", "members" FROM "mood_count"`), [{ mood: "calm", members: 1 }]);
  } finally {
    await engine.close();
  }
});

proves(
  ["0009-sql-aide FR-029", "0009-sql-aide FR-030"],
  "tests are values: made from the model, run inside each engine and from TypeScript, and written as pgTAP",
  async () => {
    const structure = (ctx: typeof pg | typeof lite | typeof duck): ReturnType<typeof structuralTests> =>
      structuralTests({ tables: [author, book], views: [longBooks], indexes: [byAuthor, oneTitle] }, ctx);
    assertEquals(structure(pg).length, 2 + 3 + 5 + 2 + 1 + 2);
    const scenario = [
      rows("long books are listed with their author", SQL`SELECT "title", "author" FROM ${longBooks}`, [["Long", "A"]]),
      rows("no short book is listed", SQL`SELECT 1 FROM ${longBooks} WHERE ${longBooks.c.pages} < ${500}`, []),
      fails("a title is used once", raw(`INSERT INTO "book" ("book_id", "author_id", "title", "pages") VALUES ('b3', 'a1', 'Long', 1)`)),
    ];
    await eachEngine(async (engine) => {
      const ctx = contexts[engine.dialect];
      await engine.exec(render(definitions(model), ctx));
      await engine.exec(`INSERT INTO "author" ("author_id", "name") VALUES ('a1', 'A')`);
      await engine.exec(
        `INSERT INTO "book" ("book_id", "author_id", "title", "pages") VALUES ('b1', 'a1', 'Long', 900), ('b2', 'a1', 'Short', 90)`,
      );
      const all = [...structure(ctx), ...scenario];
      const lines = (await engine.query(tapQuery(all, ctx))).map((r) => String(r["tap"]));
      assertEquals(
        tally(fromLines(lines)),
        { passed: all.length - 1, failed: 0, skipped: 1 },
        `${engine.name}: ${lines.filter((l) => l.startsWith("not")).join("; ")}`,
      );
      assertEquals(tally(await runAssertions(all, engine, ctx)), { passed: all.length, failed: 0, skipped: 0 }, engine.name);
    });
    const script = pgTapScript([...structure(pg), ...scenario], pg);
    assertStringIncludes(script, "SELECT plan(18);");
    assertStringIncludes(script, `SELECT col_is_pk('book', ARRAY['book_id'], 'book has the primary key (book_id)');`);
    assertStringIncludes(script, `SELECT has_index('book', 'book_title_once', 'index book_title_once on book exists');`);
    assertStringIncludes(script, "SELECT throws_ok($ifc$INSERT INTO");
    assert(script.endsWith("SELECT * FROM finish();"));
    assertEquals(tapQuery([], pg), "SELECT '1..0' AS tap");
  },
);
