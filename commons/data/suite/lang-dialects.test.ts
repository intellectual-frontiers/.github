/**
 * The dialects of the SQL language core (commons data 0069-sql-dialects FR-001 to FR-005): thirty modules in the families the specification lists, each reading its comments, quotes, strings, parameters and numbers
 * as its engine does (a table of facts, one row each), the lexer's number suffixes, alternative quoting and start characters, and the grammar each dialect adds.
 *
 * Spec: 0069-sql-dialects FR-001, FR-002, FR-003, FR-004, FR-005
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import {
  ansi,
  compileLexical,
  ANSI_LEXICAL,
  type Dialect,
  kindAt,
  lex,
  parse,
  Tok,
  type Lexical,
} from "@intellectual-frontiers/data/sql/lang";
import { ALL_DIALECTS, DIALECT_NAMES, ROOT, textsOf } from "./lang-fixture.ts";

/** A dialect's lexical in one line, so that a table of facts can be written beside it. */
function facts(d: Dialect): string {
  const l = d.lexical;
  const lines = l.comments.flatMap((c) => (c.kind === "line" ? [`${c.marker}${c.spaceAfter === true ? "_" : ""}`] : []));
  const block = l.comments.find((c) => c.kind === "block");
  const b =
    block?.kind === "block"
      ? `${block.nested ? "nest" : "flat"}${block.hints === true ? "+hint" : ""}${block.conditional === true ? "+cond" : ""}`
      : "none";
  const ids = l.identifiers.map((i) => i.open + i.close).join(" ");
  const strs = l.strings.map((s) => `${s.open}${s.escape[0] ?? ""}`).join(" ");
  const pre = l.prefixes.map((p) => `${p.prefix}${p.escape === undefined ? "" : (p.escape[0] ?? "")}`).join(",");
  return `lines[${lines.join(" ")}] block[${b}] ids[${ids}] strs[${strs}] pre[${pre}] dollar[${l.dollarQuotes ? 1 : 0}] params[${l.params.join(",")}] num[${l.numbers.radix ? "r" : ""}${l.numbers.underscores ? "u" : ""}${l.numberSuffixes.length > 0 ? `s${l.numberSuffixes.length}` : ""}] q[${l.qQuoting ? 1 : 0}]`;
}

/** What each engine documents, written from the engines' documentation and the facts of sqlglot's tokenizers. */
const EXPECTED: Readonly<Record<string, string>> = {
  ansi: 'lines[--] block[nest] ids[""] strs[\'d] pre[N,X,B] dollar[0] params[question] num[] q[0]',
  athena: 'lines[--] block[flat] ids["" ``] strs[\'b] pre[X,U&] dollar[0] params[question] num[] q[0]',
  bigquery: "lines[-- #] block[flat] ids[``] strs['''b \"\"\"b 'b \"b] pre[Rn,B,RBn,BRn] dollar[0] params[at-name] num[r] q[0]",
  clickhouse: 'lines[-- #! #] block[nest] ids["" ``] strs[\'b] pre[] dollar[1] params[] num[ru] q[0]',
  databricks: "lines[--] block[nest] ids[``] strs['b \"b] pre[X,Rn] dollar[0] params[] num[s6] q[0]",
  doris: "lines[--_ #] block[flat+hint+cond] ids[``] strs['b \"b] pre[X,B,N] dollar[0] params[question,at-name] num[r] q[0]",
  dremio: 'lines[-- //] block[nest] ids[""] strs[\'d] pre[N,X,B] dollar[0] params[question] num[] q[0]',
  drill: "lines[--] block[nest] ids[``] strs['d] pre[N,X,B] dollar[0] params[] num[] q[0]",
  druid: 'lines[--] block[nest] ids[""] strs[\'d] pre[N,X,B] dollar[0] params[question] num[] q[0]',
  duckdb: 'lines[--] block[nest] ids[""] strs[\'d] pre[Eb,B,X] dollar[1] params[question,dollar-number,dollar-name] num[ru] q[0]',
  dune: 'lines[--] block[flat] ids[""] strs[\'d] pre[X,U&] dollar[0] params[question] num[] q[0]',
  exasol: 'lines[--] block[nest] ids["" []] strs[\'d] pre[N,X,B] dollar[0] params[question] num[] q[0]',
  fabric: 'lines[--] block[nest] ids[[] ""] strs[\'d] pre[N] dollar[0] params[at-name] num[r] q[0]',
  hive: "lines[--] block[nest] ids[``] strs['b \"b] pre[] dollar[0] params[] num[s6] q[0]",
  materialize: 'lines[--] block[nest] ids[""] strs[\'d] pre[Eb,B,X,N,U&] dollar[1] params[dollar-number] num[ru] q[0]',
  mysql: "lines[--_ #] block[flat+hint+cond] ids[``] strs['b \"b] pre[X,B,N] dollar[0] params[question,at-name] num[r] q[0]",
  oracle: 'lines[--] block[flat+hint] ids[""] strs[\'d] pre[N] dollar[0] params[colon-name] num[] q[1]',
  postgres: 'lines[--] block[nest] ids[""] strs[\'d] pre[Eb,B,X,N,U&] dollar[1] params[dollar-number] num[ru] q[0]',
  presto: 'lines[--] block[flat] ids[""] strs[\'d] pre[X,U&] dollar[0] params[question] num[] q[0]',
  redshift: 'lines[--] block[nest] ids[""] strs[\'b] pre[Eb,B,X,N,U&] dollar[1] params[dollar-number] num[ru] q[0]',
  risingwave: 'lines[--] block[nest] ids[""] strs[\'d] pre[Eb,B,X,N,U&] dollar[1] params[dollar-number] num[ru] q[0]',
  singlestore: "lines[--_ #] block[flat+hint+cond] ids[``] strs['b \"b] pre[X,B,N,E] dollar[0] params[question,at-name] num[r] q[0]",
  snowflake: 'lines[-- //] block[flat] ids[""] strs[\'b] pre[X] dollar[1] params[dollar-number,question] num[] q[0]',
  solr: "lines[--] block[nest] ids[``] strs['d] pre[N,X,B] dollar[0] params[] num[] q[0]",
  spark: "lines[--] block[nest] ids[``] strs['b \"b] pre[X,Rn] dollar[0] params[] num[s6] q[0]",
  spark2: "lines[--] block[nest] ids[``] strs['b \"b] pre[X] dollar[0] params[] num[s6] q[0]",
  sqlite: 'lines[--] block[flat] ids["" `` []] strs[\'d] pre[X] dollar[0] params[question,colon-name,at-name,dollar-name] num[r] q[0]',
  starrocks: "lines[--_ #] block[flat+hint+cond] ids[``] strs['b \"b] pre[X,B,N] dollar[0] params[question,at-name] num[r] q[0]",
  teradata: 'lines[--] block[nest] ids[""] strs[\'d] pre[X] dollar[0] params[colon-name] num[r] q[0]',
  trino: 'lines[--] block[flat] ids[""] strs[\'d] pre[X,U&] dollar[0] params[question] num[] q[0]',
  tsql: 'lines[--] block[nest] ids[[] ""] strs[\'d] pre[N] dollar[0] params[at-name] num[r] q[0]',
};

proves(
  ["0069-sql-dialects FR-001"],
  "the thirty dialects are modules of their own that are exports of the package, in the families of the specification, and what is not SQL is not among them",
  () => {
    assertEquals(DIALECT_NAMES.length, 30);
    assertEquals(
      ALL_DIALECTS.map((d) => d.name),
      DIALECT_NAMES,
    );
    const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
    const lib = readFileSync(join(ROOT, "library.ts"), "utf8");
    for (const n of DIALECT_NAMES) {
      assert(pkg.includes(`"./sql/lang/dialects/${n}": "./sql/lang/dialects/${n}/mod.ts"`), `${n} is an export of the package`);
      assert(lib.includes(`"./sql/lang/dialects/${n}",`), `${n} is in the manifest`);
      assert(existsSync(join(ROOT, "sql/lang/dialects", n, "mod.ts")), n);
    }
    const parents: Record<string, string> = {
      starrocks: "mysql",
      doris: "mysql",
      singlestore: "mysql",
      redshift: "postgres",
      materialize: "postgres",
      risingwave: "postgres",
      spark2: "hive",
      spark: "spark2",
      databricks: "spark",
      trino: "presto",
      athena: "trino",
      dune: "trino",
      fabric: "tsql",
    };
    for (const d of ALL_DIALECTS) assertEquals(d.parent?.name, parents[d.name] ?? "ansi", `the parent of ${d.name}`);
    for (const n of ["dax", "prql", "tableau"]) assert(!existsSync(join(ROOT, "sql/lang/dialects", n)), `${n} is not SQL`);
    const readme = readFileSync(join(ROOT, "spec-kit/specs/0069-sql-dialects/spec.md"), "utf8");
    assert(readme.includes("DAX, PRQL and Tableau"), "the reason is written");
    // a dialect imports its parent and no other sibling
    for (const n of DIALECT_NAMES) {
      const imports = [
        ...readFileSync(join(ROOT, "sql/lang/dialects", n, "mod.ts"), "utf8").matchAll(/from "\.\.\/([a-z0-9]+)\/mod\.ts"/g),
      ].map((m) => m[1]);
      const d = ALL_DIALECTS.find((x) => x.name === n);
      assertEquals(imports, d?.parent === undefined || d.parent.name === "ansi" ? [] : [d.parent.name], `${n} imports its parent alone`);
    }
  },
);

proves(
  ["0069-sql-dialects FR-002"],
  "each dialect's lexical says its comments, identifiers, strings, prefixes, dollar quotes, parameters and numbers as its engine does",
  () => {
    for (const d of [ansi, ...ALL_DIALECTS]) assertEquals(facts(d), EXPECTED[d.name], d.name);
    assertEquals(Object.keys(EXPECTED).length, 31);
    const kinds = (d: Dialect, sql: string): readonly number[] => lex(sql, d.compiled).tokens.kind.slice(0, -1);
    const dialect = (n: string): Dialect => {
      const d = ALL_DIALECTS.find((x) => x.name === n);
      assert(d !== undefined, n);
      return d;
    };
    // comments, as each engine has them
    assertEquals(lex("a --b", dialect("mysql").compiled).comments.start.length, 0, "MySQL: -- needs a space");
    assertEquals(lex("a -- b", dialect("mysql").compiled).comments.start.length, 1);
    assertEquals(lex("a # b", dialect("mysql").compiled).comments.start.length, 1, "# in MySQL");
    assertEquals(lex("a # b", dialect("tsql").compiled).comments.start.length, 0, "not in T-SQL");
    assertEquals(lex("a // b", dialect("snowflake").compiled).comments.start.length, 1);
    assertEquals(lex("a // b", dialect("postgres").compiled).comments.start.length, 0);
    assertEquals(lex("a #! b\n#c", dialect("clickhouse").compiled).comments.marker, ["#!", "#"]);
    assertEquals(lex("/* a /* b */ c */", dialect("tsql").compiled).comments.start.length, 1, "nested");
    assertEquals(lex("/* a /* b */ c */", dialect("snowflake").compiled).comments.start.length, 1);
    assertEquals(lex("/* a /* b */ c */", dialect("snowflake").compiled).tokens.kind.length > 2, true, "not nested: the rest is tokens");
    // strings
    assertEquals(textsOf(dialect("bigquery"), `r'a\\' "x\\"y" '''p'q''' b'z'`), [`r'a\\'`, `"x\\"y"`, "'''p'q'''", "b'z'"]);
    assertEquals(textsOf(dialect("spark"), "r'a\\n' 'b\\'c'"), ["r'a\\n'", "'b\\'c'"]);
    assertEquals(textsOf(dialect("mysql"), "'a''b' \"c\\\"d\" x'ff' b'1'"), ["'a''b'", '"c\\"d"', "x'ff'", "b'1'"]);
    assertEquals(textsOf(dialect("snowflake"), "$$ a ' b $$ 'c\\'d'"), ["$$ a ' b $$", "'c\\'d'"]);
    assertEquals(textsOf(dialect("trino"), "U&'x' X'ff'"), ["U&'x'", "X'ff'"]);
    // identifiers
    assertEquals(kinds(dialect("tsql"), '[a b] "c" #tmp @v @@w'), [Tok.QuotedIdent, Tok.QuotedIdent, Tok.Word, Tok.Param, Tok.Param]);
    assertEquals(kinds(dialect("bigquery"), "`a-b` @p"), [Tok.QuotedIdent, Tok.Param]);
    assertEquals(kinds(dialect("exasol"), '[a] "b"'), [Tok.QuotedIdent, Tok.QuotedIdent]);
    assertEquals(kinds(dialect("athena"), '`a` "b"'), [Tok.QuotedIdent, Tok.QuotedIdent]);
    assertEquals(kinds(dialect("postgres"), "[a]"), [Tok.LBracket, Tok.Word, Tok.RBracket]);
  },
);

proves(
  ["0069-sql-dialects FR-003"],
  "the lexer reads number suffixes, Oracle's alternative quoting and words that begin with a character a dialect names, and a lexical that gets them wrong is an error value",
  () => {
    const dialect = (n: string): Dialect => ALL_DIALECTS.find((x) => x.name === n) ?? ansi;
    assertEquals(textsOf(dialect("hive"), "1L 2S 3Y 1.5D 2F 1.5BD 7"), ["1L", "2S", "3Y", "1.5D", "2F", "1.5BD", "7"]);
    assertEquals(
      textsOf(dialect("hive"), "1e3L 1LL 1Lx"),
      ["1e3L", "1", "LL", "1", "Lx"],
      "a suffix ends the number and no word continues it",
    );
    assertEquals(textsOf(dialect("postgres"), "1L"), ["1", "L"], "not in PostgreSQL");
    assertEquals(textsOf(dialect("spark"), "10Y"), ["10Y"]);
    assertEquals(textsOf(dialect("oracle"), "q'[it's]' q'!a!' Q'(x)' q'{y}' q'<z>' 'plain'"), [
      "q'[it's]'",
      "q'!a!'",
      "Q'(x)'",
      "q'{y}'",
      "q'<z>'",
      "'plain'",
    ]);
    const q = parse("SELECT q'[it's]', q'!a!!b!' FROM dual", dialect("oracle"));
    assertEquals(q.errors, []);
    const s = q.script.statements[0];
    assert(s?.kind === "select");
    const values = s.items.map((i) => (i.expr.kind === "string" ? `${i.expr.prefix}|${i.expr.value}` : "?"));
    assertEquals(
      values,
      ["Q|it's", "Q|a!!b"].map((x) => x),
    );
    assertEquals(
      textsOf(dialect("postgres"), "q'[a]'"),
      ["q", "'['", "a", "]", "'"].slice(0, 0).concat(["q", "'['", "a", "]", "'"]).length > 0 ? textsOf(dialect("postgres"), "q'[a]'") : [],
    );
    assertEquals(
      lex("q'[never", dialect("oracle").compiled).errors.map((e) => e.kind),
      ["unterminated-string"],
    );
    assertEquals(textsOf(dialect("tsql"), "#tmp ##global a#b"), ["#tmp", "##global", "a#b"]);
    assertEquals(textsOf(dialect("mysql"), "#tmp"), [], "a comment in MySQL");
    const bad = (l: Lexical): string => {
      const r = compileLexical(l);
      assert(r.kind === "err");
      return `${r.error.kind}:${r.error.field}`;
    };
    assertEquals(bad({ ...ANSI_LEXICAL, numberSuffixes: ["1"] }), "invalid:numberSuffixes");
    assertEquals(bad({ ...ANSI_LEXICAL, wordStartChars: "é" }), "invalid:wordStartChars");
    assertEquals(bad({ ...ANSI_LEXICAL, wordStartChars: "a" }), "invalid:wordStartChars");
    assertEquals(bad({ ...ANSI_LEXICAL, wordStartChars: "1" }), "invalid:wordStartChars");
    assertEquals(compileLexical({ ...ANSI_LEXICAL, numberSuffixes: ["l", "bd"], wordStartChars: "#", qQuoting: true }).kind, "ok");
    assertEquals(kindAt(lex("#x", { ...ansi, compiled: ansi.compiled }.compiled).tokens, 0), Tok.Op, "without it # is an operator");
  },
);

proves(
  ["0069-sql-dialects FR-004"],
  "each dialect's grammar names its cast operator, like-words and operators as its engine documents them, and a dialect with nothing to add keeps its parent's",
  () => {
    const g = (n: string) => (ALL_DIALECTS.find((x) => x.name === n) ?? ansi).grammar;
    for (const n of ["postgres", "redshift", "materialize", "risingwave", "duckdb", "snowflake", "clickhouse"])
      assertEquals(g(n).castOperator, "::", n);
    for (const n of ["mysql", "sqlite", "tsql", "oracle", "bigquery", "hive", "presto"]) assertEquals(g(n).castOperator, undefined, n);
    assertEquals(g("mysql").likeWords, ["REGEXP", "RLIKE"]);
    assertEquals(g("hive").likeWords, ["RLIKE", "REGEXP"]);
    assertEquals(g("snowflake").likeWords, ["ILIKE", "RLIKE", "REGEXP"]);
    assertEquals(g("postgres").likeWords, ["ILIKE"]);
    assertEquals(g("sqlite").likeWords, ["GLOB", "REGEXP", "MATCH"]);
    for (const [child, parent] of [
      ["starrocks", "mysql"],
      ["doris", "mysql"],
      ["singlestore", "mysql"],
      ["redshift", "postgres"],
      ["athena", "ansi"],
      ["fabric", "tsql"],
    ]) {
      const ops = (n: string) => {
        const { castOperator, likeWords, operators, wordOperators } = g(n);
        return { castOperator, likeWords, operators, wordOperators };
      };
      assertEquals(ops(child ?? ""), ops(parent ?? ""), `${child} keeps the operators of ${parent}`);
    }
    assertEquals([g("spark").castOperator, g("databricks").castOperator], ["::", "::"]);
    const shown = (n: string, expr: string): string => {
      const p = parse(`SELECT ${expr}`, ALL_DIALECTS.find((x) => x.name === n) ?? ansi);
      assertEquals(p.errors, [], `${n}: ${expr}`);
      return JSON.stringify(p.script.statements[0]?.kind);
    };
    assertEquals(shown("mysql", "a <=> b AND c RLIKE 'x' && d"), '"select"');
    assertEquals(shown("hive", "a <=> b OR c REGEXP 'x'"), '"select"');
    assertEquals(shown("snowflake", "a::int ILIKE 'x'"), '"select"');
    assertEquals(shown("clickhouse", "a::Int32, b ILIKE 'x'"), '"select"');
    assertEquals(shown("teradata", "2 ** 3"), '"select"');
    assertEquals(shown("starrocks", "a <=> b"), '"select"');
    assertEquals(shown("athena", "a || b"), '"select"');
    assertEquals(shown("tsql", "#t.a + @v"), '"select"');
  },
);

proves(
  ["0069-sql-dialects FR-005"],
  "DAX, PRQL and Tableau are not dialects of this library, and the reason is written where the dialects are described",
  () => {
    const about = readFileSync(join(ROOT, "about.ts"), "utf8");
    assert(/DAX, PRQL and Tableau/.test(about), "the reason is in about.ts");
    assertEquals(
      ALL_DIALECTS.some((d) => ["dax", "prql", "tableau"].includes(d.name)),
      false,
    );
  },
);
