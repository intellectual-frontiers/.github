/**
 * Rewriting a syntax tree (commons lang-sql 0003-sql-ast-tools): rules by sort, from the leaves up, that cannot return a node of another sort; a rewrite that changes nothing returns its input, the tree it is given
 * is not changed, and only a changed node and the nodes above it are new; ranges are kept; and every kind of node is handled.
 *
 * Spec: 0003-sql-ast-tools FR-001, FR-002, FR-003, FR-004
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  build,
  type Expr,
  type Ident,
  type Name,
  type Node,
  type Parsed,
  parse,
  type Query,
  rewriteExpr,
  rewriteQuery,
  rewriteScript,
  rewriteSource,
  rewriteStatement,
  type Rules,
  type Script,
  type Statement,
  toSexp,
  walk,
  findAll,
} from "@intellectual-frontiers/lang-sql";
import { sources } from "../tools/golden.ts";
import { CORPUS, GOLDEN, GOLDEN_DIALECTS, firstItem, show } from "./fixture.ts";

const ok = (sql: string): Parsed => {
  const p = parse(sql);
  assertEquals(p.errors, [], sql);
  return p;
};

const every = (): readonly Script[] => {
  const out: Script[] = [parse(CORPUS).script];
  for (const [dir, name] of sources()) {
    const d = GOLDEN_DIALECTS[dir];
    if (d !== undefined) out.push(parse(readFileSync(join(GOLDEN, dir, `${name}.sql`), "utf8"), d).script);
  }
  return out;
};

const upper = (i: Ident): Ident | undefined => (i.name === i.name.toUpperCase() ? undefined : { ...i, name: i.name.toUpperCase() });

proves(
  ["0003-sql-ast-tools FR-001"],
  "rules by sort are called from the leaves up for each node in a place of that sort, return a node of the same sort or nothing, and the result has the type of what was given",
  () => {
    const p = ok("SELECT a + 1 AS x FROM t JOIN u ON t.id = u.id WHERE b IN (SELECT c FROM v)");
    // columns become expressions: the expr rule may return any expression
    const replaced = rewriteScript(p.script, {
      expr: (e) =>
        e.kind === "name" && e.parts.length === 1 && e.parts[0]?.name === "a" ? build.binary(e, "*", e, build.number(e, "2")) : undefined,
    });
    const s = replaced.statements[0];
    assert(s?.kind === "select");
    assertEquals(show(s.items[0]?.expr ?? build.null({ start: 0, end: 0 })), "((a * 2) + 1)");
    // names in name-typed places: the tables and nothing else
    const seen: string[] = [];
    rewriteScript(p.script, {
      name: (n) => {
        seen.push(n.parts.map((x) => x.name).join("."));
        return undefined;
      },
    });
    assertEquals(seen, ["t", "u", "v"], "a column is an expression, a table's name is a name");
    const exprs: string[] = [];
    rewriteScript(p.script, { expr: (e) => (exprs.push(e.kind), undefined) });
    assert(exprs.includes("name") && exprs.includes("in-query") && exprs.includes("binary"));
    // from the leaves up: an inner node is rewritten before the node that holds it
    const order: string[] = [];
    rewriteExpr(firstItem(ok("SELECT (a + b) * c")), {
      expr: (e) => {
        order.push(e.kind === "binary" ? e.op : e.kind);
        return undefined;
      },
    });
    assertEquals(order, ["name", "name", "+", "name", "*"]);
    // each entry point gives back its own sort, and calls its own sort's rule at the top
    const sel = ok("SELECT 1").script.statements[0];
    assert(sel?.kind === "select");
    const q: Query = rewriteQuery(sel, { query: (x) => (x.kind === "select" ? { ...x, distinct: true } : undefined) });
    assert(q.kind === "select" && q.distinct);
    const table = findAll(ok("SELECT 1 FROM t").script, "table")[0];
    assert(table !== undefined);
    const src = rewriteSource(table, { name: (n: Name) => build.name(n, "renamed") });
    assert(src.kind === "table" && src.name.parts[0]?.name === "renamed");
    const drop = ok("DROP TABLE t").script.statements[0];
    assert(drop?.kind === "drop");
    const stmt: Statement = rewriteStatement(drop, { statement: (x) => (x.kind === "drop" ? { ...x, ifExists: true } : undefined) });
    assert(stmt.kind === "drop" && stmt.ifExists);
    // @ts-expect-error a rule for expressions cannot return a query
    const bad: Rules = { expr: (e) => (e.kind === "exists" ? e.query : undefined) };
    assert(bad.expr !== undefined);
    // @ts-expect-error a rule for identifiers cannot return a name
    const bad2: Rules = { ident: (i) => build.name(i, i.name) };
    assert(bad2.ident !== undefined);
    // @ts-expect-error a rule for queries cannot return an expression
    const bad3: Rules = { query: () => build.null({ start: 0, end: 0 }) };
    assert(bad3.query !== undefined);
  },
);

proves(
  ["0003-sql-ast-tools FR-002"],
  "a rewrite changes nothing it is given, returns the same object for what no rule changed and for the whole tree where nothing changed, and makes new objects only for a changed node and those above it",
  () => {
    for (const script of every()) {
      assert(rewriteScript(script, {}) === script, "no rules");
      assert(
        rewriteScript(script, {
          ident: () => undefined,
          expr: (e) => e,
          query: (q) => q,
          source: (s) => s,
          statement: (s) => s,
          name: (n) => n,
        }) === script,
        "rules that change nothing",
      );
    }
    const p = ok("SELECT a, b FROM t WHERE c = 1; SELECT 2");
    const before = toSexp(p.script);
    const second = p.script.statements[1];
    const out = rewriteScript(p.script, { ident: (i) => (i.name === "b" ? { ...i, name: "B" } : undefined) });
    assertEquals(toSexp(p.script), before, "the input is the same");
    assert(out !== p.script && out.statements[1] === second, "the untouched statement is the same object");
    const a = p.script.statements[0];
    const b = out.statements[0];
    assert(a?.kind === "select" && b?.kind === "select" && a !== b);
    assert(b.items[0] === a.items[0], "the untouched item is the same object");
    assert(b.items[1] !== a.items[1], "the changed item is new");
    assert(b.from === a.from && b.where === a.where, "the untouched clauses are the same");
    assertEquals(b.items[1]?.expr.kind === "name" ? b.items[1].expr.parts[0]?.name : "", "B");
  },
);

proves(
  ["0003-sql-ast-tools FR-003"],
  "a rewrite keeps the range of every node it does not replace, gives a replacement the range its rule gave it, and the builders take the range of what they stand for",
  () => {
    const p = ok("SELECT a FROM t WHERE b = 1");
    const out = rewriteScript(p.script, { expr: (e) => (e.kind === "number" ? build.number(e, "2") : undefined) });
    const ranges = (n: Node): string[] => {
      const r: string[] = [];
      walk(n, {
        enter: (x) => {
          r.push(`${x.kind}@${x.start}-${x.end}`);
          return undefined;
        },
      });
      return r;
    };
    assertEquals(ranges(out), ranges(p.script), "the same ranges, the number's included: it was given the range of what it replaced");
    const at = { start: 10, end: 14 };
    const made = [
      build.ident(at, "x"),
      build.name(at, "s", "t"),
      build.number(at, "1"),
      build.string(at, "v", "E"),
      build.boolean(at, true),
      build.null(at),
      build.star(at),
      build.unary(at, "-", build.number(at, "1")),
      build.binary(at, "+", build.number(at, "1"), build.number(at, "2")),
      build.call(at, build.name(at, "f"), []),
    ];
    for (const n of made) assert(n.start === 10 && n.end === 14, n.kind);
    assertEquals(
      made.map((n) => n.kind),
      ["ident", "name", "number", "string", "boolean", "null", "star", "unary", "binary", "call"],
    );
    const name = made[1];
    assert(name?.kind === "name" && name.parts.map((x) => x.name).join(".") === "s.t");
    const e: Expr = build.binary(at, "+", build.number(at, "1"), build.number(at, "2"));
    assertEquals(show(e), "(1 + 2)");
  },
);

proves(
  ["0003-sql-ast-tools FR-004"],
  "every kind of node is handled, a rule for identifiers is called for every identifier wherever it stands, and no tree the parser makes throws",
  () => {
    const kinds = new Set<string>();
    for (const script of every()) {
      const names: string[] = [];
      walk(script, {
        enter: (n) => {
          kinds.add(n.kind);
          if (n.kind === "ident") names.push(n.name);
          return undefined;
        },
      });
      const called: string[] = [];
      const out = rewriteScript(script, {
        ident: (i) => {
          called.push(i.name);
          return upper(i);
        },
      });
      assertEquals(called, names, "the rule is called for every identifier, once, in the order of the text");
      const after: string[] = [];
      walk(out, {
        enter: (n) => {
          if (n.kind === "ident") after.push(n.name);
          return undefined;
        },
      });
      assertEquals(
        after,
        names.map((x) => x.toUpperCase()),
      );
      assertEquals(
        toSexp(rewriteScript(out, { ident: (i) => ({ ...i, name: i.name.toLowerCase() }) })).replaceAll(/\bname="[^"]*"/g, "").length,
        toSexp(script).replaceAll(/\bname="[^"]*"/g, "").length,
        "only the names changed",
      );
    }
    assert(kinds.size >= 60, `${kinds.size} kinds were rewritten`);
    const broken = parse("SELECT FROM; CREATE TABLE t (a INT); SELECT 1");
    assert(rewriteScript(broken.script, { ident: upper }).statements.length === 3);
  },
);
