/**
 * The parser of the SQL language core (commons lang-sql 0002-sql-ast-parser): it never throws and always ends; expressions are read with the precedence of SQL and associate to the left; queries bind their set
 * operations and trailing clauses as SQL does; reserved words are identifiers only after a dot or quoted; what cannot be read is an error value and the next statement is read; and a dialect's grammar adds
 * its operators, its cast and its like-words.
 *
 * Spec: 0002-sql-ast-parser FR-008, FR-009, FR-010, FR-011, FR-012, FR-013
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import fc from "fast-check";
import {
  ANSI_GRAMMAR,
  ansi,
  declareDialect,
  defineDialect,
  describeDialectError,
  describeParseError,
  type Dialect,
  parse,
  parseStrict,
  Prec,
} from "@intellectual-frontiers/lang-sql";
import { dialect as duckdb } from "@intellectual-frontiers/lang-sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/lang-sql/dialects/sqlite";
import { CORPUS, DIALECTS, firstItem, show } from "./fixture.ts";

const grouped = (expr: string, d: Dialect = ansi): string => {
  const p = parse(`SELECT ${expr}`, d);
  assertEquals(p.errors, [], expr);
  return show(firstItem(p));
};

const WORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "a",
  "b",
  "t",
  "1",
  "'x'",
  "(",
  ")",
  ",",
  ";",
  ".",
  "*",
  "+",
  "-",
  "=",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "NULL",
  "BETWEEN",
  "LIKE",
  "CASE",
  "WHEN",
  "THEN",
  "END",
  "CAST",
  "AS",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "CREATE",
  "TABLE",
  "INDEX",
  "VIEW",
  "ALTER",
  "DROP",
  "WITH",
  "UNION",
  "ORDER",
  "BY",
  "LIMIT",
  "JOIN",
  "ON",
  "OVER",
  "::",
  "->",
  "--",
  "/*",
  "'",
  '"',
  "$$",
  "[",
  "]",
  "?",
  "@",
  ":",
  "~",
  "é",
  "\n",
  " ",
];

proves(
  ["0002-sql-ast-parser FR-008"],
  "parse accepts any text in any dialect, does not throw and ends, and parseStrict gives ok where there is no error and the errors where there is any",
  () => {
    for (const d of DIALECTS) {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...WORDS), { maxLength: 30 }).map((a) => a.join(" ")),
          (text) => {
            const p = parse(text, d);
            assert(p.script.kind === "script" && p.script.start === 0 && p.script.end === text.length, `${d.name} ${JSON.stringify(text)}`);
            assertEquals(parseStrict(text, d).kind === "ok", p.errors.length === 0);
          },
        ),
        { numRuns: 500 },
      );
      fc.assert(
        fc.property(fc.string({ unit: "binary", maxLength: 60 }), (text) => {
          assert(parse(text, d).script.kind === "script");
        }),
        { numRuns: 200 },
      );
      assertEquals(parse(CORPUS, d).errors, [], `${d.name}: the corpus`);
    }
    const good = parseStrict("SELECT 1");
    assert(good.kind === "ok" && good.value.script.statements.length === 1);
    const bad = parseStrict("SELECT FROM");
    assert(bad.kind === "err" && bad.error.length === 1);
  },
);

proves(["0002-sql-ast-parser FR-009"], "expressions have the precedence of SQL and associate to the left", () => {
  assertEquals(grouped("a OR b AND c"), "(a OR (b AND c))");
  assertEquals(grouped("a AND b OR c"), "((a AND b) OR c)");
  assertEquals(grouped("NOT a = b"), "(NOT (a = b))");
  assertEquals(grouped("NOT a AND b"), "((NOT a) AND b)");
  assertEquals(grouped("a - b - c"), "((a - b) - c)");
  assertEquals(grouped("a / b * c"), "((a / b) * c)");
  assertEquals(grouped("-a * b"), "((- a) * b)");
  assertEquals(grouped("- - a"), "(- (- a))");
  assertEquals(grouped("a + b * c"), "(a + (b * c))");
  assertEquals(grouped("a + b = c * d"), "((a + b) = (c * d))");
  assertEquals(grouped("a = b = c"), "((a = b) = c)");
  assertEquals(grouped("a || b + c"), "(a || (b + c))");
  assertEquals(grouped("a = b || c"), "(a = (b || c))");
  assertEquals(grouped("a BETWEEN 1 AND 2 AND c"), "((a BETWEEN 1 AND 2) AND c)");
  assertEquals(grouped("a BETWEEN 1 + 1 AND 2 * 2"), "(a BETWEEN (1 + 1) AND (2 * 2))");
  assertEquals(grouped("a IS NULL AND b IS NOT NULL"), "((a IS null) AND (b IS NOT null))");
  assertEquals(grouped("a = 1 IS TRUE"), "((a = 1) IS true)");
  assertEquals(grouped("a IN (1, 2) OR b LIKE 'x'"), '((a IN [1, 2]) OR (b LIKE "x"))');
  assertEquals(grouped("a NOT LIKE 'x' AND NOT b"), '((a NOT LIKE "x") AND (NOT b))');
  assertEquals(grouped("(a OR b) AND c"), "((a OR b) AND c)");
  assertEquals(grouped("f(a + b, c) * 2"), "(f((a + b), c) * 2)");
  assertEquals(grouped("a::int + 1", postgres), "((a :: INT) + 1)");
  assertEquals(grouped("a + b::int", postgres), "(a + (b :: INT))");
  assertEquals(grouped("-a::int", postgres), "(- (a :: INT))");
  assertEquals(grouped("2 ^ 3 * 4", postgres), "((2 ^ 3) * 4)");
  assertEquals(grouped("a - b ^ 2", duckdb), "(a - (b ^ 2))");
  assert(
    Prec.Or < Prec.And &&
      Prec.And < Prec.Not &&
      Prec.Not < Prec.Is &&
      Prec.Is < Prec.Compare &&
      Prec.Compare < Prec.Like &&
      Prec.Like < Prec.Other,
  );
  assert(
    Prec.Other < Prec.Additive &&
      Prec.Additive < Prec.Multiplicative &&
      Prec.Multiplicative < Prec.Exponent &&
      Prec.Exponent < Prec.Unary &&
      Prec.Unary < Prec.Cast,
  );
});

proves(
  ["0002-sql-ast-parser FR-010"],
  "set operations bind INTERSECT tighter and to the left, trailing clauses belong to the whole set operation, and a query may stand in parentheses wherever a query goes",
  () => {
    const shape = (sql: string): string => {
      const q = parse(sql).script.statements[0];
      const f = (n: typeof q): string => {
        if (n === undefined) return "?";
        if (n.kind === "set-op")
          return `(${f(n.left)} ${n.op}${n.quantifier === undefined ? "" : ` ${n.quantifier}`} ${f(n.right)})${n.orderBy.length > 0 ? " ordered" : ""}${n.limit === undefined ? "" : " limited"}`;
        if (n.kind === "select")
          return `${n.items[0]?.expr.kind === "number" ? n.items[0].expr.text : "s"}${n.orderBy.length > 0 ? "o" : ""}${n.limit === undefined ? "" : "l"}`;
        return n.kind;
      };
      return f(q);
    };
    assertEquals(shape("SELECT 1 UNION SELECT 2 INTERSECT SELECT 3"), "(1 union (2 intersect 3))");
    assertEquals(shape("SELECT 1 INTERSECT SELECT 2 UNION SELECT 3"), "((1 intersect 2) union 3)");
    assertEquals(shape("SELECT 1 UNION SELECT 2 EXCEPT SELECT 3"), "((1 union 2) except 3)");
    assertEquals(shape("SELECT 1 UNION ALL SELECT 2 ORDER BY 1 LIMIT 3"), "(1 union all 2) ordered limited");
    assertEquals(shape("(SELECT 1 ORDER BY 1) UNION SELECT 2"), "(1o union 2)");
    assertEquals(shape("SELECT 1 ORDER BY 1 LIMIT 1"), "1ol");
    const where = (sql: string): string => {
      const p = parse(sql);
      assertEquals(p.errors, [], sql);
      return p.script.statements[0]?.kind ?? "";
    };
    assertEquals(where("SELECT * FROM (SELECT 1) s"), "select");
    assertEquals(where("SELECT (SELECT 1)"), "select");
    assertEquals(where("SELECT 1 WHERE a IN (SELECT 1)"), "select");
    assertEquals(where("SELECT 1 WHERE EXISTS (SELECT 1)"), "select");
    assertEquals(where("INSERT INTO t SELECT 1"), "insert");
    assertEquals(where("INSERT INTO t (a) (SELECT 1)"), "insert");
    assertEquals(where("CREATE VIEW v AS SELECT 1 UNION SELECT 2"), "create-view");
    assertEquals(where("((SELECT 1))"), "select");
    const fetch = parse("SELECT a FROM t OFFSET 1 ROW FETCH FIRST ROW ONLY").script.statements[0];
    assert(fetch?.kind === "select" && fetch.limit?.kind === "number" && fetch.offset?.kind === "number");
    assert(
      parse("(SELECT 1 LIMIT 1) LIMIT 2").errors.length === 1,
      "a clause after a parenthesized query that has its own is not supported",
    );
  },
);

proves(
  ["0002-sql-ast-parser FR-011"],
  "a word is an identifier where the dialect does not reserve it, a reserved word only after a dot or quoted, and an alias is read with or without AS",
  () => {
    const p = parse("SELECT key, year, text, date, first FROM t");
    assertEquals(p.errors, []);
    assertEquals(parse("SELECT select FROM t").errors.length, 1);
    assertEquals(parse("SELECT from FROM t").errors.length, 1);
    assertEquals(parse('SELECT t.select, "from" FROM t').errors, []);
    const s = parse("SELECT a x, b AS y, c AS select FROM t u, v AS w").script.statements[0];
    assert(s?.kind === "select");
    assertEquals(
      s.items.map((i) => i.alias?.name),
      ["x", "y", "select"],
    );
    assertEquals(
      s.from.map((f) => (f.kind === "table" ? f.alias?.name.name : "")),
      ["u", "w"],
    );
    const t = parse("SELECT a FROM t WHERE a = 1").script.statements[0];
    assert(t?.kind === "select" && t.from[0]?.kind === "table" && t.from[0].alias === undefined, "WHERE is not an alias");
    assertEquals(parse("SELECT a FROM t LEFT JOIN u ON TRUE").errors, [], "LEFT is not an alias");
  },
);

proves(
  ["0002-sql-ast-parser FR-012"],
  "what cannot be read is an error value with a span and a sentence, the next statement is read, the lexer's errors are among the errors, and deep nesting is an error and not a stack overflow",
  () => {
    const p = parse("SELECT FROM t; SELECT 1");
    assertEquals(
      p.script.statements.map((s) => s.kind),
      ["unparsed", "select"],
    );
    assertEquals(p.errors.length, 1);
    const e = p.errors[0];
    assert(e !== undefined && e.kind === "expected");
    assertEquals([e.expected, e.found, e.span.start, e.span.end], ["an expression", '"FROM"', 7, 11]);
    assertEquals(describeParseError(e), 'expected an expression at 7, found "FROM"');
    const lexed = parse("SELECT 'abc");
    assertEquals(
      lexed.errors.map((x) => x.kind),
      ["lex"],
    );
    assert(lexed.errors[0] !== undefined && describeParseError(lexed.errors[0]).includes("not closed"));
    const mixed = parse("SELECT 1 \\ 2; SELECT 3");
    assertEquals(
      mixed.errors.map((x) => x.kind),
      ["lex", "expected"],
    );
    assertEquals(
      mixed.script.statements.map((s) => s.kind),
      ["unparsed", "select"],
    );
    const unsupported = parse("(SELECT 1 LIMIT 1) LIMIT 2");
    assertEquals(
      unsupported.errors.map((x) => x.kind),
      ["unsupported"],
    );
    assert(unsupported.errors[0] !== undefined && describeParseError(unsupported.errors[0]).includes("not supported"));
    assertEquals(
      parse("SELECT 1 2").errors.map((x) => (x.kind === "expected" ? x.expected : x.kind)),
      ["; or the end of the text"],
    );
    const deep = parse(`SELECT ${"(".repeat(1000)}1${")".repeat(1000)}`);
    assertEquals(
      deep.errors.map((x) => x.kind),
      ["too-deep"],
    );
    assert(describeParseError(deep.errors[0] ?? { kind: "too-deep", span: { start: 0, end: 0 } }).includes("nested too deeply"));
    assertEquals(parse(`SELECT ${"(".repeat(100)}1${")".repeat(100)}`).errors, [], "a hundred levels are read");
    assertEquals(
      parse(`SELECT ${"- ".repeat(500)}1`).errors.map((x) => x.kind),
      ["too-deep"],
    );
    for (const q of ["((((", "SELECT (", "CREATE TABLE", "INSERT INTO", "SELECT CASE", "SELECT CAST(", "WITH a AS", "SELECT 1 UNION"]) {
      assert(parse(q).errors.length > 0, q);
    }
  },
);

proves(
  ["0002-sql-ast-parser FR-013"],
  "a dialect's grammar adds its operators, cast and like-words, is checked against its lexical, and is inherited",
  () => {
    assertEquals(parse("SELECT a::int").errors.length, 1, "ansi has no ::");
    assertEquals(parse("SELECT a ILIKE 'x'").errors.length, 1, "ansi has no ILIKE");
    assertEquals(parse("SELECT a == b", sqlite).errors, []);
    assertEquals(grouped("a == b OR c GLOB 'x'", sqlite), '((a == b) OR (c GLOB "x"))');
    assertEquals(grouped("j->'a'->>'b' = 'c'", sqlite), '(((j -> "a") ->> "b") = "c")');
    assertEquals(grouped("a // b * 2", duckdb), "((a // b) * 2)");
    assertEquals(grouped("a ** b ** c", duckdb), "((a ** b) ** c)");
    assertEquals(grouped("x ILIKE 'a' AND y GLOB 'b'", duckdb), '((x ILIKE "a") AND (y GLOB "b"))');
    assertEquals(grouped("a #> b @> c", postgres), "((a #> b) @> c)");
    assert(sqlite.grammar.castOperator === undefined && postgres.grammar.castOperator === "::" && duckdb.grammar.castOperator === "::");
    assertEquals(ansi.grammar, ANSI_GRAMMAR);
    const unknownOp = defineDialect({
      name: "x",
      extends: ansi,
      lexical: (l) => l,
      grammar: (g) => ({ ...g, operators: [{ text: "<=>", prec: Prec.Compare }] }),
    });
    assert(unknownOp.kind === "err" && unknownOp.error.kind === "grammar" && describeDialectError(unknownOp.error).includes("<=>"));
    const unknownCast = defineDialect({ name: "x", extends: ansi, lexical: (l) => l, grammar: (g) => ({ ...g, castOperator: "::" }) });
    assert(unknownCast.kind === "err");
    const unknownWord = defineDialect({ name: "x", extends: ansi, lexical: (l) => l, grammar: (g) => ({ ...g, likeWords: ["ILIKE"] }) });
    assert(unknownWord.kind === "err" && describeDialectError(unknownWord.error).includes("ILIKE"));
    const child = declareDialect({ name: "child", extends: postgres, lexical: (l) => l });
    assertEquals(child.grammar, postgres.grammar, "a dialect with no grammar of its own keeps its parent's");
    assertEquals(parse("SELECT a::int, x ILIKE 'a'", child).errors, []);
    const grand = declareDialect({
      name: "grand",
      extends: child,
      lexical: (l) => ({ ...l, operators: [...l.operators, "<=>"] }),
      grammar: (g) => ({ ...g, operators: [...g.operators, { text: "<=>", prec: Prec.Compare }] }),
    });
    assertEquals(grouped("a <=> b + 1", grand), "(a <=> (b + 1))");
  },
);
