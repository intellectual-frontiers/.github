/**
 * Documentation extracted from SQL comments (commons lang-sql 0004-sql-docs): the text of comments of every kind with the markers taken off; which comments document a declaration; summary, description and tags as TSDoc
 * reads them, with typed tags, readers of a project's own and examples parsed back; the declarations of a script; and Markdown.
 *
 * Spec: 0004-sql-docs FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ansi, type Dialect, parse, toSexp } from "@intellectual-frontiers/lang-sql";
import { dialect as clickhouse } from "@intellectual-frontiers/lang-sql/dialects/clickhouse";
import { dialect as mysql } from "@intellectual-frontiers/lang-sql/dialects/mysql";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as snowflake } from "@intellectual-frontiers/lang-sql/dialects/snowflake";
import { type Declaration, docText, documentScript, parseDoc, toMarkdown } from "@intellectual-frontiers/lang-sql/extensions/docs";

const noteText = (t: { readonly kind: string } | undefined): string =>
  t !== undefined && "text" in t && typeof t.text === "string" ? t.text : "";
const text = (sql: string, d: Dialect = ansi): string => docText(parse(sql, d).comments);
const decls = (sql: string, d: Dialect = ansi): readonly Declaration[] => documentScript(parse(sql, d), { dialect: d });
const first = (xs: readonly Declaration[]): Declaration => {
  const x = xs[0];
  assert(x !== undefined);
  return x;
};

proves(
  ["0004-sql-docs FR-001"],
  "the text of a comment has its markers taken off, whatever kind of comment the dialect has, and consecutive comments are joined by a new line",
  () => {
    assertEquals(text("-- a"), "a");
    assertEquals(text("--a"), "a");
    assertEquals(text("--- The people.\n--- Of the company.\nSELECT 1"), "The people.\nOf the company.");
    assertEquals(text("-- a\n--\n-- b"), "a\n\nb");
    assertEquals(text("-- - bullet\n--   indented"), "- bullet\n  indented");
    assertEquals(text("/* a */"), "a");
    assertEquals(text("/** a\n * b\n *   c\n */"), "a\nb\n  c");
    assertEquals(text("/**\n * a\n *\n * b\n */"), "a\n\nb");
    assertEquals(text("/*\n   a\n   b\n*/"), "a\nb");
    assertEquals(text("-- a\r\n-- b\r\n"), "a\nb");
    assertEquals(text("## heading\n# x", mysql), "heading\nx", "# in MySQL");
    assertEquals(text("// from Snowflake\n/// more", snowflake), "from Snowflake\nmore");
    assertEquals(text("#! note", clickhouse), "note");
    assertEquals(text("/*+ INDEX(t) */", mysql), "INDEX(t)", "a hint is a comment");
    assertEquals(text("-- a\n/* b */", ansi), "a\nb");
    assertEquals(text("SELECT 1"), "");
  },
);

proves(
  ["0004-sql-docs FR-002"],
  "a declaration is documented by its leading comments, its trailing comments and those that trail its name, and by no detached, dangling or other comment",
  () => {
    const t = first(decls("-- before\nCREATE TABLE t ( -- on the name\n  -- above a\n  a INT, -- after a\n  b INT\n) -- after the table"));
    assertEquals(t.doc?.raw, "before\nafter the table\non the name");
    const a = t.members[0];
    assertEquals(a?.doc?.raw, "above a\nafter a", "leading, then trailing");
    assertEquals(t.members[1]?.doc, undefined, "b has no comment of its own");
    assertEquals(first(decls("-- detached\n\nCREATE TABLE t (a INT)")).doc, undefined);
    assertEquals(first(decls("CREATE TABLE t (a INT)")).doc, undefined);
    assertEquals(first(decls("-- one\nCREATE TABLE t (a INT);\n-- two\nCREATE TABLE u (a INT)")).doc?.raw, "one");
    assertEquals(decls("-- one\nCREATE TABLE t (a INT);\n-- two\nCREATE TABLE u (a INT)")[1]?.doc?.raw, "two");
    assertEquals(first(decls("/** The table. */\nCREATE TABLE t (a INT)")).doc?.summary, "The table.");
    assertEquals(first(decls("# The table.\nCREATE TABLE t (a INT)", mysql)).doc?.summary, "The table.");
    assertEquals(first(decls("// The table.\nCREATE TABLE t (a INT)", snowflake)).doc?.summary, "The table.");
  },
);

proves(["0004-sql-docs FR-003"], "documentation has a summary, a description and tags, read as TSDoc reads them", () => {
  const d = parseDoc(
    "The people\nof the company.\n\nMore about them,\nover two lines.\n\nAnd another paragraph.\n\n@since 2026\n@see other\n  and more",
  );
  assertEquals(d.summary, "The people of the company.");
  assertEquals(d.description, "More about them,\nover two lines.\n\nAnd another paragraph.");
  assertEquals(
    d.tags.map((t) => [t.kind, noteText(t)]),
    [
      ["since", "2026"],
      ["see", "other\n  and more"],
    ],
  );
  const onlyTag = parseDoc("@deprecated use b");
  assertEquals([onlyTag.summary, onlyTag.description, onlyTag.tags.length], ["", "", 1]);
  const empty = parseDoc("");
  assertEquals([empty.summary, empty.description, empty.tags], ["", "", []]);
  assertEquals(parseDoc("@deprecated").tags[0]?.kind, "deprecated");
  assertEquals(parseDoc("Mail me @ home\nuser@example.org").tags, [], "an @ that is not at the start of a line is text");
  assertEquals(parseDoc("a\n\n\n\nb").description, "b");
  const dep = first(decls("/** @deprecated use b */\nCREATE TABLE t (a INT)")).doc;
  assertEquals([dep?.summary, dep?.tags[0]?.kind, noteText(dep?.tags[0])], ["", "deprecated", "use b"]);
});

proves(
  ["0004-sql-docs FR-004"],
  "param, returns, example, deprecated, since and see are typed, every other tag is a tag with its name and text, and a project's reader is used in the place of the generic one",
  () => {
    const d = parseDoc(
      "@param id the key\n@param {int} n - a count\n@param name {text} the name\n@param bare\n@returns the row\n@return it too\n@since 1\n@see x\n@deprecated y\n@pii yes",
    );
    const kinds = d.tags.map((t) => t.kind);
    assertEquals(kinds, ["param", "param", "param", "param", "returns", "returns", "since", "see", "deprecated", "custom"]);
    const params = d.tags.flatMap((t) => (t.kind === "param" ? [`${t.name}|${t.type ?? "-"}|${t.text}`] : []));
    assertEquals(params, ["id|-|the key", "n|int|a count", "name|text|the name", "bare|-|"]);
    const last = d.tags[9];
    assert(last?.kind === "custom" && last.tag === "pii" && last.text === "yes" && last.value === undefined);
    const withReader = parseDoc("@pii yes, high", { readers: { pii: (t) => t.split(",").map((x) => x.trim()) } });
    const r = withReader.tags[0];
    assert(r?.kind === "custom" && JSON.stringify(r.value) === '["yes","high"]');
    assertEquals(parseDoc("@PARAM X y").tags[0]?.kind, "param", "tag names are not case sensitive");
  },
);

proves(
  ["0004-sql-docs FR-005"],
  "the code of an example is the text of the tag without its fence, parsed with the dialect of the script, with its tree and errors",
  () => {
    const ex = (doc: string, d: Dialect = ansi) => {
      const t = parseDoc(doc, { dialect: d }).tags[0];
      assert(t?.kind === "example");
      return t;
    };
    const a = ex("@example\nSELECT 1");
    assertEquals([a.code, a.parsed.errors.length, a.parsed.script.statements.length], ["SELECT 1", 0, 1]);
    const f = ex("@example\n```sql\nSELECT a FROM t;\nSELECT b FROM u\n```");
    assertEquals([f.code, f.parsed.script.statements.length, f.parsed.errors.length], ["SELECT a FROM t;\nSELECT b FROM u", 2, 0]);
    assertEquals(ex("@example\n```\nSELECT 1\n```").code, "SELECT 1");
    assertEquals(ex("@example SELECT FROM").parsed.errors.length, 1, "an example that does not parse says so");
    assertEquals(ex("@example\nSELECT a::int", postgres).parsed.errors.length, 0, "in the dialect it is given");
    assertEquals(ex("@example\nSELECT a::int").parsed.errors.length, 1, "and not in another");
    const viaScript = first(decls("/**\n * A table.\n * @example\n * SELECT a::int FROM t\n */\nCREATE TABLE t (a INT)", postgres));
    const t = viaScript.doc?.tags[0];
    assert(t?.kind === "example" && t.parsed.errors.length === 0 && t.code === "SELECT a::int FROM t");
  },
);

proves(
  ["0004-sql-docs FR-006"],
  "a script gives, in order, its tables with columns and named constraints, views, indexes, common table expressions, added columns and other statements, each with its kind, name, node and documentation",
  () => {
    const sql = [
      "-- The people.",
      "CREATE TABLE s.person (",
      "  id INT, -- the key",
      "  name TEXT,",
      "  -- unique names",
      "  CONSTRAINT person_name UNIQUE (name),",
      "  CHECK (id > 0)",
      ");",
      "-- A view.",
      "CREATE VIEW v AS SELECT 1;",
      "-- An index.",
      "CREATE INDEX person_idx ON s.person (name);",
      "CREATE INDEX ON t (a);",
      "-- Common.",
      "WITH -- the first",
      "  a AS (SELECT 1),",
      "  -- the second",
      "  b AS (SELECT 2) SELECT * FROM a, b;",
      "-- more",
      "ALTER TABLE t ADD COLUMN c INT; ",
      "-- name: GetUser :one",
      "SELECT * FROM person WHERE id = $1;",
    ].join("\n");
    const ds = decls(sql, postgres);
    assertEquals(
      ds.map((d) => `${d.kind} ${d.name}`),
      ["table s.person", "view v", "index person_idx", "index t", "statement with", "statement alter-table", "statement select"],
    );
    const table = ds[0];
    assert(table !== undefined);
    assertEquals(
      table.members.map((m) => `${m.kind} ${m.name}`),
      ["column id", "column name", "constraint person_name"],
      "an unnamed constraint is not a member",
    );
    assertEquals(
      table.members.map((m) => m.doc?.summary),
      ["the key", undefined, "unique names"],
    );
    assertEquals(table.node.kind, "create-table");
    assertEquals(ds[1]?.doc?.summary, "A view.");
    assertEquals(ds[2]?.doc?.summary, "An index.");
    const w = ds[4];
    assert(w !== undefined);
    assertEquals(
      w.members.map((m) => `${m.kind} ${m.name} ${m.doc?.summary ?? ""}`),
      ["cte a the first", "cte b the second"],
    );
    assertEquals(w.doc?.summary, "Common.");
    assertEquals(
      ds[5]?.members.map((m) => `${m.kind} ${m.name}`),
      ["column c"],
    );
    assertEquals(ds[6]?.doc?.summary, "name: GetUser :one", "the line before a query documents it");
    const starts = ds.map((d) => d.node.start);
    assertEquals(
      starts,
      [...starts].sort((a, b) => a - b),
    );
  },
);

proves(
  ["0004-sql-docs FR-007"],
  "declarations are written as Markdown, one section for each that has documentation or members that have it, with the same text for the same declarations",
  () => {
    const sql =
      "/**\n * The people of the company.\n *\n * Kept for ten years.\n * @since 2026\n * @example\n * SELECT * FROM person\n */\nCREATE TABLE person (\n  id INT, -- the key\n  /** @deprecated use full_name */\n  name TEXT\n);\nCREATE TABLE plain (a INT);";
    const md = toMarkdown(decls(sql));
    assertEquals(
      md,
      [
        "## table `person`",
        "",
        "The people of the company.",
        "",
        "Kept for ten years.",
        "",
        "**Since**: 2026",
        "",
        "**Example**",
        "",
        "```sql",
        "SELECT * FROM person",
        "```",
        "",
        "**Members**",
        "",
        "- `id` (column): the key",
        "- `name` (column)",
        "",
      ].join("\n"),
    );
    assertEquals(toMarkdown(decls(sql)), md);
    assertEquals(toMarkdown(decls("CREATE TABLE t (a INT)")), "");
    assert(toMarkdown(decls("-- x\nCREATE TABLE t (a INT)"), 3).startsWith("### table `t`"));
    const params = toMarkdown(decls("/** Get.\n * @param id the key\n * @param n {int} count\n * @returns rows\n * @pii no */\nSELECT 1"));
    assert(
      params.includes("**Parameters**") &&
        params.includes("- **id**: the key") &&
        params.includes("- **n** (`int`): count") &&
        params.includes("**Returns**: rows") &&
        params.includes("**@pii**: no"),
      params,
    );
    const cte = toMarkdown(decls("WITH -- first\n  a AS (SELECT 1) SELECT * FROM a"));
    assert(cte.includes("**Common table expressions**") && cte.includes("- `a` (cte): first"), cte);
  },
);

proves(["0004-sql-docs FR-008"], "extracting documentation changes nothing it reads and gives the same result for the same input", () => {
  const p = parse("-- one\nCREATE TABLE t (\n  a INT -- two\n);\n-- three\nSELECT 1");
  const before = [
    toSexp(p.script),
    p.comments.map((c) => c.text).join("|"),
    p.attachments.all.map((a) => `${a.placement}${a.node.kind}`).join("|"),
  ];
  const a = documentScript(p);
  const b = documentScript(p);
  assertEquals(toMarkdown(a), toMarkdown(b));
  assertEquals(
    a.map((d) => d.doc?.raw),
    b.map((d) => d.doc?.raw),
  );
  assertEquals(
    [toSexp(p.script), p.comments.map((c) => c.text).join("|"), p.attachments.all.map((x) => `${x.placement}${x.node.kind}`).join("|")],
    before,
  );
});
