// Spec: 0011-sql-lifecycle FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014
/**
 * The lifecycle core (commons data 0011-sql-lifecycle): the state of a database is a hashed value; changes are found by identity and applying them reaches the state wanted, for any two states;
 * a plan classifies each change and refuses what loses data or what the engine cannot do; the ledger finds a touched entry; and a plan runs on SQLite, DuckDB and PostgreSQL, each step in a
 * transaction, only on the database it was made for.
 *
 * @module
 */
import { readdirSync, readFileSync } from "node:fs";
import { sha256 } from "@intellectual-frontiers/crypto";
import { assert, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import fc from "fast-check";
import {
  lint,
  vocabularies,
  defaultVocabularies,
  attribute,
  concept,
  domain,
  identifier,
  text,
  annotate,
} from "@intellectual-frontiers/data/governance";
import { dialect as postgres } from "@intellectual-frontiers/data/sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/data/sql/dialects/sqlite";
import { documentationSources } from "@intellectual-frontiers/data/sql/extensions/documentation";
import {
  applyChanges,
  diff,
  dueRepeatables,
  emptyState,
  execute,
  GENESIS,
  hashOf,
  type LedgerEntry,
  nextEntry,
  plan,
  type Plan,
  type PlanError,
  readLedger,
  sha256Hex,
  type State,
  type StateColumn,
  type StateTable,
  snapshotOf,
  stateHash,
  verifyChain,
} from "@intellectual-frontiers/data/sql/lifecycle";
import { bind, camel, type Dialect, naming } from "@intellectual-frontiers/data/sql/physical";
import { DIALECTS, load, openEngine, structure, type Engine, type Structure } from "./engines-fixture.ts";
import { same } from "./governance-fixture.ts";
import { projected } from "./logical-fixture.ts";
import { driverOf, libraryAt } from "./lifecycle-fixture.ts";

const SNAKE = { names: "snake", codes: "snake" } as const;
const emptyHash = (d: Dialect): string => stateHash(emptyState(d.name, SNAKE));
const snap = (v: 1 | 2 | 3, d: Dialect = postgres, options: { naming?: ReturnType<typeof naming> } = {}): State => {
  const r = snapshotOf(libraryAt(v), { dialect: d, ...options });
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const planOf = (from: State | undefined, v: 1 | 2 | 3, d: Dialect = postgres, options: Parameters<typeof plan>[3] = {}): Plan => {
  const r = plan(from, libraryAt(v), { dialect: d }, options);
  if (r.kind === "err") throw new Error(JSON.stringify(r.error));
  return r.value;
};
const errorsOf = (from: State | undefined, v: 1 | 2 | 3, d: Dialect, options: Parameters<typeof plan>[3] = {}): readonly PlanError[] => {
  const r = plan(from, libraryAt(v), { dialect: d }, options);
  if (r.kind === "ok") throw new Error("the plan did not fail");
  return r.error;
};
const withEngine = async (name: Engine["name"], fn: (e: Engine) => Promise<void>): Promise<void> => {
  const e = await openEngine(name);
  try {
    await fn(e);
  } finally {
    await e.close();
  }
};
/** The structure of an engine without the ledger and without the order of columns, which an added column changes. */
const shape = (s: Structure): unknown => ({
  tables: Object.fromEntries(
    Object.entries(s.tables)
      .filter(([n]) => n !== "lifecycle_ledger")
      .map(([n, t]) => [
        n,
        { columns: Object.fromEntries(Object.entries(t.columns).sort(([a], [b]) => (a < b ? -1 : 1))), primaryKey: t.primaryKey },
      ])
      .sort(([a], [b]) => ((a as string) < (b as string) ? -1 : 1)),
  ),
  indexes: s.indexes,
});
const edit = (s: State, table: string, fn: (t: StateTable) => StateTable): State => ({
  ...s,
  tables: s.tables.map((t) => (t.name === table ? fn(t) : t)),
});

proves(["0011-sql-lifecycle FR-001"], "the lifecycle is a unit with a public surface, and its files name no engine", () => {
  const exportsMap = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).exports as Record<string, string>;
  same(exportsMap["./sql/lifecycle"], "./sql/lifecycle/api.ts");
  const dir = new URL("../sql/lifecycle/", import.meta.url);
  for (const name of readdirSync(dir)) {
    const source = readFileSync(new URL(name, dir), "utf8");
    assert(!/postgres|sqlite|duckdb|pglite/i.test(source), `${name} names an engine`);
  }
});

proves(
  ["0011-sql-lifecycle FR-002"],
  "a state is a hashed value that is the same for the same structure in any order, and another for another dialect or naming; the hash is the SHA-256 the kernel makes",
  async () => {
    const a = snap(2);
    const shuffled: State = { ...a, tables: [...a.tables].reverse().map((t) => ({ ...t, columns: [...t.columns].reverse() })) };
    same(stateHash(a), stateHash(shuffled));
    assert(/^[0-9a-f]{64}$/.test(stateHash(a)));
    assert(stateHash(a) !== stateHash(snap(2, sqlite)), "another dialect");
    assert(stateHash(a) !== stateHash(snap(2, postgres, { naming: naming(camel) })), "another naming");
    assert(stateHash(snap(1)) !== stateHash(snap(2)), "another structure");
    const t = a.tables.find((x) => x.name === "book");
    assert(t !== undefined && t.columns.some((c) => c.name === "pages" && c.nullable && c.type === "INTEGER") && t.primaryKey[0] === "id");
    assert(t.constraints.some((c) => (c.kind === "foreignKey" && c.name === "book_author_fk") || c.kind === "foreignKey"));
    for (const text of ["", "abc", "x".repeat(55), "x".repeat(56), "x".repeat(64), "é".repeat(100), "a".repeat(1000)])
      same(sha256Hex(text), await sha256(text));
    same(hashOf({ b: 1, a: [2, undefined] }), hashOf({ a: [2, undefined], b: 1 }));
  },
);

proves(["0011-sql-lifecycle FR-003"], "bind marks what it makes as the core's and what an extension adds as the extension's", () => {
  const b = bind(libraryAt(1), { dialect: postgres, sources: documentationSources() });
  assert(b.kind === "ok");
  if (b.kind !== "ok") return;
  assert(b.value.statements.every((s) => s.origin !== undefined));
  assert(b.value.statements.some((s) => s.origin === "core" && s.group === "table"));
  assert(b.value.statements.some((s) => s.origin === "extension" && s.group === "documentation"));
  assert(b.value.statements.every((s) => (s.group === "documentation" ? s.origin === "extension" : true)));
});

const emptyOf = (d: Dialect): State => emptyState(d.name, SNAKE);
const arbWords = fc.constantFrom("alpha", "beta", "gamma", "delta", "kappa", "omega");
const arbType = fc.constantFrom("TEXT", "INTEGER", "DATE", "BOOLEAN");
const arbColumn = (table: string): fc.Arbitrary<StateColumn[]> =>
  fc
    .uniqueArray(
      fc.record({ w: arbWords, type: arbType, nullable: fc.boolean(), def: fc.option(fc.constantFrom("1", "'x'"), { nil: undefined }) }),
      { selector: (c) => c.w, minLength: 1, maxLength: 4 },
    )
    .map((cs) =>
      cs.map((c) => ({
        id: `column:${table}/${c.w}`,
        words: [c.w],
        name: c.w,
        type: c.type,
        nullable: c.nullable,
        ...(c.def === undefined ? {} : { default: c.def }),
      })),
    );
const arbTable: fc.Arbitrary<StateTable> = arbWords.chain((w) =>
  fc
    .tuple(arbColumn(w), fc.boolean(), fc.option(fc.constantFrom("PARTITION BY LIST (alpha)"), { nil: undefined }))
    .chain(([columns, keyed, clause]) =>
      fc.subarray(columns.map((c) => c.name)).map((idx) => ({
        id: `table:${w}`,
        words: [w],
        name: w,
        columns,
        primaryKey: keyed ? [columns[0]?.name ?? ""] : [],
        constraints: idx.map((c) => ({ id: `ix:${w}.${c}`, kind: "index" as const, name: `${w}_${c}_idx`, signature: `ix:${c}`, text: c })),
        rows: [],
        ...(clause === undefined ? {} : { clause }),
      })),
    ),
);
const arbState = (d: Dialect): fc.Arbitrary<State> =>
  fc.uniqueArray(arbTable, { selector: (t) => t.name, maxLength: 4 }).map((tables) => ({ ...emptyOf(d), tables }));

proves(
  ["0011-sql-lifecycle FR-005", "0011-sql-lifecycle FR-013"],
  "for any two states the changes of their difference lead from the first to the second, and the difference of a state with itself is empty",
  () => {
    fc.assert(
      fc.property(arbState(postgres), arbState(postgres), (a, b) => {
        const changes = diff(a, b);
        same(stateHash(applyChanges(a, changes)), stateHash(b));
        same(diff(b, b).length, 0);
        same(diff(a, a).length, 0);
        const keys = changes.map((c) => c.key);
        same(new Set(keys).size, keys.length, "a key is for one change");
        const fromNothing = diff(undefined, b);
        same(stateHash(applyChanges(emptyOf(postgres), fromNothing)), stateHash(b));
      }),
      { numRuns: 300 },
    );
  },
);

proves(
  ["0011-sql-lifecycle FR-004"],
  "tables and columns are matched by their words, so a change of case style is a rename, and renamedFrom makes a rename of a change of name",
  () => {
    const snake = snap(2);
    const camelState = snap(2, postgres, { naming: naming(camel) });
    const changes = diff(snake, camelState);
    const kinds: string[] = changes.map((c) => c.kind);
    assert(
      kinds.every((k) => k === "renameTable" || k === "renameColumn" || k === "renameConstraint"),
      "renames only",
    );
    assert(changes.some((c) => c.kind === "renameColumn" && c.from.name === "author_id" && c.to.name === "authorId"));
    assert(!changes.some((c) => c.kind === "renameTable" && c.fromName === c.toName), "no rename where the name is the same");
    const renamed = diff(snap(2), snap(3));
    same(
      renamed.map((c) => c.kind),
      ["renameColumn", "dropColumn"],
    );
    const key = renamed[0]?.key ?? "";
    assert(key.startsWith("renameColumn:author.name>full.name"), key);
    const plain = (() => {
      // the same step without the hint: a drop and an add
      const noHint = edit(snap(3), "author", (t) => ({ ...t, columns: t.columns.map((c) => ({ ...c, renamedFrom: undefined })) as never }));
      return diff(snap(2), noHint).map((c) => c.kind);
    })();
    assert(
      plain.includes("dropColumn") && plain.includes("addColumn") && !plain.includes("renameColumn"),
      "without governance's word, a drop and an add",
    );
    same(
      renamed.map((c) => c.key),
      diff(snap(2), snap(3)).map((c) => c.key),
      "keys are stable",
    );
  },
);

proves(
  ["0011-sql-lifecycle FR-006", "0011-sql-lifecycle FR-008"],
  "changes are classified, destructive ones are refused unless allowed, what the dialect cannot do needs a person's step, and all of it is returned together",
  () => {
    const v2 = snap(2);
    const classes = (p: Plan): string[] => p.steps.map((s) => `${s.class}/${s.reversibility}`);
    same(classes(planOf(undefined, 1)), ["safe/lossless", "safe/lossless", "safe/lossless"]);
    same(classes(planOf(snap(1), 2)), ["safe/lossless", "safe/lossless", "safe/lossless", "safe/lossless"]);
    const drop = errorsOf(v2, 3, postgres);
    assert(drop.length === 1 && drop[0]?.kind === "refused" && drop[0].class === "destructive" && drop[0].key === "dropColumn:author.born");
    const allowed = planOf(v2, 3, postgres, { allow: { destructive: true } });
    const dropStep = allowed.steps.find((s) => s.kind === "dropColumn");
    assert(
      dropStep?.class === "destructive" &&
        dropStep.reversibility === "irreversible" &&
        dropStep.down === undefined &&
        (dropStep.why ?? "").includes("born"),
    );
    // a column that is optional is safe to add
    const without = (s: State): State => edit(s, "book", (t) => ({ ...t, columns: t.columns.filter((c) => c.name !== "pages") }));
    same(
      planOf(without(snap(2)), 2).steps.map((s) => s.class),
      ["safe"],
      "pages is optional in the schema",
    );
    // a type that changes is manual
    const typed = edit(snap(1), "book", (t) => ({
      ...t,
      columns: t.columns.map((c) => (c.name === "title" ? { ...c, type: "VARCHAR(10)" } : c)),
    }));
    const m = errorsOf(typed, 1, postgres);
    assert(m.length === 1 && m[0]?.kind === "manual" && m[0].key === "alterType:book.title" && m[0].why.includes("VARCHAR(10)"));
    const written = planOf(typed, 1, postgres, {
      manual: [
        {
          resolves: "alterType:book.title",
          name: "widen the title",
          up: ['ALTER TABLE "book" ALTER COLUMN "title" TYPE TEXT'],
          down: ['ALTER TABLE "book" ALTER COLUMN "title" TYPE VARCHAR(10)'],
        },
      ],
    });
    const w = written.steps[0];
    assert(
      w?.manual && w.class === "manual" && w.name === "widen the title" && w.up[0]?.sql.endsWith(";") && w.reversibility === "lossless",
    );
    same(
      errorsOf(snap(1), 1, postgres, { manual: [{ resolves: "alterType:nowhere", name: "x", up: ["SELECT 1"] }] }).map((e) => e.kind),
      ["unresolved"],
    );
    // nullability and defaults and constraints, by changing the state a database is in
    const loosened = edit(snap(1), "book", (t) => ({
      ...t,
      columns: t.columns.map((c) => (c.name === "title" ? { ...c, nullable: true } : c)),
    }));
    same(
      planOf(loosened, 1).steps.map((s) => [s.kind, s.class]),
      [["alterNullable", "data-dependent"]],
    );
    const tightened = edit(snap(1), "book", (t) => ({
      ...t,
      columns: t.columns.map((c) => (c.name === "title" ? { ...c, default: "'x'" } : c)),
    }));
    same(
      planOf(tightened, 1).steps.map((s) => [s.kind, s.class]),
      [["alterDefault", "safe"]],
    );
    const noFk = edit(snap(1), "book", (t) => ({ ...t, constraints: t.constraints.filter((c) => c.kind !== "foreignKey") }));
    const fk = planOf(noFk, 1);
    assert(
      fk.steps.length === 2 &&
        fk.steps.every((s) => s.kind === "addConstraint" && s.class === "data-dependent" && s.up[0]?.sql.includes("ADD CONSTRAINT")),
    );
    const extra = edit(snap(1), "book", (t) => ({
      ...t,
      constraints: [
        ...t.constraints,
        {
          id: "x",
          kind: "foreignKey",
          name: "gone_fk",
          signature: "fk:gone",
          text: 'CONSTRAINT "gone_fk" FOREIGN KEY ("x") REFERENCES "y" ("z")',
        },
      ],
    }));
    const dropFk = planOf(extra, 1);
    assert(dropFk.steps[0]?.up[0]?.sql === 'ALTER TABLE "book" DROP CONSTRAINT "gone_fk";' && dropFk.steps[0].class === "safe");
    // the same on an engine that cannot: an error value that says so, together with the others
    const sq = errorsOf(
      edit(snap(1, sqlite), "book", (t) => ({ ...t, constraints: t.constraints.filter((c) => c.kind !== "foreignKey") })),
      1,
      sqlite,
    );
    assert(sq.length === 2 && sq.every((e) => e.kind === "manual" && e.why.includes("sqlite")));
    // all the errors together: a type that changes and a column that is dropped
    const both = errorsOf(
      edit(snap(2), "book", (t) => ({ ...t, columns: t.columns.map((c) => (c.name === "title" ? { ...c, type: "VARCHAR(10)" } : c)) })),
      3,
      postgres,
    );
    same(both.map((e) => e.kind).sort(), ["manual", "refused"]);
  },
);

proves(
  ["0011-sql-lifecycle FR-007"],
  "a plan has the ordered steps with the hash of the state each needs and leaves, an identifier made of its content, and none between equal states",
  () => {
    const p = planOf(undefined, 2);
    same(p.from, emptyHash(postgres));
    same(p.to, stateHash(snap(2)));
    same(p.steps[0]?.from, p.from);
    same(p.steps[p.steps.length - 1]?.to, p.to);
    p.steps.forEach((s, i) => same(s.from, i === 0 ? p.from : p.steps[i - 1]?.to));
    assert(p.steps.every((s) => /^[0-9a-f]{64}$/.test(s.id) && s.of.length > 0 && s.up.length > 0 && s.name !== ""));
    same(new Set(p.steps.map((s) => s.id)).size, p.steps.length);
    same(
      planOf(undefined, 2).steps.map((s) => s.id),
      p.steps.map((s) => s.id),
      "the same plan every time",
    );
    same(planOf(snap(2), 2).steps.length, 0);
    same(planOf(snap(2), 2).from, stateHash(snap(2)));
    // the tables are created in an order the foreign keys allow
    const order = planOf(undefined, 1).steps.map((s) => s.name);
    assert(
      order.indexOf("create table author") < order.indexOf("create table book") &&
        order.indexOf("create table genre") < order.indexOf("create table book"),
    );
    // the order of the phases
    const v3 = planOf(snap(2), 3, postgres, { allow: { destructive: true } });
    same(
      v3.steps.map((s) => s.kind),
      ["renameColumn", "dropColumn"],
    );
    const down = planOf(snap(1), 2).steps.flatMap((s) => s.down ?? []);
    assert(
      down.some((s) => s.sql.startsWith("ALTER TABLE") && s.sql.includes("DROP COLUMN")) &&
        down.some((s) => s.sql.startsWith("DROP TABLE")),
    );
    const wrongDialect = plan(snap(1, sqlite), libraryAt(2), { dialect: postgres });
    assert(wrongDialect.kind === "err" && wrongDialect.error[0]?.kind === "dialect");
  },
);

proves(
  ["0011-sql-lifecycle FR-009"],
  "what extensions add is repeatable, with a key and the hash of its text, and only what changed is due",
  () => {
    const mk = (v: 1 | 2): Plan => {
      const r = plan(undefined, libraryAt(v), { dialect: postgres, sources: documentationSources() });
      if (r.kind === "err") throw new Error(JSON.stringify(r.error));
      return r.value;
    };
    const one = mk(1);
    assert(
      one.repeatable.length > 0 && one.repeatable.every((r) => r.key !== "" && /^[0-9a-f]{64}$/.test(r.hash) && r.statements.length >= 1),
    );
    same(new Set(one.repeatable.map((r) => r.key)).size, one.repeatable.length);
    const applied = new Map(one.repeatable.map((r) => [r.key, r.hash]));
    same(dueRepeatables(one.repeatable, applied).length, 0);
    const two = mk(2);
    const due = dueRepeatables(two.repeatable, applied);
    assert(due.length > 0 && due.length < two.repeatable.length + 1);
    assert(dueRepeatables(two.repeatable, new Map()).length === two.repeatable.length);
    // what is made from an element a step changed is due again, whatever its text
    const first = one.repeatable.find((r) => r.of.length > 0);
    assert(first !== undefined);
    if (first !== undefined) {
      same(
        dueRepeatables(one.repeatable, applied, new Set(first.of.slice(0, 1)))
          .map((r) => r.key)
          .includes(first.key),
        true,
      );
      same(dueRepeatables(one.repeatable, applied, new Set(["table:nowhere"])).length, 0);
    }
    // the core's own tables are steps and never repeatable
    assert(two.repeatable.every((r) => r.statements.every((s) => s.origin === "extension" || s.group === "setup")));
  },
);

proves(["0011-sql-lifecycle FR-010"], "a ledger whose entry was changed, taken out, put in or moved fails its chain", () => {
  let ledger: LedgerEntry[] = [];
  for (const k of ["a", "b", "c", "d"])
    ledger = [
      ...ledger,
      nextEntry(ledger, {
        kind: "step",
        key: k,
        name: `step ${k}`,
        from: "f",
        to: "t",
        hash: k,
        appliedAt: "2026-01-01",
        appliedBy: "test",
      }),
    ];
  same(verifyChain(ledger), undefined);
  same(ledger[0]?.seq, 1);
  assert(ledger[0]?.chain !== GENESIS);
  same(verifyChain(ledger.map((e, i) => (i === 1 ? { ...e, name: "changed" } : e))), { seq: 2, why: "chain" });
  same(verifyChain(ledger.filter((_, i) => i !== 1)), { seq: 3, why: "seq" });
  same(verifyChain([ledger[1]!, ledger[0]!, ...ledger.slice(2)]), { seq: 2, why: "seq" });
  const inserted = [
    ...ledger.slice(0, 2),
    nextEntry(ledger.slice(0, 2), { kind: "step", key: "x", name: "x", from: "", to: "", hash: "x", appliedAt: "", appliedBy: "" }),
    ...ledger.slice(2),
  ];
  assert(verifyChain(inserted)?.seq === 3 || verifyChain(inserted)?.seq === 4);
  same(verifyChain([]), undefined);
});

proves(
  ["0011-sql-lifecycle FR-011"],
  "a plan runs on a real engine step by step with the ledger, does nothing run again, refuses another base, rolls a failed step back, and finds a ledger that was touched",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const d = driverOf(e);
        const empty = emptyHash(dialect);
        const p1 = planOf(undefined, 1, dialect);
        const a = await execute(p1, d, dialect, { empty, by: "test", now: () => "2026-01-01T00:00:00Z" });
        assert(
          a.kind === "ok" && a.value.steps.length === p1.steps.length && a.value.ledger.length === p1.steps.length,
          `${name}: applied`,
        );
        const again = await execute(p1, d, dialect, { empty });
        assert(again.kind === "ok" && again.value.steps.length === 0, `${name}: run again does nothing`);
        // a plan made for another base
        const p3 = planOf(snap(2, dialect), 3, dialect, { allow: { destructive: true } });
        const wrong = await execute(p3, d, dialect, { empty });
        assert(wrong.kind === "err" && wrong.error[0]?.kind === "base", `${name}: another base is refused`);
        // a step that fails leaves nothing behind
        const bad: Plan = {
          ...p1,
          from: p1.to,
          to: "f".repeat(64),
          steps: [
            {
              ...p1.steps[0]!,
              id: "9".repeat(64),
              name: "make a table and fail",
              from: p1.to,
              to: "f".repeat(64),
              up: [
                { group: "table", origin: "core", sql: 'CREATE TABLE "half" ("id" INTEGER);', of: [] },
                { group: "table", origin: "core", sql: 'INSERT INTO "nowhere" VALUES (1);', of: [] },
              ],
            },
          ],
          repeatable: [],
        };
        const failed = await execute(bad, d, dialect, { empty });
        assert(failed.kind === "err" && failed.error[0]?.kind === "step", `${name}: the step failed`);
        assert(!(await structure(e)).tables["half"], `${name}: its first statement was rolled back`);
        same((await readLedger(d, dialect)).length, p1.steps.length, `${name}: and its ledger entry was not made`);
        // a ledger that was touched
        await e.run(`UPDATE "lifecycle_ledger" SET "name" = 'something else' WHERE "seq" = 1`);
        const touched = await execute(p1, d, dialect, { empty });
        assert(
          touched.kind === "err" && touched.error[0]?.kind === "ledger" && touched.error[0].broken.seq === 1,
          `${name}: the chain is broken`,
        );
      });
    }
  },
);

proves(
  ["0011-sql-lifecycle FR-012"],
  "the steps of a plan from empty and then from each version to the next leave the database that bind makes for the last version, with one ledger entry for each step",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const d = driverOf(e);
        const empty = emptyHash(dialect);
        let from: State | undefined;
        let steps = 0;
        for (const v of [1, 2, 3] as const) {
          const p = planOf(from, v, dialect, { allow: { destructive: true } });
          const r = await execute(p, d, dialect, { empty });
          assert(r.kind === "ok", `${name} v${v}: ${JSON.stringify(r)}`);
          steps += p.steps.length;
          from = snap(v, dialect);
        }
        const ledger = await readLedger(d, dialect);
        same(ledger.length, steps);
        same(verifyChain(ledger), undefined);
        same(ledger[ledger.length - 1]?.to, stateHash(snap(3, dialect)));
        await withEngine(name, async (fresh) => {
          const b = bind(libraryAt(3), { dialect });
          assert(b.kind === "ok");
          if (b.kind === "ok") await load(fresh, b.value);
          same(shape(await structure(e)), shape(await structure(fresh)), `${name}: the same tables, columns, keys and indexes`);
        });
        const codes = await e.rows(`SELECT "code" FROM "genre" ORDER BY "code"`);
        same(
          codes.map((r) => r["code"]),
          ["drama", "fiction", "poetry"],
          `${name}: the reference rows`,
        );
      });
    }
  },
);

proves(
  ["0011-sql-lifecycle FR-012", "0011-sql-lifecycle FR-009", "0011-sql-lifecycle FR-011"],
  "what extensions add is applied once and again only when its text changes",
  async () => {
    for (const { name, dialect } of DIALECTS) {
      await withEngine(name, async (e) => {
        const d = driverOf(e);
        const empty = emptyHash(dialect);
        const mk = (from: State | undefined, v: 1 | 2): Plan => {
          const r = plan(from, libraryAt(v), { dialect, sources: documentationSources() });
          if (r.kind === "err") throw new Error(JSON.stringify(r.error));
          return r.value;
        };
        const p1 = mk(undefined, 1);
        const a = await execute(p1, d, dialect, { empty });
        assert(a.kind === "ok" && a.value.repeatable.length === p1.repeatable.length && p1.repeatable.length > 0, `${name}: applied`);
        const b = await execute(p1, d, dialect, { empty });
        assert(b.kind === "ok" && b.value.steps.length === 0 && b.value.repeatable.length === 0, `${name}: nothing again`);
        const p2 = mk(snap(1, dialect), 2);
        const c = await execute(p2, d, dialect, { empty });
        assert(
          c.kind === "ok" &&
            c.value.steps.length === p2.steps.length &&
            c.value.repeatable.length > 0 &&
            c.value.repeatable.length <= p2.repeatable.length,
          `${name}: only what changed`,
        );
      });
    }
  },
);

proves(
  ["0011-sql-lifecycle FR-014"],
  "the lifecycle vocabulary says what an element was called and when it was made, and lint finds a renamedFrom that is not a name or is the element's own",
  () => {
    assert(defaultVocabularies.some((v) => v.id === "lifecycle"));
    const mk = (old: string) =>
      domain("d", {
        definition: "d",
        concepts: [
          concept("thing", {
            definition: "t",
            attributes: {
              id: attribute(identifier(), { definition: "i" }),
              label: attribute(text(), {
                definition: "l",
                annotations: [annotate(vocabularies.lifecycle.renamedFrom, old), annotate(vocabularies.lifecycle.since, "2026.2")],
              }),
            },
            identifiedBy: ["id"],
          }),
        ],
      });
    const ok = mk("name");
    assert(ok.kind === "ok");
    if (ok.kind === "ok") same(lint(ok.value, defaultVocabularies).filter((f) => f.rule.startsWith("lifecycle/")).length, 0);
    for (const bad of ["Not A Name", "label"]) {
      const d = mk(bad);
      assert(d.kind === "ok");
      if (d.kind === "ok") same(lint(d.value, defaultVocabularies).filter((f) => f.rule === "lifecycle/renamed-from-name").length, 1, bad);
    }
    const s = projected(
      (() => {
        const d = mk("name");
        if (d.kind === "err") throw new Error("d");
        return d.value;
      })(),
    ).schema;
    assert(s.tables.some((t) => t.columns.some((c) => c.name.join(".") === "label")));
  },
);
