/**
 * The emit core: the SQL template, the two renderings, dialects, naming and hooks (commons 0009-sql-aide FR-010 to FR-016, FR-023, FR-024).
 *
 * @module
 */
import { sha256 } from "../../../kernel/mod.ts";
import { assert, assertEquals, assertStringIncludes, assertThrows, proves } from "../../../runtime/test.ts";
import {
  and,
  bind,
  bracketNaming,
  byDialect,
  context,
  duckdb,
  emitFiles,
  eq,
  type EmitEvent,
  inList,
  isNull,
  join,
  name,
  not,
  or,
  postgres,
  prefixedNaming,
  qualifiedNaming,
  raw,
  render,
  SQL,
  sqlite,
  statement,
  textDomain,
  token,
  unindent,
  variable,
} from "../../sql-aide/mod.ts";

const pg = context({ dialect: postgres() });
const lite = context({ dialect: sqlite() });
const duck = context({ dialect: duckdb() });

proves(["0009-sql-aide FR-015"], "template text is un-indented, and a partial of several lines keeps its line's indentation", () => {
  assertEquals(unindent("\n    select 1\n      from t\n\n    where x\n  "), "select 1\n  from t\n\nwhere x");
  const columns = raw("a,\nb,\nc");
  const q = SQL`
    select
      ${columns}
    from t
  `;
  assertEquals(render(q, pg), "select\n  a,\n  b,\n  c\nfrom t");
});

proves(
  ["0009-sql-aide FR-013", "0009-sql-aide FR-014"],
  "a value is a literal in a script and a parameter in a statement, in each dialect's way",
  () => {
    const q = SQL`select * from ${name("t")} where a = ${bind("O'Brien")} and b = ${42} and c = ${true} and d = ${null}`;
    assertEquals(render(q, pg), `select * from "t" where a = 'O''Brien' and b = 42 and c = TRUE and d = NULL`);
    assertEquals(statement(q, pg), {
      text: `select * from "t" where a = $1 and b = $2 and c = $3 and d = $4`,
      params: ["O'Brien", 42, true, null],
    });
    assertEquals(statement(q, lite), {
      text: `select * from "t" where a = ?1 and b = ?2 and c = ?3 and d = ?4`,
      params: ["O'Brien", 42, 1, null],
    });
    assertEquals(statement(q, duck).text, `select * from "t" where a = $1 and b = $2 and c = $3 and d = $4`);
  },
);

proves(
  ["0009-sql-aide FR-014"],
  "bytes, dates, big integers, JSON and numbers that are not finite are written as each dialect writes them",
  () => {
    const when = new Date("2026-01-02T03:04:05.006Z");
    const q = SQL`${new Uint8Array([222, 173])} ${when} ${12345678901234567890n} ${bind({ a: [1, "x'y"] })} ${Number.NaN}`;
    assertEquals(render(q, pg), `'\\xdead'::bytea '2026-01-02T03:04:05.006Z' 12345678901234567890 '{"a":[1,"x''y"]}' 'NaN'::float8`);
    assertEquals(render(q, lite), `X'dead' '2026-01-02T03:04:05.006Z' 12345678901234567890 '{"a":[1,"x''y"]}' NULL`);
    assertEquals(render(q, duck), `from_hex('dead') '2026-01-02T03:04:05.006Z' 12345678901234567890 '{"a":[1,"x''y"]}' 'NaN'::DOUBLE`);
    assertEquals(statement(q, lite).params, [
      new Uint8Array([222, 173]),
      "2026-01-02T03:04:05.006Z",
      12345678901234567890n,
      '{"a":[1,"x\'y"]}',
      Number.NaN,
    ]);
  },
);

proves(["0009-sql-aide FR-013"], "expressions bind their values and keep the order of their terms", () => {
  const a = name("a"),
    b = name("b");
  const e = and(eq(asText(a), "x"), or(isNull(asText(b)), not(inList(asText(b), ["p", "q"]))));
  assertEquals(render(e, pg), `("a" = 'x' AND ("b" IS NULL OR NOT ("b" IN ('p', 'q'))))`);
  assertEquals(statement(e, pg).params, ["x", "p", "q"]);
  assertEquals(render(and(), pg), "TRUE");
  assertEquals(render(join([raw("x"), raw("y")], " | "), pg), "x | y");
});

proves(
  ["0009-sql-aide FR-011"],
  "byDialect renders the case of the context's dialect, and fails where it is given a dialect it has no case for",
  () => {
    const id = byDialect({ postgres: raw("gen_random_uuid()"), duckdb: raw("uuid()"), sqlite: raw("lower(hex(randomblob(16)))") });
    assertEquals([render(id, pg), render(id, duck), render(id, lite)], ["gen_random_uuid()", "uuid()", "lower(hex(randomblob(16)))"]);
    const two = byDialect({ postgres: raw("a"), duckdb: raw("b") });
    // @ts-expect-error the partial has no case for sqlite, so a sqlite context does not fit it
    assertThrows(() => render(two, lite));
  },
);

proves(["0009-sql-aide FR-012"], "names come from the context's naming strategy, and one name is written for each target", () => {
  const t = SQL`${name("s", "t")}`;
  assertEquals(render(t, pg), `"s"."t"`);
  assertEquals(render(t, context({ dialect: postgres(), naming: bracketNaming() })), "[s].[t]");
  assertEquals(qualifiedNaming("arca").table("party", undefined), ["arca", "party"]);
  assertEquals(prefixedNaming("dcp_").table("party", "x"), ["x", "dcp_party"]);
  const k = token("party_identifier");
  assertEquals(
    [k.sql, k.snake, k.camel, k.pascal, k.plural.snake],
    ["party_identifier", "party_identifier", "partyIdentifier", "PartyIdentifier", "party_identifiers"],
  );
  assertEquals(token("party").plural.pascal, "Parties");
});

proves(
  ["0009-sql-aide FR-024"],
  "a plugin is a value passed to the context: its naming replaces the strategy's and its hook hears what is emitted",
  async () => {
    const heard: EmitEvent[] = [];
    const ctx = context({
      dialect: postgres(),
      plugins: [{ name: "upper", version: "1.0.0", hooks: { naming: { column: (c) => c.toUpperCase() }, onEmit: (e) => heard.push(e) } }],
    });
    assertEquals(ctx.naming.column("a"), "A");
    assertEquals(pg.naming.column("a"), "a", "another context is not touched: there is no global registry");
    const files = await emitFiles([{ path: "001_x.sql", module: "tests/x.ts", content: raw("select 1;") }], ctx);
    assertEquals(
      heard.map((e) => e.kind),
      ["file"],
    );
    assertEquals(files.length, 1);
  },
);

proves(
  ["0009-sql-aide FR-015", "0009-sql-aide FR-016"],
  "an emitted file begins with where it came from and the hash of its body, and is the same bytes twice",
  async () => {
    const parts = [{ path: "001_x.sql", module: "arca/party.ts", content: raw("select 1;") }];
    const ctx = context({ dialect: sqlite(), execution: "test" });
    const [a] = await emitFiles(parts, ctx);
    const [b] = await emitFiles(parts, ctx);
    assert(a !== undefined && b !== undefined);
    assertEquals(a.text, b.text);
    assertStringIncludes(a.text, "-- Generated by IFC SQL Aide 0.1.0 for sqlite (test) from arca/party.ts.");
    assertEquals(a.sha256, await sha256("select 1;\n"));
    assertStringIncludes(a.text, `Body SHA-256 ${a.sha256}`);
    assert(a.text.endsWith("\nselect 1;\n"));
  },
);

proves(["0009-sql-aide FR-016"], "a script variable is written as each dialect's client writes it", () => {
  const schema = variable("schema_name", textDomain());
  assertEquals(
    [render(schema, pg), render(schema, lite), render(schema, duck)],
    [":'schema_name'", ":schema_name", "getvariable('schema_name')"],
  );
  assertEquals(render(schema.set(bind("arca")), pg), "\\set schema_name 'arca'");
  assertEquals(render(schema.set(bind("arca")), lite), ".parameter set :schema_name 'arca'");
  assertEquals(render(schema.set(bind("arca")), duck), "SET VARIABLE schema_name = 'arca';");
  assertThrows(() => variable("no good", textDomain()));
});

proves(["0009-sql-aide FR-023"], "an extension adds features and types to a dialect, and the dialect without it is unchanged", () => {
  const vector = {
    name: "vector",
    dialect: "postgres",
    features: ["vector", "index:hnsw"],
    typeOf: (s: { kind: string; name?: string }) => (s.kind === "custom" && s.name === "vector" ? "vector(3)" : undefined),
    install: "CREATE EXTENSION IF NOT EXISTS vector",
  } as const;
  const withVector = postgres().with(vector);
  assert(withVector.features.has("index:hnsw") && !postgres().features.has("index:hnsw"));
  assertEquals(withVector.typeOf({ kind: "custom", name: "vector" }), "vector(3)");
  assertEquals(postgres().typeOf({ kind: "custom", name: "vector" }), "vector");
  assertEquals(
    withVector.extensions.map((e) => e.install),
    ["CREATE EXTENSION IF NOT EXISTS vector"],
  );
});

/** Says that a name is a text expression, for the tests that compare one to a string. */
function asText(n: ReturnType<typeof name>): import("../../sql-aide/mod.ts").Expr<string> {
  return { sqlKind: "expression", chunks: n.chunks };
}
