// Spec: 0053-sql-typed FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * The typed table, column and row algebra and query builder (commons data 0053-sql-typed), on real engines: expressions that only compile for the types they fit, tables and their columns, selects with joins,
 * groups, order, set operations, subqueries and common table expressions on SQLite, DuckDB and PostgreSQL, statements (insert, upsert, update, delete, returning) that cannot be run without a condition, values that
 * cannot become SQL, and the typed tables of each model: up to date, owned by a model, and made of the columns that the database has.
 *
 * @module
 */
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { allModules, defineArca, schemaOf } from "@intellectual-frontiers/data/sql/cli";
import { bind, type Dialect } from "@intellectual-frontiers/data/sql/physical";
import {
  add, and, asc, between, choose, coalesce, count, countOf, defineTable, deleteFrom, desc, eq, excluded, from, gt, ilike, inList, insertInto, isNotNull, isNull, keyIs, like, lit, lower, lte, max, ne, not, or, sum,
  type Expr, type Runner, update,
} from "@intellectual-frontiers/data/sql/typed";
import * as models from "@intellectual-frontiers/data/sql/typed/models";
import { DIALECTS, load, openEngine, type Engine } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { driverOf } from "./lifecycle-fixture.ts";
import { expected } from "../tools/typed.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface AuthorRow { readonly id: number; readonly name: string; readonly bio: string | null; readonly boss: number | null }
interface AuthorInsert { readonly id?: number; readonly name: string; readonly bio?: string | null; readonly boss?: number | null }
interface BookRow { readonly id: number; readonly authorId: number; readonly title: string; readonly pages: number }
interface BookInsert { readonly id: number; readonly authorId: number; readonly title: string; readonly pages: number }
const author = defineTable<AuthorRow, AuthorInsert, "author">({ alias: "author", name: "author", columns: { id: "id", name: "name", bio: "bio", boss: "boss_id" }, primaryKey: ["id"] });
const book = defineTable<BookRow, BookInsert, "book">({ alias: "book", name: "book", columns: { id: "id", authorId: "author_id", title: "title", pages: "pages" }, primaryKey: ["id"] });

async function world(name: Engine["name"]): Promise<{ e: Engine; on: Runner; d: Dialect }> {
  const e = await openEngine(name);
  const dialect = DIALECTS.find((x) => x.name === name)!.dialect;
  await e.run("CREATE TABLE author (id INTEGER PRIMARY KEY, name TEXT NOT NULL, bio TEXT, boss_id INTEGER)");
  await e.run("CREATE TABLE book (id INTEGER PRIMARY KEY, author_id INTEGER NOT NULL, title TEXT NOT NULL, pages INTEGER NOT NULL)");
  await e.run("INSERT INTO author VALUES (1,'Ann',NULL,NULL),(2,'Bo','poet',1),(3,'Cy',NULL,1)");
  await e.run("INSERT INTO book VALUES (1,1,'A1',100),(2,1,'A2',300),(3,2,'B1',50)");
  return { e, on: { driver: driverOf(e), dialect }, d: dialect };
}
const each = async (f: (w: { e: Engine; on: Runner; d: Dialect }, name: string) => Promise<void>): Promise<void> => {
  for (const { name } of DIALECTS) {
    const w = await world(name);
    try {
      await f(w, name);
    } finally {
      await w.e.close();
    }
  }
};
const sqlOf = (q: { toSql(d: Dialect): { kind: string; value?: string; error?: unknown } }, d: Dialect): string => {
  const r = q.toSql(d);
  if (r.kind !== "ok") throw new Error(String(r.error));
  return r.value!;
};

proves(
  ["0053-sql-typed FR-001", "0053-sql-typed FR-002"],
  "expressions give the type of what they compute and only compile for the types they fit: a number is not compared with a text, a name is not summed, a null is asked with isNull, and a column that may be null is a nullable expression",
  () => {
    const c = author.c;
    const a: Expr<boolean> = eq(c.id, 1);
    eq(c.name, "x");
    // @ts-expect-error a number is not compared with a text
    eq(c.id, "x");
    // @ts-expect-error a name is not summed
    sum(c.name);
    // @ts-expect-error a text is not added to
    add(c.name, 1);
    // @ts-expect-error a number is not a pattern
    like(c.bio, 3);
    eq(c.bio, "x"); // the operand of a nullable column is its type without null
    // @ts-expect-error null is not a value to compare with
    eq(c.bio, null);
    const total: Expr<number | null> = sum(book.c.pages);
    const n: Expr<number> = count();
    const maybe: Expr<string | null> = c.bio;
    const sure: Expr<string> = coalesce(c.bio, "");
    void [a, total, n, maybe, sure, and(), or(not(isNull(c.bio)), isNotNull(c.bio)), between(c.id, 1, 2), inList(c.id, [1, 2]), ilike(c.name, "a%"), lower(c.name), choose([[eq(c.id, 1), "one"]], "other"), lit(3), max(c.name), asc(c.id), desc(c.id)];
    same(
      [add(c.id, 1).node.k, eq(c.id, 1).node.k, and(eq(c.id, 1)).node.k],
      ["bin", "bin", "bool"],
    );
  },
);

proves(["0053-sql-typed FR-003"], "a table has a typed column for each key of its row, the keys are the names a program writes and the names in SQL are those the table says, a table can be known by another name and put in another schema", () => {
  const keys = Object.keys(book.c);
  same(keys, ["id", "authorId", "title", "pages"]);
  same(book.c.authorId.name, "author_id");
  same(book.c.authorId.key, "authorId");
  const b2 = book.as("b2");
  same(b2.alias, "b2");
  same(b2.c.title.node, { k: "col", alias: "b2", name: "title" });
  same(book.inSchema("shop").source, { kind: "table", schema: "shop", name: "book" });
  // @ts-expect-error a key that the row does not have
  void book.c.nope;
  same(book.primaryKey, ["id"]);
});

proves(
  ["0053-sql-typed FR-004", "0053-sql-typed FR-005"],
  "a select with joins (inner, left, right, full, cross), conditions, groups, having, order, limit, offset and distinct gives rows of the type it names, on SQLite, DuckDB and PostgreSQL; an outer join makes the columns of the other side nullable",
  async () => {
    await each(async ({ on }, name) => {
      const inner = await from(author).innerJoin(book, (s) => eq(s.book.authorId, s.author.id)).select((s) => ({ who: s.author.name, title: s.book.title })).orderBy((_, o) => [asc(o.title)]).run(on);
      same(inner, [{ who: "Ann", title: "A1" }, { who: "Ann", title: "A2" }, { who: "Bo", title: "B1" }], name);
      const left = await from(author)
        .leftJoin(book, (s) => eq(s.book.authorId, s.author.id))
        .select((s) => ({ who: s.author.name, title: s.book.title }))
        .orderBy((_, o) => [asc(o.who), asc(o.title)])
        .run(on);
      const t: string | null | undefined = left[3]?.title; // nullable: the other side may be missing
      same(left.map((r) => `${r.who}:${r.title}`), ["Ann:A1", "Ann:A2", "Bo:B1", "Cy:null"], name);
      void t;
      const right = await from(book).rightJoin(author, (s) => eq(s.book.authorId, s.author.id)).select((s) => ({ who: s.author.name, title: s.book.title })).orderBy((_, o) => [asc(o.who), asc(o.title)]).run(on);
      same(right.length, 4, name);
      const full = await from(author).fullJoin(book, (s) => and(eq(s.book.authorId, s.author.id), gt(s.book.pages, 60))).select((s) => ({ who: s.author.name, title: s.book.title })).run(on);
      same(full.length, 5, name); // Ann twice, Bo and Cy with none, and book B1 with none
      const cross = await from(author).crossJoin(book).select(() => ({ n: count() })).run(on);
      same(cross, [{ n: 9 }], name);
      const grouped = await from(author)
        .leftJoin(book, (s) => eq(s.book.authorId, s.author.id))
        .groupBy((s) => [s.author.id, s.author.name])
        .having((s) => gt(countOf(s.book.id), 0))
        .select((s) => ({ id: s.author.id, name: s.author.name, books: countOf(s.book.id), pages: sum(s.book.pages) }))
        .orderBy((_, o) => [desc(o.books), asc(o.id)])
        .run(on);
      same(grouped.map((r) => [r.name, r.books, Number(r.pages)]), [["Ann", 2, 400], ["Bo", 1, 50]], name);
      const page = await from(book).select((s) => ({ id: s.book.id })).orderBy((_, o) => [asc(o.id)]).limit(1).offset(1).run(on);
      same(page, [{ id: 2 }], name);
      const only = await from(book).select((s) => ({ a: s.book.authorId })).distinct().orderBy((_, o) => [asc(o.a)]).run(on);
      same(only, [{ a: 1 }, { a: 2 }], name);
      same(await from(author).where((s) => eq(s.author.id, 2)).select((s) => ({ n: s.author.name })).first(on), { n: "Bo" }, name);
      same(await from(author).where((s) => eq(s.author.id, 99)).select((s) => ({ n: s.author.name })).first(on), undefined, name);
    });
  },
);

proves(
  ["0053-sql-typed FR-005"],
  "set operations, subqueries (in, not in, exists, a value), common table expressions, derived tables and a table joined to itself under another name run on each engine, and a name used twice in one query is refused",
  async () => {
    await each(async ({ on }, name) => {
      const ids = from(author).where((s) => eq(s.author.id, 1)).select((s) => ({ id: s.author.id }));
      const more = from(author).where((s) => eq(s.author.id, 3)).select((s) => ({ id: s.author.id }));
      same((await ids.union(more).orderBy((_, o) => [asc(o.id)]).run(on)).map((r) => r.id), [1, 3], name);
      same((await ids.unionAll(ids).run(on)).length, 2, name);
      same((await from(author).select((s) => ({ id: s.author.id })).except(more).orderBy((_, o) => [asc(o.id)]).run(on)).map((r) => r.id), [1, 2], name);
      same((await from(author).select((s) => ({ id: s.author.id })).intersect(more).run(on)).map((r) => r.id), [3], name);
      const wrote = from(book).select((s) => ({ a: s.book.authorId }));
      same((await from(author).where((s) => wrote.contains(s.author.id)).select((s) => ({ n: s.author.name })).orderBy((_, o) => [asc(o.n)]).run(on)).map((r) => r.n), ["Ann", "Bo"], name);
      same((await from(author).where((s) => wrote.excludes(s.author.id)).select((s) => ({ n: s.author.name })).run(on)).map((r) => r.n), ["Cy"], name);
      const has = from(book).where((s) => eq(s.book.title, "B1")).select(() => ({ one: lit(1) }));
      same((await from(author).where(() => has.exists()).select(() => ({ n: count() })).run(on))[0]?.n, 3, name);
      const most = from(book).select((s) => ({ m: max(s.book.pages) }));
      same((await from(book).where((s) => eq(s.book.pages, most.asValue() as Expr<number>)).select((s) => ({ t: s.book.title })).run(on)).map((r) => r.t), ["A2"], name);
      const big = from(book).where((s) => gt(s.book.pages, 60)).select((s) => ({ authorId: s.book.authorId, title: s.book.title })).asCte("big");
      same((await from(author).innerJoin(big, (s) => eq(s.big.authorId, s.author.id)).select((s) => ({ n: s.author.name, t: s.big.title })).orderBy((_, o) => [asc(o.t)]).run(on)).map((r) => `${r.n}:${r.t}`), ["Ann:A1", "Ann:A2"], name);
      const perAuthor = from(book).groupBy((s) => [s.book.authorId]).select((s) => ({ a: s.book.authorId, n: count() })).asTable("per");
      same((await from(perAuthor).where((s) => gt(s.per.n, 1)).select((s) => ({ a: s.per.a })).run(on)), [{ a: 1 }], name);
      const boss = author.as("boss");
      same(
        (await from(author).innerJoin(boss, (s) => eq(s.author.boss, s.boss.id)).select((s) => ({ n: s.author.name, b: s.boss.name })).orderBy((_, o) => [asc(o.n)]).run(on)).map((r) => `${r.n}>${r.b}`),
        ["Bo>Ann", "Cy>Ann"],
        name,
      );
      let refused = "";
      try {
        // @ts-expect-error the name author is already in the query
        from(author).innerJoin(author, (s) => eq(s.author.id, s.author.id));
      } catch (thrown) {
        refused = String(thrown);
      }
      assert(refused.includes("used twice"), refused);
    });
  },
);

proves(
  ["0053-sql-typed FR-006"],
  "every value is written by the dialect as a literal, so a quote in a text is doubled and cannot become SQL; a date is written as text; a number that is not finite, and bytes, are an error value; an empty list is false and an empty and is true",
  async () => {
    await each(async ({ on, d, e }, name) => {
      const evil = "x'; DROP TABLE author; --";
      same(await from(author).where((s) => eq(s.author.name, evil)).select(() => ({ n: count() })).run(on), [{ n: 0 }], name);
      same((await e.rows("SELECT count(*) AS n FROM author"))[0]?.["n"] !== undefined, true, name);
      same(await from(author).where((s) => inList(s.author.id, [])).select(() => ({ n: count() })).run(on), [{ n: 0 }], name);
      same(await from(author).where(() => and()).select(() => ({ n: count() })).run(on), [{ n: 3 }], name);
      const bad = from(author).where((s) => eq(s.author.id, Number.NaN)).select((s) => ({ id: s.author.id })).toSql(d);
      assert(bad.kind === "err" && bad.error.message.includes("not a number"), name);
      const bytes = insertInto(book).values({ id: 9, authorId: 1, title: new Uint8Array([1]) as unknown as string, pages: 1 }).toSql(d);
      assert(bytes.kind === "err" && bytes.error.message.includes("bytes"), name);
      const when = from(author).where((s) => eq(s.author.name, new Date("2026-01-02T03:04:05Z") as unknown as string)).select((s) => ({ id: s.author.id })).toSql(d);
      assert(when.kind === "ok" && when.value.includes("2026-01-02T03:04:05"), name);
    });
  },
);

proves(
  ["0053-sql-typed FR-007"],
  "insert (one row and many, with what the database fills left out), upsert (do nothing, do update with the proposed value), update with values and expressions, delete and returning run on each engine; an update or a delete cannot be run until it says where or all, and a row of other columns than the first is refused",
  async () => {
    await each(async ({ on, d }, name) => {
      const added = await insertInto(author).values([{ id: 10, name: "Di", bio: null }, { id: 11, name: "Ed", bio: "x" }]).returning((c) => ({ id: c.id, name: c.name })).run(on);
      same(added.map((r) => r.name), ["Di", "Ed"], name);
      // @ts-expect-error a key that the table does not have
      insertInto(author).values({ id: 12, name: "x", nope: 1 });
      // @ts-expect-error a value of another type
      insertInto(author).values({ id: 12, name: 3 });
      // @ts-expect-error a name is not optional
      insertInto(author).values({ id: 12 });
      await insertInto(author).values({ id: 10, name: "Again" }).onConflictDoNothing("id").run(on);
      same((await from(author).where((s) => eq(s.author.id, 10)).select((s) => ({ n: s.author.name })).run(on))[0]?.n, "Di", name);
      await insertInto(author).values({ id: 10, name: "Again" }).onConflictDoUpdate(["id"], { name: excluded(author.c.name) }).run(on);
      same((await from(author).where((s) => eq(s.author.id, 10)).select((s) => ({ n: s.author.name })).run(on))[0]?.n, "Again", name);
      const changed = await update(book).set((c) => ({ pages: add(c.pages, 1) })).where((c) => eq(c.authorId, 1)).returning((c) => ({ id: c.id, pages: c.pages })).run(on);
      same(changed.map((r) => r.pages).sort(), [101, 301], name);
      await update(author).set({ bio: "hello" }).where((c) => and(isNull(c.bio), ne(c.id, 1))).run(on);
      same((await from(author).where((s) => eq(s.author.bio, "hello")).select((s) => ({ id: s.author.id })).orderBy((_, o) => [asc(o.id)]).run(on)).map((r) => r.id), [3, 10], name);
      const gone = await deleteFrom(book).where((c) => lte(c.pages, 60)).returning((c) => ({ id: c.id })).run(on);
      same(gone, [{ id: 3 }], name);
      // an update without a condition cannot be run, nor a delete: neither compiles, and neither has the method
      const unconditional = [
        // @ts-expect-error no run before where or all
        () => update(book).set({ pages: 1 }).run(on),
        // @ts-expect-error nor a delete
        () => deleteFrom(book).toSql(d),
      ];
      for (const f of unconditional) assert((() => { try { f(); return false; } catch (thrown) { return thrown instanceof TypeError; } })(), `${name}: not a statement`);
      await deleteFrom(author).where((c) => between(c.id, 10, 11)).run(on);
      same((await from(author).select(() => ({ n: count() })).run(on))[0]?.n, 3, name);
      const all = await deleteFrom(book).all().returning((c) => ({ id: c.id })).run(on);
      same(all.length, 2, name);
      const ragged = insertInto(author).values([{ id: 20, name: "a" }, { id: 21, name: "b", bio: "c" }]).toSql(d);
      assert(ragged.kind === "err" && ragged.error.message.includes("same columns"), name);
      assert(sqlOf(update(book).set({ pages: 2 }).where((c) => eq(c.id, 1)), d).includes(`SET ${d.quote("pages")} = 2 WHERE (${d.quote("id")} = 1)`), name);
      same(keyIs(book, { id: 1 }).node.k, "bool");
      let missing = "";
      try {
        keyIs(book, {});
      } catch (thrown) {
        missing = String(thrown);
      }
      assert(missing.includes("needs a value for id"), missing);
    });
  },
);

proves(["0053-sql-typed FR-008", "0053-sql-typed FR-009"], "the typed tables of each model are what the models say (none stale, missing or stray), every table of every model is owned by one, and the row types name the columns that a database made from the models has", async () => {
  const want = expected();
  const dir = join(import.meta.dirname, "..", "sql", "typed", "models");
  for (const [file, text] of want) same(readFileSync(join(dir, file), "utf8") === text, true, `${file} is up to date: run bun tools/typed.ts --write`);
  assert(want.size === allModules().length + 1, `a file for each model that owns a table, and mod.ts: ${want.size}`);
  const all = Object.values(models).flatMap((m) => Object.values(m as Record<string, unknown>).filter((v): v is { kind: "table"; alias: string; source: { name: string }; c: Record<string, Expr<unknown>> } => typeof v === "object" && v !== null && (v as { kind?: string }).kind === "table"));
  assert(all.length >= 70, `tables: ${all.length}`);
  const config = defineArca({ models: ["identityAgent", "identityPki", "identityRebac", "identityDevice", "identityMachine", "issues"] as never });
  const r = schemaOf(config as never);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  for (const { name, dialect } of DIALECTS) {
    const e = await openEngine(name);
    try {
      const physical = bind(r.value.schema, { dialect });
      if (physical.kind === "err") throw new Error(`${name}: the models bind: ${JSON.stringify(physical.error).slice(0, 300)}`);
      await load(e, physical.value, ["setup", "table"]);
      const on: Runner = { driver: driverOf(e), dialect };
      let checked = 0;
      for (const t of all) {
        const keys = Object.keys(t.c);
        const present = await e.rows(`SELECT * FROM ${dialect.quote(t.source.name)} LIMIT 0`).then(() => true, () => false);
        if (!present) continue;
        await from(t as never).select((s: Record<string, Record<string, Expr<unknown>>>) => Object.fromEntries(keys.map((k) => [k, s[t.alias]![k]!]))).limit(0).run(on);
        checked++;
      }
      assert(checked >= 20, `${name}: ${checked} tables of the models were read through their typed columns`);
    } finally {
      await e.close();
    }
  }
});
