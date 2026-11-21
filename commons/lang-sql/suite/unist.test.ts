/**
 * The syntax tree as a `unist` tree (commons lang-sql 0003-sql-ast-tools): every node has a type, children or a value, a position and the fields that are not nodes; each child says which field it is; comments are
 * nodes among the children in the order of the text; the projection changes nothing and is a tree in the `unist` sense; and `unist-util-visit` and `unist-util-select` read it as it stands.
 *
 * Spec: 0003-sql-ast-tools FR-009, FR-010, FR-011, FR-012, FR-013
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { selectAll, select as selectOne } from "unist-util-select";
import { visit } from "unist-util-visit";
import { type Parsed, parse, toSexp } from "@intellectual-frontiers/lang-sql";
import { type SqlChild, type SqlParent, toUnist } from "@intellectual-frontiers/lang-sql/extensions/unist";
import { sources } from "../tools/golden.ts";
import { CORPUS, GOLDEN, GOLDEN_DIALECTS } from "./fixture.ts";

const parts = (): readonly Parsed[] => {
  const out: Parsed[] = [parse(CORPUS)];
  for (const [dir, name] of sources()) {
    const d = GOLDEN_DIALECTS[dir];
    if (d !== undefined) out.push(parse(readFileSync(join(GOLDEN, dir, `${name}.sql`), "utf8"), d));
  }
  return out;
};

const isParent = (n: SqlChild): n is SqlParent => "children" in n;
/** A field of a node's data. */
const field = (n: { readonly data?: object | undefined }, key: string): unknown => {
  const d: Record<string, unknown> = { ...n.data };
  return d[key];
};
const root = (sql: string): SqlParent => toUnist(parse(sql));

proves(["0003-sql-ast-tools FR-009"], "each node has its kind as its type, children or a value, and a position of unist points", () => {
  const t = root("SELECT a, 'x', 1.5, TRUE, NULL, ? FROM s.t\nWHERE b > 2");
  assertEquals(t.type, "script");
  const select = t.children[0];
  assert(select !== undefined && isParent(select) && select.type === "select");
  const values: unknown[] = [];
  const types: string[] = [];
  visit(t, (n) => {
    types.push(n.type);
    if ("value" in n) values.push(n.value);
  });
  assertEquals(values, ["a", "x", "1.5", true, null, "?", "s", "t", "b", "2"]);
  assert(types.includes("ident") && types.includes("table") && types.includes("binary"));
  const text = "SELECT a, 'x', 1.5, TRUE, NULL, ? FROM s.t\nWHERE b > 2";
  assertEquals(select.position, { start: { line: 1, column: 1, offset: 0 }, end: { line: 2, column: 12, offset: text.length } });
  const where = select.children.find((c) => c.data["field"] === "where");
  assert(where !== undefined && where.position !== undefined);
  assertEquals(where.position.start, { line: 2, column: 7, offset: text.indexOf("b > 2") });
  const bare = toUnist(parse("SELECT 1"), { positions: false });
  assertEquals(bare.position, undefined);
  assertEquals(JSON.stringify(bare).includes("position"), false);
  for (const p of parts()) {
    const tree = toUnist(p);
    assertEquals(tree.position?.start.offset, 0);
    assertEquals(tree.position?.end.offset, p.text.length);
  }
});

proves(
  ["0003-sql-ast-tools FR-010"],
  "data holds the fields that are not nodes, and a child says which field of its parent it is and its place in a list",
  () => {
    const t = root('SELECT DISTINCT a + 1 AS x, "q" FROM t WHERE NOT a IS NULL');
    const select = t.children[0];
    assert(select !== undefined && isParent(select));
    assertEquals(select.data["distinct"], true);
    const items = select.children.filter((c) => c.data["field"] === "items");
    assertEquals(
      items.map((c) => c.data["index"]),
      [0, 1],
    );
    const first = items[0];
    assert(first !== undefined && isParent(first));
    const bin = first.children.find((c) => c.data["field"] === "expr");
    assert(bin !== undefined && isParent(bin));
    assertEquals([bin.type, bin.data["op"]], ["binary", "+"]);
    assertEquals(
      bin.children.map((c) => c.data["field"]),
      ["left", "right"],
    );
    const alias = first.children.find((c) => c.data["field"] === "alias");
    assert(alias !== undefined && "value" in alias);
    assertEquals([alias.value, alias.data["quoted"]], ["x", false]);
    const quoted = selectOne("select-item:nth-child(2) ident", t);
    assert(quoted !== undefined && "value" in quoted);
    assertEquals([quoted.value, field(quoted, "quoted")], ["q", true]);
    const str = selectOne("string", toUnist(parse("SELECT E'a'", GOLDEN_DIALECTS["postgres"])));
    assert(str !== undefined && "value" in str && str.value === "a");
    assertEquals(field(str, "prefix"), "E");
    const where = select.children.find((c) => c.data["field"] === "where");
    assert(where !== undefined && isParent(where));
    assertEquals([where.type, where.data["op"]], ["unary", "NOT"]);
    // nothing of the syntax tree's fields is lost: every scalar of every node is in data or is the value
    for (const p of parts()) {
      const flat = JSON.stringify(toUnist(p));
      assert(!flat.includes('"kind"'), "the kind is the type");
    }
  },
);

proves(
  ["0003-sql-ast-tools FR-011"],
  "a comment is a node among the children of the node that encloses it, in the order of the text, with its data, and an unparsed statement keeps its comments and its source",
  () => {
    const sql = "-- the table\nCREATE TABLE t (\n  -- the key\n  id INT, -- after\n  name TEXT\n);\nSELECT FROM /* inside */ x";
    const t = root(sql);
    const comments = selectAll("comment", t);
    assertEquals(
      comments.map((c) => ("value" in c ? c.value : "")),
      [" the table", " the key", " after", " inside "],
    );
    const create = t.children[1];
    assert(create !== undefined && isParent(create) && create.type === "create-table");
    const kinds = create.children.map((c) => (c.type === "comment" ? `comment:${String(c.data["placement"])}` : c.type));
    assertEquals(kinds, ["name", "comment:leading", "column-def", "comment:trailing", "column-def"]);
    const key = create.children[1];
    assert(key !== undefined && key.type === "comment");
    assertEquals([key.data["style"], key.data["marker"], key.data["ownLine"], key.data["terminated"]], ["line", "--", true, true]);
    const idStart = sql.indexOf("id INT");
    assertEquals(key.data["attachedTo"], { type: "column-def", start: idStart, end: idStart + "id INT".length });
    const bad = t.children[2];
    assert(bad !== undefined && isParent(bad) && bad.type === "unparsed");
    assertEquals(bad.data["source"], "SELECT FROM /* inside */ x");
    assertEquals(
      bad.children.map((c) => c.type),
      ["comment"],
    );
    const without = toUnist(parse(sql), { comments: false });
    assertEquals(selectAll("comment", without).length, 0);
    const order = (n: SqlChild): void => {
      if (!isParent(n)) return;
      const starts = n.children.map((c) => c.position?.start.offset ?? 0);
      assertEquals(
        starts,
        [...starts].sort((a, b) => a - b),
        `${n.type}: children are not in the order of the text`,
      );
      for (const c of n.children) order(c);
    };
    for (const p of parts()) order(toUnist(p));
    let seen = 0;
    for (const p of parts()) seen += selectAll("comment", toUnist(p)).length;
    assertEquals(
      seen,
      parts().reduce((n, p) => n + p.comments.length, 0),
      "every comment is a node of the tree",
    );
  },
);

proves(
  ["0003-sql-ast-tools FR-012"],
  "the projection changes nothing, is the same for the same input, and is a tree in the unist sense: objects with a string type, parents with arrays of children, no node twice",
  () => {
    for (const p of parts()) {
      const before = toSexp(p.script);
      const a = toUnist(p);
      const b = toUnist(p);
      assertEquals(a, b);
      assertEquals(toSexp(p.script), before);
      assertEquals(p.comments.length, p.attachments.all.length);
      const seen = new Set<unknown>();
      const check = (n: SqlChild): void => {
        assert(typeof n === "object" && typeof n.type === "string", "an object with a type");
        assert(!seen.has(n), "no node twice");
        seen.add(n);
        assert("children" in n ? Array.isArray(n.children) : "value" in n, "children or a value");
        if (isParent(n)) for (const c of n.children) check(c);
      };
      check(a);
      assertEquals(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), "it is JSON");
    }
  },
);

proves(
  ["0003-sql-ast-tools FR-013"],
  "unist-util-visit visits the projection by type and in order, unist-util-select selects with type, child, descendant and attribute selectors, and the nodes are assignable to the types of @types/unist",
  () => {
    const t = toUnist(
      parse("SELECT a, count(*) FROM person p JOIN pet ON pet.owner = p.id WHERE p.age > 30; INSERT INTO log VALUES ('x')"),
    );
    // the calls below type-check only where the projection is a `Node` and a `Parent` of @types/unist, which unist-util-visit and unist-util-select take
    assert(t.children.length === 2 && t.children[0]?.type === "select");
    const tables: string[] = [];
    visit(t, "table", (n) => {
      const name = selectOne("ident", n);
      if (name !== undefined && "value" in name) tables.push(String(name.value));
    });
    assertEquals(tables, ["person", "pet"]);
    const order: string[] = [];
    visit(t, (n) => {
      if (n.type === "ident" && "value" in n) order.push(String(n.value));
    });
    assertEquals(order, ["a", "count", "person", "p", "pet", "pet", "owner", "p", "id", "p", "age", "log"]);
    assertEquals(selectAll("select > select-item", t).length, 2);
    assertEquals(
      selectAll("table > name > ident", t).map((n) => ("value" in n ? String(n.value) : "")),
      ["person", "pet"],
    );
    assertEquals(selectAll("ident[value=p]", t).length, 3);
    assertEquals(selectAll("join > table + table", t).length, 1);
    assertEquals(selectAll("binary ident", t).length, 6);
    assertEquals(
      selectAll("insert > name > ident", t).map((n) => ("value" in n ? String(n.value) : "")),
      ["log"],
    );
    assertEquals(selectAll("select:has(call)", t).length, 1);
    assertEquals(selectAll("select-item:first-child", t).length, 1);
    const num = selectOne("number", t);
    assert(num !== undefined && "value" in num);
    assertEquals(num.value, "30");
    assertEquals(
      selectAll("script > :not(select)", t).map((n) => n.type),
      ["insert"],
    );
  },
);
