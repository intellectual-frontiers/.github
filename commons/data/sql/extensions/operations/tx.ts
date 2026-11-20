// Spec: 0031-operations FR-003, FR-004
/**
 * The transaction an operation is given (commons data 0031-operations): typed row operations by the words of table and column names, written by the naming layer for the dialect, that note what
 * was written. Values enter only as literals the dialect writes.
 *
 * @module
 */
import { words } from "@intellectual-frontiers/data/governance";
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import type { LogicalSchema, Table } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, type Literal, type Naming, writeCode, writeNames } from "@intellectual-frontiers/data/sql/physical";

export type Cell = string | number | boolean | null;
/** A row as an operation reads and writes it: column names to values. */
export type Row = Readonly<Record<string, unknown>>;
/** A condition on a column: equal to a value (null meaning is null), or compared. */
export type Test = Cell | { readonly gt?: Cell; readonly ge?: Cell; readonly lt?: Cell; readonly le?: Cell; readonly ne?: Cell };
/** The conditions that pick rows in an operation: a test for each column named. */
export type Where = Readonly<Record<string, Test>>;

/** What audit sinks are given: one thing that was done, or tried. */
export interface AuditEvent {
  readonly action: string;
  readonly outcome: "success" | "failure" | "denied";
  readonly actorKind: "user" | "machine" | "device" | "agent" | "system" | "impersonator";
  readonly actor?: string;
  readonly tenant?: string;
  readonly targetConcept?: string;
  readonly targetKey?: string;
  readonly sessionKey?: string;
  readonly reason?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

/** Writes the audit trail; the identity model's is in `sql/extensions/operations/identity`. */
export interface AuditSink {
  /** The table the trail is kept in, by the words of its name: a write to it is not a write outside a contract. */
  readonly table: string;
  record(tx: Tx, event: AuditEvent, context: Context): Promise<string>;
}

/** What an operation is given besides its input: time, identifiers, tokens, and the checks that need a secret. */
export interface Context {
  now(): string;
  newId(): string;
  /** A secret to give to a person once. */
  newToken(): string;
  /** What is stored of a token. */
  hashToken(token: string): string;
  /** What is stored of an identifier that may be an unknown user's. */
  hashIdentifier(identifier: string): string;
  /** Whether a password is the one a hash was made from; the algorithm is the application's. */
  verifyPassword(hash: string, password: string): Promise<boolean>;
  /** Who is acting. */
  readonly caller?: string;
}

/** The names a raw query asks for. */
export interface TxRefs {
  table(name: string): string;
  /** A column of a table, written and quoted, by the words of its name or the key of the relationship it holds. */
  col(table: string, key: string): string;
  lit(value: Cell): string;
  /** A code of a code list as the database holds it, written by the naming layer from the words of the code. */
  code(value: string): string;
}

/** A transaction. */
export interface Tx extends TxRefs {
  insert(table: string, values: Readonly<Record<string, Cell>>): Promise<void>;
  /** The number of rows changed. */
  update(table: string, set: Readonly<Record<string, Cell>>, where: Where): Promise<number>;
  /** The number of rows removed. */
  remove(table: string, where: Where): Promise<number>;
  /** Rows, each keyed by the columns asked for (as asked), or by every column in lower camel case. */
  select(table: string, options?: { readonly where?: Where; readonly columns?: readonly string[]; readonly orderBy?: readonly (readonly [string, "asc" | "desc"])[]; readonly limit?: number }): Promise<Row[]>;
  count(table: string, where?: Where): Promise<number>;
  /** A read written by the caller from the names, whose columns are the aliases it gives. */
  query(build: (refs: TxRefs) => string): Promise<Row[]>;
  /** Records an event in the audit trail, in this transaction; gives its hash. */
  audit(event: AuditEvent): Promise<string>;
}

/** What the runner keeps of a transaction. */
export interface Tracked {
  readonly tx: Tx;
  /** The tables an operation tried to write, by the words of their names: what its contract is held to. */
  writes(): ReadonlySet<string>;
  /** The tables in which a row was changed: what must be recorded in the audit trail. */
  changed(): ReadonlySet<string>;
  /** The actions recorded in the audit trail. */
  actions(): readonly string[];
}

const camel = (w: readonly string[]): string => w.map((x, i) => (i === 0 ? x : x.charAt(0).toUpperCase() + x.slice(1))).join("");
const plain = (r: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]));

/** What names a schema as written, for transactions. */
export interface Resolver {
  readonly refs: TxRefs;
  tableOf(name: string): Table;
  /** The column of a table for a key, as logical and as written. */
  column(table: Table, key: string): { readonly written: string; readonly key: string };
  readonly written: ReturnType<typeof writeNames>;
  readonly naming: Naming;
}

/**
 * The names of a schema for transactions.
 *
 * @param schema - the logical schema
 * @param dialect - the dialect
 * @param naming - the case styles
 * @param inSchema - the schema the tables are in
 * @returns the resolver
 */
export function resolver(schema: LogicalSchema, dialect: Dialect, naming: Naming, inSchema?: string): Resolver {
  const names = writeNames(schema, dialect, naming, [], inSchema);
  const tableOf = (name: string): Table => {
    const t = schema.tables.find((x) => x.name.join(".") === words(name).join("."));
    if (t === undefined) throw new Error(`the schema has no table ${name}`);
    return t;
  };
  const column = (t: Table, key: string): { written: string; key: string } => {
    const w = words(key);
    const exact = t.columns.find((c) => c.name.join(".") === w.join("."));
    if (exact !== undefined) return { written: names.column(exact.id) ?? "", key: camel(exact.name) };
    // the column that holds a relationship, by the key of the relationship
    const holders = t.foreignKeys.flatMap((f) => (f.columns.length === 1 ? f.columns : [])).filter((c) => c.slice(0, w.length).join(".") === w.join("."));
    const col = holders.length === 1 ? t.columns.find((c) => c.name.join(".") === (holders[0] as readonly string[]).join(".")) : undefined;
    if (col === undefined) throw new Error(`${t.name.join(" ")} has no column ${key}${holders.length > 1 ? ` (${holders.length} hold it)` : ""}`);
    return { written: names.column(col.id) ?? "", key: camel(col.name) };
  };
  const q = (n: string): string => dialect.quote(n);
  const refs: TxRefs = {
    table: (name) => names.ref(tableOf(name).id),
    col: (table, key) => q(column(tableOf(table), key).written),
    lit: (v) => dialect.literal(v as Literal),
    code: (v) => writeCode(naming, v),
  };
  return { refs, tableOf, column, written: names, naming };
}

/**
 * A transaction on a driver.
 *
 * @param driver - the database, in a transaction that the caller begins and ends
 * @param r - the names
 * @param dialect - the dialect
 * @param kind - whether the operation may write
 * @param sink - where the audit trail is written
 * @param context - what an operation is given
 * @returns the transaction and what it keeps
 */
export function track(driver: Driver, r: Resolver, dialect: Dialect, kind: "command" | "query", sink: AuditSink | undefined, context: Context): Tracked {
  const written = new Set<string>();
  const changed = new Set<string>();
  const actions: string[] = [];
  const q = (n: string): string => dialect.quote(n);
  const lit = (v: Cell): string => dialect.literal(v as Literal);
  const mayWrite = (table: string): void => {
    if (kind === "query") throw new Error(`a query may not write ${table}`);
    written.add(words(table).join("."));
  };
  const writable = (table: string): void => {
    mayWrite(table);
    changed.add(words(table).join("."));
  };
  const cond = (t: Table, where: Where): string => {
    const parts = Object.entries(where).map(([k, test]) => {
      const c = q(r.column(t, k).written);
      if (test === null) return `${c} IS NULL`;
      if (typeof test !== "object") return `${c} = ${lit(test)}`;
      const ops: string[] = [];
      for (const [op, v] of Object.entries(test) as [string, Cell][]) {
        const sym = { gt: ">", ge: ">=", lt: "<", le: "<=", ne: "<>" }[op];
        if (sym === undefined) throw new Error(`no comparison ${op}`);
        ops.push(v === null ? `${c} IS ${op === "ne" ? "NOT " : ""}NULL` : `${c} ${sym} ${lit(v)}`);
      }
      return ops.join(" AND ");
    });
    return parts.length === 0 ? "TRUE" : parts.join(" AND ");
  };
  const tx: Tx = {
    ...r.refs,
    async insert(table, values) {
      writable(table);
      const t = r.tableOf(table);
      const cols = Object.keys(values).map((k) => r.column(t, k).written);
      await driver.exec(`INSERT INTO ${r.refs.table(table)} (${cols.map(q).join(", ")}) VALUES (${Object.values(values).map(lit).join(", ")});`);
    },
    async update(table, set, where) {
      mayWrite(table);
      const t = r.tableOf(table);
      const sets = Object.entries(set).map(([k, v]) => `${q(r.column(t, k).written)} = ${lit(v)}`);
      const n = (await driver.query(`UPDATE ${r.refs.table(table)} SET ${sets.join(", ")} WHERE ${cond(t, where)} RETURNING 1 AS n;`)).length;
      if (n > 0) changed.add(words(table).join("."));
      return n;
    },
    async remove(table, where) {
      mayWrite(table);
      const t = r.tableOf(table);
      const n = (await driver.query(`DELETE FROM ${r.refs.table(table)} WHERE ${cond(t, where)} RETURNING 1 AS n;`)).length;
      if (n > 0) changed.add(words(table).join("."));
      return n;
    },
    async select(table, options = {}) {
      const t = r.tableOf(table);
      const asked = options.columns?.map((k) => ({ asked: k, written: r.column(t, k).written }));
      const all = t.columns.map((c) => ({ asked: camel(c.name), written: r.column(t, c.name.join(".")).written }));
      const cols = asked ?? all;
      const order = (options.orderBy ?? []).map(([k, d]) => `${q(r.column(t, k).written)} ${d === "desc" ? "DESC" : "ASC"}`);
      const sql = `SELECT ${cols.map((c) => `${q(c.written)} AS ${q(c.asked)}`).join(", ")} FROM ${r.refs.table(table)} WHERE ${cond(t, options.where ?? {})}${order.length > 0 ? ` ORDER BY ${order.join(", ")}` : ""}${options.limit === undefined ? "" : ` LIMIT ${options.limit}`};`;
      return (await driver.query(sql)).map(plain);
    },
    async count(table, where = {}) {
      return Number((await driver.query(`SELECT COUNT(*) AS n FROM ${r.refs.table(table)} WHERE ${cond(r.tableOf(table), where)};`))[0]?.["n"] ?? 0);
    },
    async query(build) {
      return (await driver.query(build(r.refs))).map(plain);
    },
    async audit(event) {
      if (sink === undefined) throw new Error("no audit trail is given");
      actions.push(event.action);
      return sink.record(tx, event, context);
    },
  };
  return { tx, writes: () => written, changed: () => changed, actions: () => actions };
}
