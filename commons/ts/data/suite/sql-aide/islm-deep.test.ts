/**
 * ISLM's deep comparison (commons 0009-sql-aide FR-035): for each dialect and each kind of difference its catalog shows, a database
 * made from one model and planned against another (or changed by hand) gives a plan that names that difference and nothing else; and a
 * database made from a model plans nothing, in SQLite, DuckDB, PGlite and on the PostgreSQL server.
 *
 * @module
 */
import { assertEquals, proves } from "../../../runtime/test.ts";
import {
  apply,
  context,
  date,
  definitions,
  duckdb,
  type Entity,
  enumType,
  fk,
  fn,
  from,
  gte,
  index,
  inspect,
  integer,
  type Plan,
  plan,
  partitionBy,
  pgDomain,
  pk,
  policy,
  postgres,
  raw,
  real,
  render,
  rowLevelSecurity,
  scalar,
  sequence,
  shadow,
  sqlite,
  SQL,
  table,
  text,
  trigger,
  valueAs,
  view,
} from "../../sql-aide/mod.ts";
import { anotherLike, eachEngine, type Engine, pgliteEngine, postgresEngine } from "../helpers.ts";

const contexts = {
  postgres: context({ dialect: postgres() }),
  sqlite: context({ dialect: sqlite() }),
  duckdb: context({ dialect: duckdb() }),
};

/** What a variant of the small model changes. */
interface Variant {
  readonly weightReal?: boolean;
  readonly qtyDefault?: number;
  readonly checkAtLeast?: number;
  readonly generatedFactor?: number;
  readonly indexColumns?: readonly ("qty" | "note")[];
  readonly viewAtLeast?: number;
  readonly doc?: string;
  readonly cascade?: boolean;
  readonly uniqueNote?: boolean;
}

/** The small model every dialect holds: a kind, an item that points at it, an index and a view. */
function portable(v: Variant = {}): readonly Entity[] {
  const kind = table(
    "kind",
    { code: pk.text(), label: text(), weight: v.weightReal === true ? real().nullable() : integer().nullable() },
    { doc: v.doc ?? "The kinds of item" },
  );
  const kindCode = v.cascade === true ? fk(kind.c.code).on("delete", "cascade") : fk(kind.c.code);
  const qty = integer().default(v.qtyDefault ?? 1);
  const item = table(
    "item",
    {
      id: pk.text(),
      kind_code: kindCode,
      qty,
      note: text().nullable(),
      twice: integer().generatedAs(raw(`"qty" * ${v.generatedFactor ?? 2}`)),
    },
    v.uniqueNote === true ? { unique: [["kind_code", "note"]] } : {},
  ).check("enough", (c) => gte(valueAs<number>()(SQL`${c.qty}`), v.checkAtLeast ?? 0));
  const byQty = index(item, v.indexColumns ?? ["qty"]);
  const many = view(
    "many_items",
    { id: text() },
    SQL`SELECT ${item.c.id} FROM ${item} WHERE ${item.c.qty} >= ${raw(String(v.viewAtLeast ?? 10))}`,
    { from: [item] },
  );
  return [kind, item, byQty, many];
}

/** The PostgreSQL objects of the model, with what a variant changes of them. */
function postgresOnly(
  v: {
    readonly labels?: readonly string[];
    readonly body?: string;
    readonly policyLabel?: string;
    readonly domainCheck?: string;
    readonly until?: string;
  } = {},
): readonly Entity[] {
  const mood = enumType("mood", v.labels ?? ["calm", "busy"]);
  const tickets = sequence("ticket");
  const email = pgDomain("email", text(), { check: raw(`VALUE ~ '${v.domainCheck ?? "@"}'`) });
  const member = table("member", { member_id: pk.text(), name: text() }, { doc: "Members" });
  const shout = fn("shout", {
    args: { s: text() },
    returns: scalar(text()),
    body: ({ s }) => valueAs<string>()(SQL`upper(${s})${raw(v.body ?? "")}`),
  });
  const audit = table("member_audit", { member_id: text() });
  const log = trigger("member_log", member, { timing: "after", events: ["insert"] }, (row) => [
    SQL`INSERT INTO ${audit} ("member_id") VALUES (${row.new.member_id})`,
  ]);
  const rls = rowLevelSecurity(member);
  const own = policy("member_own", member, { for: "select", using: raw(`"name" <> '${v.policyLabel ?? "nobody"}'`) });
  const event = partitionBy(table("event", { event_id: pk.text(), at: date().primaryKey() }), "range", ["at"]);
  const year = event.partition("event_2026", { from: ["2026-01-01"], to: [v.until ?? "2027-01-01"] });
  return [mood, tickets, email, member, shout, audit, log, rls, own, event, year];
}

/** The plan of a database made from one model, changed by hand where asked, against another model's shadow. */
async function planned(engine: Engine, made: readonly Entity[], wanted: readonly Entity[], byHand: readonly string[] = []): Promise<Plan> {
  // each model here is written for the dialect it is planned in; the compiler cannot see that through a list of entities
  const ctx = contexts[engine.dialect] as never;
  await engine.exec(render(definitions(made) as never, ctx));
  for (const s of byHand) await engine.exec(s);
  const empty = await anotherLike(engine);
  if (empty === undefined) throw new Error("no engine for the shadow");
  try {
    const sh = await shadow(wanted, empty, ctx);
    const catalog = await inspect(engine, ctx);
    if (catalog.kind === "err") throw new Error(catalog.error.message);
    return await plan({ entities: wanted }, catalog.value, ctx, { shadow: sh });
  } finally {
    await empty.close();
  }
}

/** A plan as what a test compares: each change's kind and step, and each difference no change makes. */
const said = (p: Plan): readonly string[] => [
  ...p.changes.map((c) => `${c.what} ${c.step}`),
  ...p.unplanned.map((u) => `by hand: ${u.slice(0, u.indexOf(":") < 0 ? u.length : u.indexOf(":"))}`),
];

/** A table of the differences each dialect is held to: the variant, what is done by hand, and what the plan must say. */
interface Case {
  readonly name: string;
  readonly variant?: Variant;
  readonly byHand?: (schema: string) => readonly string[];
  readonly expect: Readonly<Record<"sqlite" | "duckdb" | "postgres", readonly string[] | undefined>>;
}

const cases: readonly Case[] = [
  {
    name: "a column's type",
    variant: { weightReal: true },
    expect: {
      sqlite: ["by hand: column main.kind.weight"],
      duckdb: ["by hand: column main.kind.weight"],
      postgres: ["by hand: column public.kind.weight"],
    },
  },
  {
    name: "a column's default",
    variant: { qtyDefault: 2 },
    expect: {
      sqlite: ["by hand: column main.item.qty"],
      duckdb: ["set-default column main.item.qty:default"],
      postgres: ["set-default column public.item.qty:default"],
    },
  },
  {
    name: "a generated column's expression",
    variant: { generatedFactor: 3 },
    expect: {
      sqlite: ["by hand: column main.item.twice"],
      duckdb: ["by hand: column main.item.twice"],
      postgres: ["by hand: column public.item.twice"],
    },
  },
  {
    name: "a check",
    variant: { checkAtLeast: 1 },
    expect: {
      sqlite: ["by hand: constraint main.item", "by hand: constraint main.item"],
      duckdb: ["by hand: constraint main.item", "by hand: constraint main.item"],
      postgres: ["replace-constraint constraint public.item.item_enough_ck:replace"],
    },
  },
  {
    name: "a foreign key's action",
    variant: { cascade: true },
    expect: {
      sqlite: ["by hand: constraint main.item", "by hand: constraint main.item"],
      duckdb: undefined,
      postgres: ["replace-constraint constraint public.item.item_kind_code_fk:replace"],
    },
  },
  {
    name: "a unique constraint added",
    variant: { uniqueNote: true },
    expect: {
      sqlite: ["by hand: constraint main.item"],
      duckdb: ["by hand: constraint main.item"],
      postgres: ["add-constraint constraint public.item.item_kind_code_note_uq:add"],
    },
  },
  {
    name: "an index's columns",
    variant: { indexColumns: ["qty", "note"] },
    expect: {
      sqlite: ["create index:main.item_qty_note_idx", "drop-index index main.item_qty_idx:drop"],
      duckdb: ["create index:main.item_qty_note_idx", "drop-index index main.item_qty_idx:drop"],
      postgres: ["create index:public.item_qty_note_idx", "drop-index index public.item_qty_idx:drop"],
    },
  },
  {
    name: "an index made by hand",
    byHand: () => [`CREATE INDEX "by_hand" ON "item" ("note")`],
    expect: {
      sqlite: ["drop-index index main.by_hand:drop"],
      duckdb: ["drop-index index main.by_hand:drop"],
      postgres: ["drop-index index public.by_hand:drop"],
    },
  },
  {
    name: "an index's definition changed by hand",
    byHand: () => [`DROP INDEX "item_qty_idx"`, `CREATE INDEX "item_qty_idx" ON "item" ("qty", "id")`],
    expect: {
      sqlite: ["replace index main.item_qty_idx:replace"],
      duckdb: ["replace index main.item_qty_idx:replace"],
      postgres: ["replace index public.item_qty_idx:replace"],
    },
  },
  {
    name: "a view's definition",
    variant: { viewAtLeast: 20 },
    expect: {
      sqlite: ["replace view:main.many_items"],
      duckdb: ["replace view:main.many_items"],
      postgres: ["replace view:public.many_items"],
    },
  },
  {
    name: "a table's comment",
    variant: { doc: "The kinds of thing" },
    expect: { sqlite: [], duckdb: ["replace table:main.kind"], postgres: ["replace table:public.kind"] },
  },
  {
    name: "a comment made by hand",
    byHand: () => [`COMMENT ON COLUMN "item"."note" IS 'by hand'`],
    expect: {
      sqlite: undefined,
      duckdb: ["replace comment column main.item.note:drop"],
      postgres: ["replace comment column public.item.note:drop"],
    },
  },
  {
    name: "a check added by hand",
    byHand: () => [`ALTER TABLE "item" ADD CONSTRAINT "by_hand" CHECK ("qty" < 1000)`],
    expect: { sqlite: undefined, duckdb: undefined, postgres: ["drop-constraint constraint public.item.by_hand:drop"] },
  },
];

proves(
  ["0009-sql-aide FR-035", "0009-sql-aide FR-036", "0009-sql-aide FR-040"],
  "a database made from the model plans nothing, and each difference of the portable model is named alone, in every engine",
  async () => {
    await eachEngine(async (engine) => {
      const base = portable();
      // no false drift: made from the model, compared with the model
      assertEquals(said(await planned(engine, base, base)), [], `${engine.name}: no drift`);
    });
    for (const c of cases) {
      await eachEngine(async (engine) => {
        const want = c.expect[engine.dialect];
        if (want === undefined) return;
        const schema = engine.dialect === "postgres" ? "public" : "main";
        const p = await planned(engine, portable(), portable(c.variant ?? {}), c.byHand?.(schema) ?? []);
        assertEquals(said(p), want, `${engine.name}: ${c.name}: ${JSON.stringify(p.unplanned)}`);
      });
    }
  },
  { timeout: 600_000 },
);

proves(
  ["0009-sql-aide FR-035", "0009-sql-aide FR-022"],
  "PostgreSQL's objects are compared: types, sequences, domains, routines, triggers, row-level security and policies",
  async () => {
    const pg = contexts.postgres;
    const cases0: readonly {
      readonly name: string;
      readonly variant?: Parameters<typeof postgresOnly>[0];
      readonly byHand?: readonly string[];
      readonly expect: readonly string[];
    }[] = [
      { name: "nothing", expect: [] },
      { name: "a label appended", variant: { labels: ["calm", "busy", "away"] }, expect: ["add-enum-values enum public.mood:add-values"] },
      { name: "a label removed", variant: { labels: ["calm"] }, expect: ["by hand: enum public.mood"] },
      { name: "a domain's check", variant: { domainCheck: "@x" }, expect: ["by hand: domain public.email"] },
      { name: "a routine's body", variant: { body: ` || '!'` }, expect: ["replace routine:public.shout"] },
      { name: "a partition's bounds", variant: { until: "2026-07-01" }, expect: ["by hand: partition public.event_2026"] },
      { name: "a policy's rows", variant: { policyLabel: "somebody" }, expect: ["replace policy:public.member_own"] },
      {
        name: "a sequence changed by hand",
        byHand: [`ALTER SEQUENCE "ticket" INCREMENT BY 5`],
        expect: ["by hand: sequence public.ticket"],
      },
      {
        name: "row-level security turned off by hand",
        byHand: [`ALTER TABLE "member" DISABLE ROW LEVEL SECURITY`],
        expect: ["replace rls:public.member_rls"],
      },
      {
        name: "a trigger dropped by hand",
        byHand: [`DROP TRIGGER "member_log" ON "member"`],
        expect: ["replace trigger:public.member_log"],
      },
      {
        name: "a function made by hand",
        byHand: [`CREATE FUNCTION "by_hand"() RETURNS int LANGUAGE sql AS 'SELECT 1'`],
        expect: ["by hand: routine public.by_hand() is in the database and not in the model"],
      },
    ];
    for (const engine0 of [pgliteEngine, postgresEngine]) {
      for (const c of cases0) {
        const engine = await engine0();
        if (engine === undefined) {
          console.log("# SKIP PostgreSQL's objects on a server: IFCSQL_PG_URL is not set");
          break;
        }
        try {
          const p = await planned(engine, postgresOnly(), postgresOnly(c.variant ?? {}), c.byHand ?? []);
          assertEquals(said(p), c.expect, `${c.name}: ${JSON.stringify(p.unplanned)}`);
        } finally {
          await engine.close();
        }
      }
    }
    void pg;
  },
  { timeout: 600_000 },
);

proves(
  ["0009-sql-aide FR-035"],
  "DuckDB's macros and SQLite's triggers are compared",
  async () => {
    const kind = table("kind", { code: pk.text(), label: text() });
    const label = (suffix: string): Entity =>
      fn("label_of", { args: { k: text() }, returns: scalar(text()), body: ({ k }) => valueAs<string>()(SQL`upper(${k})${raw(suffix)}`) });
    const { duckdbEngine, sqliteEngine } = await import("../helpers.ts");
    const duck = await duckdbEngine();
    try {
      assertEquals(said(await planned(duck, [kind, label("")], [kind, label(` || '!'`)])), ["replace routine:main.label_of"]);
    } finally {
      await duck.close();
    }
    const audit = table("audit", { code: text() });
    const logged = (column: "code" | "label"): Entity =>
      trigger("kind_log", kind, { timing: "after", events: ["insert"] }, (row) => [
        SQL`INSERT INTO ${audit} ("code") VALUES (${row.new[column]})`,
      ]);
    const lite = await sqliteEngine();
    try {
      assertEquals(said(await planned(lite, [kind, audit, logged("code")], [kind, audit, logged("label")])), [
        "replace trigger:main.kind_log",
      ]);
    } finally {
      await lite.close();
    }
    void from;
    void apply;
  },
  { timeout: 120_000 },
);
