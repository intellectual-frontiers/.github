// Spec: 0052-sql-quality FR-001, FR-002, FR-003, FR-004
/**
 * SQL data quality, SQL-DQ (commons data 0052-sql-quality): data tests as typed values, an algebra of the data tests of dbt. A test is SQL that gives the rows that are wrong; it passes where there are none.
 * A generic test is a value that is made once, with the type of its arguments and the level it is written at (a column or a model), and used any number of times; a singular test is SQL of one's own. The
 * configuration of a use (severity, `warnIf` and `errorIf` thresholds, `where`, `limit`, `failCalc`, stored failures, tags, meta, name, enabled) is a typed record, and what a run finds is a sum of outcomes.
 *
 * @remarks
 * Pure: a test makes SQL for a dialect and runs nothing; `run.ts` runs it through a driver. It is a unit of its own because it is used by the project command, by models and by a person's own checks
 * alike, and because nothing in it is about the shape of a schema.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { type Dialect, qualified } from "@intellectual-frontiers/data/sql/physical";

/** A table or a view by the name it has in the database. */
export interface Relation {
  readonly name: string;
  readonly schema?: string;
}

/** How many failing rows (or the number `failCalc` gives) make a test warn or fail: `{ op: ">", n: 10 }` is dbt's `> 10`. */
export interface Threshold {
  readonly op: ">" | ">=" | "=" | "!=" | "<" | "<=";
  readonly n: number;
}

/** What a use of a test is told: dbt's configs of a data test. */
export interface TestConfig {
  /** `error` where it is not said. */
  readonly severity?: "error" | "warn";
  /** Where a test is a warning: `!= 0` where it is not said. */
  readonly warnIf?: Threshold;
  /** Where a test is a failure, for severity `error`: `!= 0` where it is not said. */
  readonly errorIf?: Threshold;
  /** A condition that the rows tested must meet, written in the dialect. */
  readonly where?: string;
  /** The most failing rows that are looked at, and stored. */
  readonly limit?: number;
  /** The expression that is compared with the thresholds: `count(*)` where it is not said. */
  readonly failCalc?: string;
  readonly storeFailures?: boolean;
  readonly storeFailuresAs?: "table" | "view";
  /** The schema the failures are stored in, and the name they are stored under (the name of the test where it is not said). */
  readonly schema?: string;
  readonly alias?: string;
  readonly tags?: readonly string[];
  readonly meta?: { readonly [key: string]: string | number | boolean };
  /** `false` takes the test out of a run: it is reported as skipped. */
  readonly enabled?: boolean;
  /** The name of the test, where the one that is made from its parts is not wanted. */
  readonly name?: string;
}

/** What a generic test is told of the place it is used. */
export interface Context<L extends Level> {
  readonly dialect: Dialect;
  /** The relation, qualified and quoted, that is not filtered. */
  readonly relation: string;
  /** What is tested, as `FROM` takes it, named `dq_t`: the relation, or the relation filtered by `where`. */
  readonly from: string;
  /** The column, quoted; on a model-level test there is none. */
  readonly column: L extends "column" ? string : undefined;
  /** The same of a relation named by an argument. */
  qualify(r: Relation): string;
}

/** Where a generic test is written: on a column, or on a whole model. */
export type Level = "column" | "model";

/** A generic test: a name, a level, the type of its arguments and the SQL of the rows that are wrong. */
export interface GenericTest<A, L extends Level> {
  readonly kind: "generic";
  readonly name: string;
  readonly level: L;
  readonly failing: (c: Context<L>, args: A) => string;
}

/** A use of a generic test, with its arguments and its configuration, still without a place. */
export interface Use<L extends Level> {
  readonly test: GenericTest<never, L>;
  readonly args: unknown;
  readonly config: TestConfig;
}

/** Makes a generic test of the level of a column. */
export const columnTest = <A = void>(name: string, failing: (c: Context<"column">, args: A) => string): GenericTest<A, "column"> => ({ kind: "generic", name, level: "column", failing });
/** Makes a generic test of the level of a model. */
export const modelTest = <A = void>(name: string, failing: (c: Context<"model">, args: A) => string): GenericTest<A, "model"> => ({ kind: "generic", name, level: "model", failing });

/**
 * Uses a generic test: its arguments (none to give where it takes none) and, last, its configuration.
 *
 * @example
 * ```ts
 * use(acceptedValues, { values: ["a", "b"] }, { severity: "warn", where: "created > '2026-01-01'" });
 * use(notNull);
 * ```
 */
export function use<A, L extends Level>(test: GenericTest<A, L>, ...rest: [A] extends [void] ? [args?: undefined, config?: TestConfig] : [args: A, config?: TestConfig]): Use<L> {
  return { test: test as unknown as GenericTest<never, L>, args: rest[0], config: rest[1] ?? {} };
}

/** A test that is placed: what it tests, and the SQL of the rows that are wrong. */
export type DqTest =
  | { readonly kind: "generic"; readonly name: string; readonly test: string; readonly relation: Relation; readonly column?: string; readonly args: unknown; readonly config: TestConfig; readonly failing: (d: Dialect) => string }
  | { readonly kind: "singular"; readonly name: string; readonly relation?: Relation; readonly config: TestConfig; readonly failing: (d: Dialect) => string };

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** The name a test has where none is given: the test, the relation, the column and the arguments, as dbt makes it (`accepted_values_orders_status__a__b`). */
export function testName(test: string, relation: Relation, column: string | undefined, args: unknown): string {
  const flat = (v: unknown): string[] =>
    v === undefined || v === null ? [] : Array.isArray(v) ? v.flatMap(flat) : typeof v === "object" ? Object.values(v as object).flatMap((x) => (typeof x === "string" || typeof x === "number" || Array.isArray(x) ? flat(x) : [])) : [String(v)];
  const parts = flat(args).map(slug).filter((p) => p !== "");
  const head = [test, relation.name, column].filter((p): p is string => p !== undefined).map(slug).join("_");
  const name = parts.length === 0 ? head : `${head}__${parts.join("__")}`;
  return name.length <= 63 ? name : `${name.slice(0, 54)}_${hash(name)}`;
}
function hash(s: string): string {
  let h = 5381;
  for (const c of s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

function place<L extends Level>(u: Use<L>, relation: Relation, column: string | undefined): DqTest {
  const name = u.config.name ?? testName(u.test.name, relation, column, u.args);
  return {
    kind: "generic",
    name,
    test: u.test.name,
    relation,
    ...(column === undefined ? {} : { column }),
    args: u.args,
    config: u.config,
    failing: (dialect) => {
      const rel = qualified(dialect, relation.schema, relation.name);
      const from = u.config.where === undefined ? `${rel} AS dq_t` : `(SELECT * FROM ${rel} WHERE ${u.config.where}) AS dq_t`;
      const ctx = { dialect, relation: rel, from, column: column === undefined ? undefined : dialect.quote(column), qualify: (r: Relation) => qualified(dialect, r.schema, r.name) };
      return (u.test.failing as (c: unknown, a: unknown) => string)(ctx, u.args);
    },
  };
}

/** The tests of one relation, written the way a project of dbt writes them: under a column, or under the model. */
export interface OnRelation {
  /** Tests of a column. */
  column(name: string, ...uses: readonly Use<"column">[]): readonly DqTest[];
  /** Tests of the model. */
  model(...uses: readonly Use<"model">[]): readonly DqTest[];
}

/** Starts the tests of a relation; a generic test of a column cannot be put on a model, nor a test of a model on a column: it does not compile. */
export function on(relation: Relation | string): OnRelation {
  const r: Relation = typeof relation === "string" ? { name: relation } : relation;
  return {
    column: (name, ...uses) => uses.map((u) => place(u, r, name)),
    model: (...uses) => uses.map((u) => place(u, r, undefined)),
  };
}

/** A singular test: SQL of one's own that gives the rows that are wrong. */
export function singular(name: string, sql: string, config: TestConfig = {}, relation?: Relation): DqTest {
  return { kind: "singular", name: config.name ?? name, ...(relation === undefined ? {} : { relation }), config, failing: () => sql.trim().replace(/;+\s*$/, "") };
}

/** Whether a number meets a threshold. */
export const meets = (n: number, t: Threshold): boolean => {
  switch (t.op) {
    case ">":
      return n > t.n;
    case ">=":
      return n >= t.n;
    case "=":
      return n === t.n;
    case "!=":
      return n !== t.n;
    case "<":
      return n < t.n;
    case "<=":
      return n <= t.n;
    default:
      return absurd(t.op);
  }
};

/**
 * The configuration of a test that expects a number of failing rows, exactly: it fails where the count is any other, and is never a warning. `exactly(0)` is the ordinary test; `exactly(3)` is the book's seeded
 * test (three rows are wrong and the test says so), which fails both where one of them is missed and where a new one appears.
 *
 * @param n - the number of failing rows (or the value of `failCalc`) that is expected
 * @param config - the rest of the configuration
 */
export const exactly = (n: number, config: TestConfig = {}): TestConfig => ({ ...config, severity: "error", errorIf: { op: "!=", n }, warnIf: { op: "<", n: 0 } });

/** What a run finds of one test. */
export type Status = "pass" | "warn" | "fail" | "error" | "skipped";

/**
 * The status that a number of failures gives, as dbt determines it: with severity `error`, a number that meets `errorIf` is a failure and, below it, one that meets `warnIf` is a warning; with
 * severity `warn`, a number that meets either threshold is a warning. Both thresholds are `!= 0` where they are not said.
 */
export function judge(failures: number, config: TestConfig): "pass" | "warn" | "fail" {
  const warnIf = config.warnIf ?? { op: "!=", n: 0 };
  const errorIf = config.errorIf ?? { op: "!=", n: 0 };
  if ((config.severity ?? "error") === "warn") return meets(failures, warnIf) || meets(failures, errorIf) ? "warn" : "pass";
  if (meets(failures, errorIf)) return "fail";
  return meets(failures, warnIf) ? "warn" : "pass";
}

/** The tests of a selection: by tag, relation, level or kind of test, by name, and what is left out. */
export interface Selection {
  readonly tags?: readonly string[];
  readonly relations?: readonly string[];
  readonly tests?: readonly string[];
  readonly kind?: "generic" | "singular";
  readonly exclude?: Selection;
}

/** The tests that a selection picks: a test is picked when it meets every part the selection has (a tag that it has, a relation, a name, a kind) and is not picked by `exclude`. */
export function select(tests: readonly DqTest[], s: Selection): readonly DqTest[] {
  const picks = (t: DqTest, sel: Selection): boolean =>
    (sel.tags === undefined || sel.tags.some((g) => t.config.tags?.includes(g) === true)) &&
    (sel.relations === undefined || (t.relation !== undefined && sel.relations.includes(t.relation.name))) &&
    (sel.tests === undefined || sel.tests.includes(t.name) || (t.kind === "generic" && sel.tests.includes(t.test))) &&
    (sel.kind === undefined || t.kind === sel.kind);
  return tests.filter((t) => picks(t, s) && (s.exclude === undefined || !picks(t, s.exclude)));
}
