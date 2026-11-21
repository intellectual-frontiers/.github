/**
 * The attachment of comments to nodes (commons data 0066-sql-ast-parser): one rule, the same in every dialect, gives each comment its node and placement; and every comment of a text is attached exactly once,
 * whether the statement around it was read or not.
 *
 * Spec: 0066-sql-ast-parser FR-014, FR-015
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { ansi, commentsOf, type Dialect, type Node, parse, walk } from "@intellectual-frontiers/data/sql/lang";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/lang/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/lang/dialects/sqlite";
import { sources } from "../tools/golden-lang.ts";
import { CORPUS, GOLDEN, GOLDEN_DIALECTS } from "./lang-fixture.ts";

/** Each comment as `placement node-kind "text"`, in the order of the text. */
const placed = (sql: string, d: Dialect = ansi): readonly string[] => {
  const p = parse(sql, d);
  return p.attachments.all.map((a) => `${a.placement} ${a.node.kind} ${JSON.stringify(a.comment.text.trim())}`);
};

proves(
  ["0066-sql-ast-parser FR-014"],
  "each comment is attached by one rule: leading to the child after it on a line of its own, detached where a blank line follows, trailing to the child before it where it shares the line, and dangling where nothing is near",
  () => {
    assertEquals(placed("-- a\nSELECT 1"), ['leading select "a"']);
    assertEquals(placed("/* a */ SELECT 1"), ['leading select "a"']);
    assertEquals(placed("SELECT 1 -- a"), ['trailing select "a"']);
    assertEquals(placed("SELECT 1; -- a\nSELECT 2"), ['trailing select "a"']);
    assertEquals(placed("-- a\n\nSELECT 1"), ['detached script "a"']);
    assertEquals(placed("SELECT 1;\n-- a"), ['trailing select "a"']);
    assertEquals(placed("-- a"), ['dangling script "a"']);
    assertEquals(placed("SELECT 1;\n-- a\nSELECT 2"), ['leading select "a"']);
    assertEquals(placed("SELECT a,\n  -- x\n  b FROM t"), ['leading select-item "x"']);
    assertEquals(placed("SELECT a, /* x */ b FROM t"), ['trailing select-item "x"']);
    assertEquals(placed("SELECT /* x */ a FROM t"), ['leading select-item "x"']);
    assertEquals(placed("SELECT sum(x) OVER (/* x */) FROM t"), ['dangling window-spec "x"']);
    assertEquals(placed("SELECT 1\n-- a\n\nFROM t".replace("\n\nFROM t", "")), ['trailing select "a"']);
    const ddl = "-- the table\nCREATE TABLE t (\n  -- the key\n  id INT PRIMARY KEY, -- trailing\n  name TEXT\n  -- the end\n)";
    assertEquals(placed(ddl), [
      'leading create-table "the table"',
      'leading column-def "the key"',
      'trailing column-def "trailing"',
      'trailing column-def "the end"',
    ]);
    const p = parse(ddl);
    const table = p.script.statements[0];
    assert(table?.kind === "create-table");
    assertEquals(
      commentsOf(p.attachments, table).leading.map((c) => c.text.trim()),
      ["the table"],
    );
    const id = table.elements[0];
    assert(id !== undefined);
    const c = commentsOf(p.attachments, id);
    assertEquals([c.leading.length, c.trailing.length, c.dangling.length, c.detached.length], [1, 1, 0, 0]);
    assertEquals(commentsOf(p.attachments, table.name), { leading: [], trailing: [], dangling: [], detached: [] });
    for (const d of [ansi, sqlite, postgres])
      assertEquals(placed("-- a\nSELECT 1 -- b", d), ['leading select "a"', 'trailing select "b"'], d.name);
    assertEquals(placed("SELECT 1 /* x */, 2"), ['trailing select-item "x"']);
    assertEquals(parse("SELECT 1 -- a", ansi, { attach: false }).attachments.all, []);
    assertEquals(parse("SELECT 1 -- a", ansi, { attach: false }).comments.length, 1, "the comments are returned either way");
  },
);

proves(
  ["0066-sql-ast-parser FR-015"],
  "every comment of a text is in the table once, in order, for each node its own by placement, whether or not the statement around it was read",
  () => {
    const texts: { readonly sql: string; readonly d: Dialect }[] = [{ sql: CORPUS, d: ansi }];
    for (const [dir, name] of sources()) {
      const d = GOLDEN_DIALECTS[dir];
      if (d !== undefined) texts.push({ sql: readFileSync(join(GOLDEN, dir, `${name}.sql`), "utf8"), d });
    }
    texts.push({ sql: "SELECT FROM /* in a bad statement */ t; -- after\n/* c */ SELECT ( /* d */", d: ansi });
    let total = 0;
    for (const { sql, d } of texts) {
      const p = parse(sql, d);
      total += p.comments.length;
      assertEquals(p.attachments.all.length, p.comments.length);
      for (const [i, a] of p.attachments.all.entries()) assert(a.comment === p.comments[i], "in order, one each");
      let seen = 0;
      const nodes: Node[] = [];
      walk(p.script, {
        enter: (n) => {
          nodes.push(n);
          return undefined;
        },
      });
      for (const n of nodes) {
        const c = commentsOf(p.attachments, n);
        seen += c.leading.length + c.trailing.length + c.dangling.length + c.detached.length;
      }
      assertEquals(seen, p.comments.length, "every comment is found through a node of the tree");
      for (const a of p.attachments.all) assert(nodes.includes(a.node), "the node is in the tree");
    }
    assert(total > 15, `${total} comments were checked`);
    const bad = parse("SELECT FROM /* in a bad statement */ t");
    assertEquals(
      bad.attachments.all.map((a) => `${a.placement} ${a.node.kind}`),
      ["dangling unparsed"],
    );
  },
);
