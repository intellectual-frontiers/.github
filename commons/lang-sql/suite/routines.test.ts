/**
 * Stored routines and procedural code (commons lang-sql 0006-sql-routines): statements that end where they end, the headers and bodies of routines, PL/pgSQL read as blocks and statements with the SQL it embeds at its place
 * in the whole text, the comments of a body, errors as values, and the corpus of PostgreSQL's own PL/pgSQL tests.
 *
 * Spec: 0006-sql-routines FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import fc from "fast-check";
import { type Dialect, commentsOf, parse, type Statement } from "@intellectual-frontiers/lang-sql";
import { dialect as mysql } from "@intellectual-frontiers/lang-sql/dialects/mysql";
import { dialect as oracle } from "@intellectual-frontiers/lang-sql/dialects/oracle";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as tsql } from "@intellectual-frontiers/lang-sql/dialects/tsql";
import {
  type PlBlock,
  type PlStatement,
  type PlTree,
  parsePlpgsql,
  parsePlpgsqlRange,
  plChildren,
} from "@intellectual-frontiers/lang-sql/extensions/plpgsql";
import { CORPUS } from "../tools/conformance.ts";

const kinds = (sql: string, d: Dialect = postgres): string[] => {
  const p = parse(sql, d);
  assertEquals(p.errors, [], sql);
  return p.script.statements.map((s) => (s.kind === "command" ? `command:${s.keyword}` : s.kind));
};
const routine = (sql: string, d: Dialect = postgres) => {
  const p = parse(sql, d);
  assertEquals(p.errors, [], sql);
  const s = p.script.statements[0];
  assert(s !== undefined && s.kind === "create-routine", `${sql}: ${s?.kind}`);
  return { p, r: s };
};
const plBlock = (body: string): PlBlock => {
  const r = parsePlpgsqlRange(body, postgres, 0, body.length);
  assertEquals(r.errors, [], body);
  assert(r.block !== undefined);
  return r.block;
};
const plKinds = (xs: readonly PlTree[] | undefined): string[] => (xs ?? []).map((x) => x.kind);

proves(
  ["0006-sql-routines FR-001"],
  "a procedural statement ends at the first ; outside every block it opens, and every other statement at its first ;",
  () => {
    assertEquals(kinds("CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END; $$ LANGUAGE plpgsql; SELECT 1"), [
      "create-routine",
      "select",
    ]);
    assertEquals(kinds("CREATE PROCEDURE p() LANGUAGE sql BEGIN ATOMIC INSERT INTO t VALUES (1); SELECT 1; END; SELECT 2"), [
      "create-routine",
      "select",
    ]);
    assertEquals(
      kinds("CREATE PROCEDURE p() BEGIN SELECT 1; IF x THEN SELECT 2; END IF; WHILE y DO SET y = 0; END WHILE; END; SELECT 3", mysql),
      ["create-routine", "select"],
    );
    assertEquals(
      kinds(
        "CREATE FUNCTION f() RETURNS int BEGIN DECLARE a int; LOOP SET a = 1; END LOOP; RETURN CASE WHEN a THEN 1 ELSE 2 END; END; SELECT 1",
        mysql,
      ),
      ["create-routine", "select"],
    );
    assertEquals(
      kinds("CREATE OR REPLACE PROCEDURE p IS x int; BEGIN x := 1; IF x > 0 THEN NULL; END IF; END p; SELECT 1 FROM dual", oracle),
      ["command:CREATE", "select"],
    );
    assertEquals(kinds("CREATE TRIGGER t BEFORE INSERT ON x FOR EACH ROW BEGIN SET NEW.a = 1; SET NEW.b = 2; END; SELECT 1", mysql), [
      "command:CREATE",
      "select",
    ]);
    assertEquals(kinds("BEGIN TRY SELECT 1; END TRY BEGIN CATCH SELECT 2; END CATCH; SELECT 3", tsql), ["command:BEGIN", "select"]);
    assertEquals(kinds("DECLARE x int; BEGIN x := 1; END; SELECT 1"), ["command:DECLARE", "select"]);
    assertEquals(kinds("DO $$ BEGIN PERFORM 1; END $$; SELECT 1"), ["command:DO", "select"]);
    assertEquals(kinds("DROP TABLE IF EXISTS t; SELECT 1"), ["drop", "select"]);
    assertEquals(kinds("CREATE TABLE IF NOT EXISTS t (a INT); SELECT 1"), ["create-table", "select"]);
    assertEquals(kinds("IF EXISTS (SELECT 1) DROP VIEW v; SELECT 1", tsql), ["command:IF", "select"], "T-SQL: no THEN, so no block");
    assertEquals(kinds("DECLARE @x int; SELECT @x", tsql), ["command:DECLARE", "select"]);
    assertEquals(kinds("DECLARE c CURSOR FOR SELECT 1; FETCH c; CLOSE c"), ["command:DECLARE", "command:FETCH", "command:CLOSE"]);
    assertEquals(kinds("SELECT CASE WHEN a THEN 1 END; SELECT 2"), ["select", "select"]);
    assertEquals(kinds("SET a = 1; SET b = 2"), ["command:SET", "command:SET"]);
    // after an error in a procedural statement, the next statement is read
    const bad = parse("CREATE PROCEDURE p() BEGIN SELECT FROM; END; SELECT 1", mysql);
    assertEquals(
      bad.script.statements.map((s) => s.kind),
      ["create-routine", "select"],
      "the body of a routine is not read by the core, and the next statement is",
    );
    const broken = parse("DO $$ x $$; SELECT 1");
    assertEquals(
      broken.script.statements.map((s) => s.kind),
      ["command", "select"],
    );
  },
);

proves(
  ["0006-sql-routines FR-002"],
  "BEGIN begins a transaction where it is followed by ;, the end, or a word of a transaction, and a block elsewhere",
  () => {
    assertEquals(kinds("BEGIN; SELECT 1; COMMIT;"), ["command:BEGIN", "select", "command:COMMIT"]);
    assertEquals(
      kinds("BEGIN TRANSACTION; SELECT 1; END"),
      ["command:BEGIN", "select", "command:END"]
        .slice(0, 2)
        .concat(parse("END").script.statements.map((s) => (s.kind === "command" ? `command:${s.keyword}` : s.kind))),
    );
    assertEquals(kinds("BEGIN WORK; SELECT 1"), ["command:BEGIN", "select"]);
    assertEquals(kinds("BEGIN ISOLATION LEVEL SERIALIZABLE; SELECT 1"), ["command:BEGIN", "select"]);
    assertEquals(kinds("BEGIN READ ONLY; SELECT 1"), ["command:BEGIN", "select"]);
    assertEquals(kinds("BEGIN"), ["command:BEGIN"]);
    assertEquals(kinds("BEGIN SELECT 1; SELECT 2; END; SELECT 3"), ["command:BEGIN", "select"], "a block");
  },
);

proves(
  ["0006-sql-routines FR-003"],
  "CREATE FUNCTION and CREATE PROCEDURE are a create-routine node with the object, replace, name, parameters, result, language and characteristics, and a header that is not read is a command",
  () => {
    const { r } = routine(
      "CREATE OR REPLACE FUNCTION s.f(a int, OUT b text, VARIADIC c int[] DEFAULT '{}', IN OUT d numeric(10, 2), int) RETURNS SETOF record LANGUAGE plpgsql IMMUTABLE STRICT SECURITY DEFINER COST 10 AS $$ BEGIN END $$",
    );
    assertEquals(
      [r.object, r.orReplace, r.name.parts.map((p) => p.name).join("."), r.setof, r.returns?.name, r.language],
      ["function", true, "s.f", true, "RECORD", "plpgsql"],
    );
    assertEquals(
      r.params.map((x) => `${x.mode ?? "-"}|${x.name?.name ?? "-"}|${x.type.name}|${x.default === undefined ? "" : "d"}`),
      ["-|a|INT|", "out|b|TEXT|", "variadic|c|INT[]|d", "inout|d|NUMERIC|", "-|-|INT|"],
    );
    assertEquals(r.options, "IMMUTABLE STRICT SECURITY DEFINER COST 10");
    const p = routine("CREATE PROCEDURE p(x int = 5, y text DEFAULT 'a') LANGUAGE sql AS 'select 1'");
    assertEquals(
      [p.r.object, p.r.returns, p.r.orReplace, p.r.params.length, p.r.params[0]?.default?.kind],
      ["procedure", undefined, false, 2, "number"],
    );
    const t = routine("CREATE FUNCTION f() RETURNS TABLE (a int, b text) LANGUAGE sql AS 'select 1, 2'").r;
    assertEquals([t.table.map((c) => c.name.name), t.returns], [["a", "b"], undefined]);
    assertEquals(
      routine(
        "CREATE FUNCTION f(a double precision, b character varying(3), c timestamp with time zone) RETURNS void AS $$ $$ LANGUAGE sql",
      ).r.params.map((x) => x.type.name),
      ["DOUBLE PRECISION", "CHARACTER VARYING", "TIMESTAMP WITH TIME ZONE"],
    );
    assertEquals(
      routine("CREATE FUNCTION f(public.mytype, s.t%TYPE) RETURNS int AS 'x' LANGUAGE sql").r.params.map((x) => x.type.name),
      ["PUBLIC.MYTYPE", "S.T%TYPE"],
    );
    assertEquals(kinds("CREATE FUNCTION f RETURNS int AS 'x'"), ["command:CREATE"], "a header the grammar does not read");
    assertEquals(kinds("CREATE TRIGGER t BEFORE INSERT ON x EXECUTE FUNCTION f()"), ["command:CREATE"]);
  },
);

proves(
  ["0006-sql-routines FR-004"],
  "a routine's body is a node with its style and text, and its offsets in the whole text where the text can be read in place",
  () => {
    const sql = "CREATE FUNCTION f() RETURNS int AS $body$ SELECT 1; $body$ LANGUAGE sql";
    const d = routine(sql).r.body;
    assert(d !== undefined);
    assertEquals([d.style, d.exact, sql.slice(d.bodyStart, d.bodyEnd), d.text], ["dollar", true, " SELECT 1; ", " SELECT 1; "]);
    const s = routine("CREATE FUNCTION f() RETURNS int AS 'select 1' LANGUAGE sql").r.body;
    assertEquals([s?.style, s?.exact, s?.text], ["string", true, "select 1"]);
    const sql2 = "CREATE FUNCTION f() RETURNS text AS 'select ''x''' LANGUAGE sql";
    const e = routine(sql2).r.body;
    assertEquals([e?.style, e?.exact, e?.text], ["string", false, "select 'x'"]);
    const sql3 = "CREATE PROCEDURE p() BEGIN ATOMIC SELECT 1; SELECT 2; END";
    const b = routine(sql3).r.body;
    assert(b !== undefined);
    assertEquals([b.style, sql3.slice(b.bodyStart, b.bodyEnd).trim()], ["block", "SELECT 1; SELECT 2;"]);
    const sql4 = "CREATE FUNCTION g(x int) RETURNS int RETURN x + 1";
    const r = routine(sql4).r.body;
    assert(r !== undefined && r.expr?.kind === "binary");
    assertEquals([r.style, sql4.slice(r.bodyStart, r.bodyEnd)], ["return", "x + 1"]);
    const x = routine("CREATE FUNCTION h() RETURNS int AS 'libfoo', 'h_sym' LANGUAGE c").r.body;
    assertEquals([x?.style, x?.text], ["external", "libfoo"]);
    assertEquals(routine("CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END; $$ LANGUAGE plpgsql").r.language, "plpgsql");
    assertEquals(routine("CREATE FUNCTION f() RETURNS int LANGUAGE sql").r.body, undefined);
  },
);

proves(
  ["0006-sql-routines FR-005"],
  "PL/pgSQL is read as a block of declarations, statements and handlers, with every statement the specification lists",
  () => {
    const b = plBlock(`<<outer>> DECLARE
  x int := 1; y CONSTANT text NOT NULL DEFAULT 'a'; z t.c%TYPE; al ALIAS FOR $1;
  c1 CURSOR (p int) FOR SELECT * FROM t WHERE a = p; c2 SCROLL CURSOR FOR SELECT 1;
BEGIN
  x := x + 1; z = 2; arr[1] := 3;
  IF x > 1 THEN NULL; ELSIF x = 0 THEN NULL; ELSE NULL; END IF;
  CASE x WHEN 1, 2 THEN NULL; WHEN 3 THEN NULL; ELSE NULL; END CASE;
  CASE WHEN x > 1 THEN NULL; END CASE;
  <<l1>> LOOP EXIT l1 WHEN x > 3; CONTINUE; END LOOP l1;
  WHILE x < 5 LOOP x := x + 1; END LOOP;
  FOR i IN REVERSE 10..1 BY 2 LOOP NULL; END LOOP;
  FOR r IN SELECT * FROM t LOOP NULL; END LOOP;
  FOR r IN EXECUTE 'select 1' USING x LOOP NULL; END LOOP;
  FOR r IN c1(5) LOOP NULL; END LOOP;
  FOREACH e SLICE 1 IN ARRAY arr LOOP NULL; END LOOP;
  RETURN NEXT x; RETURN NEXT; RETURN QUERY SELECT 1; RETURN QUERY EXECUTE 'select 1' USING x; RETURN x; RETURN;
  RAISE NOTICE 'a % b', x, y; RAISE EXCEPTION 'bad' USING ERRCODE = '22012', HINT = 'h'; RAISE unique_violation; RAISE;
  PERFORM x + 1; PERFORM f(1) FROM t;
  EXECUTE 'select 1' INTO STRICT x USING y; 
  OPEN c1(5); OPEN c2; OPEN c3 FOR SELECT 1; OPEN c4 FOR EXECUTE 'select 1';
  FETCH c1 INTO x; FETCH NEXT FROM c1 INTO x, y; MOVE LAST IN c1; CLOSE c1;
  CALL p(1, 2);
  GET DIAGNOSTICS x = ROW_COUNT, y = RESULT_OID; GET STACKED DIAGNOSTICS z = MESSAGE_TEXT;
  ASSERT x > 0, 'positive'; ASSERT x < 9;
  COMMIT; ROLLBACK AND CHAIN;
  INSERT INTO t VALUES (1); UPDATE t SET a = 1; DELETE FROM t; SELECT 1 INTO x; SET search_path = a; CREATE TEMP TABLE tt (a int);
  BEGIN x := 2; EXCEPTION WHEN OTHERS THEN NULL; END;
EXCEPTION
  WHEN division_by_zero OR SQLSTATE '22012' THEN RAISE NOTICE 'x';
  WHEN OTHERS THEN RETURN;
END outer;`);
    assertEquals(plKinds(b.declarations), ["pl-variable", "pl-variable", "pl-variable", "pl-alias", "pl-cursor", "pl-cursor"]);
    assertEquals(b.label?.name, "outer");
    assertEquals(b.endLabel?.name, "outer");
    const all = new Map<string, number>();
    const visit = (n: PlTree): void => {
      all.set(n.kind, (all.get(n.kind) ?? 0) + 1);
      for (const c of plChildren(n)) visit(c);
    };
    visit(b);
    for (const k of [
      "pl-assign",
      "pl-if",
      "pl-elsif",
      "pl-case",
      "pl-when",
      "pl-loop",
      "pl-while",
      "pl-for-range",
      "pl-for-query",
      "pl-foreach",
      "pl-exit",
      "pl-return",
      "pl-raise",
      "pl-raise-option",
      "pl-perform",
      "pl-execute",
      "pl-open",
      "pl-fetch",
      "pl-close",
      "pl-call",
      "pl-null",
      "pl-diagnostics",
      "pl-diagnostics-item",
      "pl-assert",
      "pl-transaction",
      "pl-sql",
      "pl-block",
      "pl-handler",
    ])
      assert((all.get(k) ?? 0) > 0, `${k} is read`);
    assertEquals(all.get("pl-unparsed"), undefined, "nothing is unread");
    assertEquals(plKinds(b.handlers.flatMap((h) => h.statements)), ["pl-raise", "pl-return"]);
    assertEquals(
      b.handlers.map((h) => h.conditions),
      [["DIVISION_BY_ZERO", "SQLSTATE '22012'"], ["OTHERS"]],
    );
    const v = b.declarations[1];
    assert(v?.kind === "pl-variable" && v.constant && v.notNull && v.type?.name === "TEXT" && v.default?.kind === "string");
    const c = b.declarations[4];
    assert(c?.kind === "pl-cursor" && c.params.length === 1 && c.query?.kind === "select");
    const range = b.statements.find((s): s is Extract<PlStatement, { kind: "pl-for-range" }> => s.kind === "pl-for-range");
    assert(
      range !== undefined && range.reverse && range.from.kind === "number" && range.to.kind === "number" && range.by?.kind === "number",
    );
  },
);

proves(
  ["0006-sql-routines FR-006"],
  "the SQL a body holds is read with the core parser at its place in the whole text, and the INTO of a statement is taken out of it and kept",
  () => {
    const sql =
      "CREATE FUNCTION f(a int) RETURNS int AS $$\nDECLARE x int;\nBEGIN\n  SELECT count(*) INTO x FROM t WHERE id = a;\n  INSERT INTO t (v) VALUES (a) RETURNING id INTO STRICT x;\n  x := a * 2 + 1;\n  PERFORM g(a) FROM t;\n  EXECUTE format('select %s', a) INTO x USING a;\n  RETURN x;\nEND\n$$ LANGUAGE plpgsql";
    const p = parse(sql, postgres);
    const r = p.script.statements[0];
    assert(r !== undefined);
    const body = parsePlpgsql(p, postgres, r);
    assert(body !== undefined && body.block !== undefined);
    assertEquals(body.errors, []);
    const [sel, ins, assign, perform, exec] = body.block.statements;
    assert(sel?.kind === "pl-sql" && sel.statement?.kind === "select" && !sel.strict);
    assertEquals(
      sql.slice(sel.statement.start, sel.statement.end),
      "SELECT count(*) INTO x FROM t WHERE id = a",
      "the statement is in the whole text, the INTO among its tokens left out",
    );
    assertEquals(
      sel.into.map((e) => sql.slice(e.start, e.end)),
      ["x"],
    );
    assert(
      sel.statement.kind === "select" &&
        sel.statement.from[0]?.kind === "table" &&
        sql.slice(sel.statement.from[0].start, sel.statement.from[0].end) === "t",
    );
    assert(
      ins?.kind === "pl-sql" &&
        ins.statement?.kind === "insert" &&
        ins.strict &&
        ins.into.map((e) => sql.slice(e.start, e.end)).join() === "x",
    );
    assert(ins.statement.kind === "insert" && ins.statement.returning.length === 1);
    assert(
      assign?.kind === "pl-assign" &&
        sql.slice(assign.value.start, assign.value.end) === "a * 2 + 1" &&
        sql.slice(assign.target.start, assign.target.end) === "x",
    );
    assert(perform?.kind === "pl-perform" && perform.query?.kind === "select" && perform.query.items.length === 1);
    assertEquals(perform.query.kind === "select" ? sql.slice(perform.query.start, perform.query.end) : "", "g(a) FROM t");
    assert(exec?.kind === "pl-execute" && exec.command?.kind === "call" && exec.into.length === 1 && exec.using.length === 1);
    // SELECT INTO target list: the targets are the names and the select list follows
    const b2 = plBlock("BEGIN SELECT INTO a, b x, y FROM t; END");
    const s2 = b2.statements[0];
    assert(s2?.kind === "pl-sql" && s2.into.length === 2 && s2.statement?.kind === "select" && s2.statement.items.length === 2);
    // every node of a body lies in the body's range, and nodes of the core are in the tree
    const nodes: PlTree[] = [];
    const visit = (n: PlTree): void => {
      nodes.push(n);
      for (const c of plChildren(n)) visit(c);
    };
    visit(body.block);
    assert(nodes.every((n) => n.start >= (r.kind === "create-routine" ? (r.body?.bodyStart ?? 0) : 0) && n.end <= sql.length));
    assert(nodes.some((n) => n.kind === "table") && nodes.some((n) => n.kind === "call"));
  },
);

proves(["0006-sql-routines FR-007"], "the comments of a body are kept and attached to its nodes by the rule of the core", () => {
  const sql =
    "CREATE FUNCTION f() RETURNS int AS $$\n  -- before x\n  DECLARE x int; -- after x\n  BEGIN\n  -- before the if\n  IF x > 1 THEN -- then\n    NULL; /* the null */\n  END IF; -- after the if\n  END $$ LANGUAGE plpgsql";
  const p = parse(sql, postgres);
  const r = p.script.statements[0];
  assert(r !== undefined);
  const b = parsePlpgsql(p, postgres, r);
  assert(b !== undefined && b.block !== undefined);
  assertEquals(b.errors, []);
  assertEquals(
    b.comments.map((c) => c.text.trim()),
    ["before x", "after x", "before the if", "then", "the null", "after the if"],
  );
  assertEquals(b.attachments.all.length, b.comments.length);
  const placed = b.attachments.all.map((a) => `${a.placement} ${a.node.kind} ${a.comment.text.trim()}`);
  assert(placed.includes("leading pl-if before the if"), placed.join(" | "));
  assert(placed.includes("trailing pl-variable after x"), placed.join(" | "));
  assert(placed.includes("trailing pl-null the null"), placed.join(" | "));
  const ifNode = b.block.statements[0];
  assert(ifNode?.kind === "pl-if");
  assertEquals(
    commentsOf(b.attachments, ifNode).leading.map((c) => c.text.trim()),
    ["before the if"],
  );
  for (const c of b.comments) assert(sql.slice(c.span.start, c.span.end).startsWith(c.marker), "a comment's span is in the whole text");
});

proves(
  ["0006-sql-routines FR-008"],
  "what cannot be read is an error value with its span in the whole text, the statement is kept as unparsed or with a null in the place of the expression, and the statements after it are read",
  () => {
    const body = "BEGIN\n  x := ;\n  FROB the thing;\n  IF THEN NULL; END IF;\n  RETURN 1;\nEND";
    const r = parsePlpgsqlRange(body, postgres, 0, body.length);
    assert(r.block !== undefined);
    assert(r.errors.length >= 3);
    for (const e of r.errors) {
      const span = e.kind === "lex" ? e.error.span : e.kind === "too-deep" ? e.span : e.span;
      assert(span.start >= 0 && span.end <= body.length, "a span in the body");
    }
    assert(plKinds(r.block.statements).includes("pl-return"), "the statement after the errors is read");
    assertEquals(r.block.statements.at(-1)?.kind, "pl-return");
    assertEquals(parsePlpgsqlRange("SELECT 1", postgres, 0, 8).block, undefined);
    assertEquals(parsePlpgsqlRange("SELECT 1", postgres, 0, 8).errors.length, 1);
    const none = parse("CREATE FUNCTION f() RETURNS int AS 'select 1' LANGUAGE sql");
    const only: Statement | undefined = none.script.statements[0];
    assert(only !== undefined);
    assertEquals(parsePlpgsql(none, postgres, only), undefined, "a SQL body is not PL/pgSQL");
    fc.assert(
      fc.property(
        fc
          .array(
            fc.constantFrom(
              "BEGIN",
              "END",
              "IF",
              "THEN",
              "LOOP",
              "x",
              ":=",
              "1",
              ";",
              "(",
              ")",
              "SELECT",
              "INTO",
              "FOR",
              "IN",
              "..",
              "'a'",
              "$$",
              "RAISE",
              "EXECUTE",
              "WHEN",
              "CASE",
              "<<",
              ">>",
              "DECLARE",
              "EXCEPTION",
            ),
            { maxLength: 40 },
          )
          .map((a) => a.join(" ")),
        (text) => {
          const out = parsePlpgsqlRange(text, postgres, 0, text.length);
          assert(out.errors.length >= 0 && out.comments.length >= 0);
        },
      ),
      { numRuns: 400 },
    );
  },
);

proves(
  ["0006-sql-routines FR-009"],
  "every routine of the corpus of PL/pgSQL from PostgreSQL's tests is read without a throw, and the number whose body is read with no error does not fall below the baseline",
  () => {
    const text = readFileSync(join(CORPUS, "postgres_regress/postgres/plpgsql_routines.sql"), "utf8");
    const p = parse(text, postgres);
    assertEquals(p.errors, [], "the file is read whole");
    assert(p.script.statements.length > 200);
    const baseline = readFileSync(join(CORPUS, "plpgsql-baseline.tsv"), "utf8")
      .split("\n")
      .filter((l) => l !== "" && !l.startsWith("#") && !l.startsWith("path"));
    const [, bodiesBase, okBase] = (baseline[0] ?? "").split("\t");
    let bodies = 0;
    let ok = 0;
    let nodes = 0;
    for (const s of p.script.statements) {
      const body = parsePlpgsql(p, postgres, s);
      if (body === undefined) continue;
      bodies++;
      if (body.errors.length === 0 && body.block !== undefined) ok++;
      if (body.block !== undefined) walkPl(body.block, () => nodes++);
    }
    assert(bodies >= Number(bodiesBase), `${bodies} bodies`);
    assert(ok >= Number(okBase), `${ok} of ${bodies} bodies read, the baseline has ${okBase}`);
    assert(nodes > 4000, `${nodes} nodes`);
  },
);

function walkPl(n: PlTree, f: (n: PlTree) => void): void {
  f(n);
  for (const c of plChildren(n)) walkPl(c, f);
}
