// Spec: 0050-sql-plpgsql FR-001, FR-002, FR-003
/**
 * Typed PL/pgSQL (commons data 0050-sql-plpgsql), on PostgreSQL: a block of variables and statements is the body of a routine, made with the names the case style writes, and runs: loops, conditions,
 * a handler for a named condition, an error raised with a state, a set of rows returned. What is wrong with a block is an error as a value before anything is made.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/test";
import {
  attempt,
  block,
  columnOf,
  done,
  expr,
  forEach,
  found,
  loop,
  notice,
  paramOf,
  raise,
  raiseCode,
  ret,
  retQuery,
  type RoutineDefinition,
  routinesSource,
  run,
  set,
  tableOf,
  val,
  variable,
  when,
} from "@intellectual-frontiers/data/sql/extensions/routines";
import { bind, type Dialect } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, refuses, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { libraryAt } from "./lifecycle-fixture.ts";

const postgres: Dialect = DIALECTS[2].dialect;
const must = <T>(r: { kind: "ok"; value: T } | { kind: "err"; error: unknown }): T => {
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const int = { kind: "integer" } as const;
const text = { kind: "text" } as const;
const kinds = (r: { kind: "ok" | "err"; error?: readonly { kind: string }[] }): string[] => (r.kind === "err" ? (r.error ?? []).map((e) => e.kind) : []);

const countBooks: RoutineDefinition = (() => {
  const n = variable("n", int, val(0));
  return {
    kind: "function",
    name: "countBooks",
    description: "How many books an author has",
    params: [{ name: "who", type: text }],
    returns: { type: int },
    language: "plpgsql",
    body: must(block({ declare: [n], returns: "value", body: [forEach("b", expr`SELECT * FROM ${tableOf("book")} WHERE ${columnOf("book", "authorId")} = ${paramOf("who")}`, () => [set(n, expr`${n} + 1`)]), ret(n)] })) as RoutineDefinition["body"],
  };
})();
const describeAuthor: RoutineDefinition = (() => {
  const n = variable("n", int, expr`0`);
  const i = variable("i", int, val(0));
  const s = variable("s", text, val(""));
  return {
    kind: "function",
    name: "describeAuthor",
    description: "Says how many books, and counts them out",
    params: [{ name: "who", type: text }],
    returns: { type: text },
    language: "plpgsql",
    body: must(
      block({
        declare: [n, i, s],
        returns: "value",
        body: [
          run(expr`SELECT count(*)::int FROM ${tableOf("book")} WHERE ${columnOf("book", "authorId")} = ${paramOf("who")} INTO ${n}`),
          when(expr<boolean>`${n} = 0`, [ret(val("none"))]),
          loop(expr<boolean>`${i} < ${n}`, [set(i, expr`${i} + 1`), set(s, expr`${s} || ${i}::text`)]),
          ret(s),
        ],
      }),
    ) as RoutineDefinition["body"],
  };
})();
const addAuthor: RoutineDefinition = (() => {
  return {
    kind: "procedure",
    name: "saveAuthor",
    description: "Makes an author, or renames the one that is there",
    params: [{ name: "who", type: text }, { name: "called", type: text }],
    language: "plpgsql",
    body: must(
      block({
        returns: "none",
        body: [
          attempt([run(expr`INSERT INTO ${tableOf("author")} (id, name) VALUES (${paramOf("who")}, ${paramOf("called")})`), notice("made %", paramOf("who"))], {
            when: "unique_violation",
            then: [run(expr`UPDATE ${tableOf("author")} SET name = ${paramOf("called")} WHERE ${columnOf("author", "id")} = ${paramOf("who")}`)],
          }),
          done(),
        ],
      }),
    ) as RoutineDefinition["body"],
  };
})();
const mustHave: RoutineDefinition = {
  kind: "function",
  name: "mustHave",
  description: "The name of an author, or an error",
  params: [{ name: "who", type: text }],
  returns: { type: text },
  language: "plpgsql",
  body: must(
    block({
      declare: [variable("found_name", text)],
      returns: "value",
      body: [
        run(expr`SELECT name FROM ${tableOf("author")} WHERE ${columnOf("author", "id")} = ${paramOf("who")} INTO ${variable("found_name", text)}`),
        when(expr<boolean>`NOT ${found}`, [raiseCode("P0002", "no author %", paramOf("who"))]),
        ret(variable("found_name", text)),
      ],
    }),
  ) as RoutineDefinition["body"],
};
const titles: RoutineDefinition = {
  kind: "function",
  name: "titlesOf",
  description: "The titles of an author's books",
  params: [{ name: "who", type: text }],
  returns: { columns: [{ name: "title", type: text }] },
  language: "plpgsql",
  body: must(block({ returns: "value", body: [retQuery(expr`SELECT ${columnOf("book", "title")} FROM ${tableOf("book")} WHERE ${columnOf("book", "authorId")} = ${paramOf("who")} ORDER BY 1`)] })) as RoutineDefinition["body"],
};
const defs = [countBooks, describeAuthor, addAuthor, mustHave, titles];

proves(
  ["0050-sql-plpgsql FR-001", "0050-sql-plpgsql FR-002"],
  "a block of typed statements is the body of a routine that is made with the names the case style writes and runs on PostgreSQL: loops, conditions, a handler for a named condition, an error with a state, and rows returned",
  async () => {
    const e: Engine = await openEngine("postgres");
    try {
      const b = must(bind(libraryAt(1), { dialect: postgres, sources: [routinesSource(defs)] }));
      await load(e, b);
      const fn = b.statements.filter((s) => s.group === "routine").map((s) => s.sql).join("\n");
      const low = fn.toLowerCase();
      assert(low.includes('"count_books"("who" text)') && low.includes('"n" integer := 0;') && fn.includes('FOR "b" IN SELECT') && fn.includes('"b" RECORD;') && fn.includes('"count_books"."who"'), fn);
      await e.run(`INSERT INTO "genre" ("code", "label") VALUES ('fiction', 'Fiction') ON CONFLICT DO NOTHING`);
      await e.run(`CALL "save_author"('a1', 'Ann')`);
      same((await e.rows(`SELECT "name" FROM "author" WHERE "id" = 'a1'`)).map((r) => r["name"]), ["Ann"], "made");
      await e.run(`CALL "save_author"('a1', 'Annie')`);
      same((await e.rows(`SELECT "name" FROM "author" WHERE "id" = 'a1'`)).map((r) => r["name"]), ["Annie"], "the handler for unique_violation renamed it");
      for (const [id, title] of [["b1", "Zebra"], ["b2", "Apple"], ["b3", "Mango"]]) await e.run(`INSERT INTO "book" ("id", "title", "genre_code", "author_id") VALUES ('${id}', '${title}', 'fiction', 'a1')`);
      same((await e.rows(`SELECT "count_books"('a1') AS n`)).map((r) => Number(r["n"])), [3], "for each row, with a variable");
      same((await e.rows(`SELECT "count_books"('nobody') AS n`)).map((r) => Number(r["n"])), [0]);
      same((await e.rows(`SELECT "describe_author"('a1') AS s, "describe_author"('nobody') AS t`)).map((r) => [r["s"], r["t"]]), [["123", "none"]], "run, condition, while loop");
      same((await e.rows(`SELECT "must_have"('a1') AS s`)).map((r) => r["s"]), ["Annie"]);
      assert(await refuses(e, `SELECT "must_have"('nobody')`), "raised");
      const state = await e.rows(`DO $$ BEGIN PERFORM "must_have"('nobody'); EXCEPTION WHEN SQLSTATE 'P0002' THEN RAISE NOTICE 'caught'; END $$`).then(() => "caught", () => "not caught");
      same(state, "caught", "with the state it was raised with");
      same((await e.rows(`SELECT "title" FROM "titles_of"('a1')`)).map((r) => r["title"]), ["Apple", "Mango", "Zebra"], "a set of rows");
      same((await e.rows(`SELECT obj_description('"count_books"(text)'::regprocedure) AS d`))[0]?.["d"], "How many books an author has");
    } finally {
      await e.close();
    }
  },
);

proves(
  ["0050-sql-plpgsql FR-003"],
  "what is wrong with a block is an error as a value before anything is made: a variable that was not declared or is declared twice, a function that can end without returning, a value returned from a procedure and none from a function, a state that is not one, and a table or column the schema lacks",
  () => {
    const n = variable("n", int);
    const m = variable("m", int);
    same(kinds(block({ returns: "value", body: [ret(n)] })), ["undeclared"]);
    same(kinds(block({ declare: [n, n], returns: "none", body: [done()] })), ["declared-twice"]);
    same(kinds(block({ declare: [n], returns: "none", body: [set(m, val(1))] })), ["undeclared"]);
    same(kinds(block({ declare: [n], returns: "value", body: [set(n, val(1))] })), ["no-end"]);
    same(kinds(block({ declare: [n], returns: "value", body: [when(expr<boolean>`true`, [ret(n)])] })), ["no-end"], "an if with no else can end");
    assert(block({ declare: [n], returns: "value", body: [when(expr<boolean>`true`, [ret(n)], [ret(val(1))])] }).kind === "ok", "returning on every path");
    assert(block({ returns: "value", body: [raise("always")] }).kind === "ok", "or raising");
    assert(block({ declare: [n], returns: "value", body: [attempt([ret(n)], { when: "others", then: [ret(val(0))] })] }).kind === "ok", "a handler that returns too");
    same(kinds(block({ declare: [n], returns: "none", body: [ret(n)] })), ["return-value"]);
    same(kinds(block({ returns: "value", body: [done()] })), ["return-value"]);
    same(kinds(block({ returns: "none", body: [raiseCode("nope", "x")] })), ["state"]);
    same(kinds(block({ declare: [variable("k", int, expr`${m} + 1`)], returns: "none", body: [done()] })), ["undeclared"], "an initial value can only use what is declared");
    // names the schema lacks are the routines extension's, and are found there
    const bad: RoutineDefinition = { kind: "function", name: "bad", description: "x", returns: { type: int }, language: "plpgsql", body: must(block({ returns: "value", body: [ret(expr`(SELECT count(*) FROM ${tableOf("nope")} WHERE ${columnOf("book", "nope")} IS NULL)`)] })) as RoutineDefinition["body"] };
    const r = bind(libraryAt(1), { dialect: postgres, sources: [routinesSource([bad])] });
    assert(r.kind === "err" && JSON.stringify(r.error).includes("no table nope") && JSON.stringify(r.error).includes("no column book.nope"), JSON.stringify(r));
    // a variable and a type are written by the case style and the dialect
    const v = block({ declare: [variable("someValue", { kind: "decimal", precision: 10, scale: 2 }, val("1"))], returns: "none", body: [done()] });
    assert(v.kind === "ok" && v.value.some((p) => typeof p !== "string" && p.ref === "type" && p.type.kind === "decimal"));
    const w = bind(libraryAt(1), { dialect: postgres, sources: [routinesSource([{ kind: "procedure", name: "p", description: "x", language: "plpgsql", body: must(v) as RoutineDefinition["body"] }])] });
    assert(w.kind === "ok" && w.value.statements.some((s) => s.sql.toLowerCase().includes('"some_value" numeric(10, 2) := \'1\';')), w.kind === "ok" ? w.value.statements.map((s) => s.sql).filter((x) => x.includes("some_value")).join("") : "");
  },
);
