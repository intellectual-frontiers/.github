// Spec: 0011-sql-lifecycle FR-004, FR-005, FR-013
/**
 * Changes (commons data 0011-sql-lifecycle FR-004, FR-005, FR-013): what differs between two states, found by the identity of each element (its words, and for a constraint what it is) and not by
 * its written name, so that a change of case style is a rename and a change of what an element is called in governance is a rename where governance says so. `applyChange` is the state a change
 * leads to; applying the changes of `diff(a, b)` to `a` reaches `b`, which is checked by the plan and by property tests.
 *
 * @module
 */
import type { State, StateColumn, StateConstraint, StateRow, StateTable } from "./state.ts";

/** What a change is. */
export type Change =
  | {
      readonly kind: "renameTable";
      readonly key: string;
      readonly fromWords: readonly string[];
      readonly toWords: readonly string[];
      readonly fromName: string;
      readonly toName: string;
    }
  | { readonly kind: "renameColumn"; readonly key: string; readonly table: TableRef; readonly from: StateColumn; readonly to: StateColumn }
  | { readonly kind: "dropConstraint"; readonly key: string; readonly table: TableRef; readonly constraint: StateConstraint }
  | {
      readonly kind: "renameConstraint";
      readonly key: string;
      readonly table: TableRef;
      readonly from: StateConstraint;
      readonly to: StateConstraint;
    }
  | { readonly kind: "addColumn"; readonly key: string; readonly table: TableRef; readonly column: StateColumn }
  | { readonly kind: "dropColumn"; readonly key: string; readonly table: TableRef; readonly column: StateColumn }
  | { readonly kind: "alterType"; readonly key: string; readonly table: TableRef; readonly from: StateColumn; readonly to: StateColumn }
  | { readonly kind: "alterNullable"; readonly key: string; readonly table: TableRef; readonly from: StateColumn; readonly to: StateColumn }
  | { readonly kind: "alterDefault"; readonly key: string; readonly table: TableRef; readonly from: StateColumn; readonly to: StateColumn }
  | {
      readonly kind: "alterPrimaryKey";
      readonly key: string;
      readonly table: TableRef;
      readonly from: readonly string[];
      readonly to: readonly string[];
    }
  | {
      readonly kind: "alterClause";
      readonly key: string;
      readonly table: TableRef;
      readonly from: string | undefined;
      readonly to: string | undefined;
    }
  | { readonly kind: "createTable"; readonly key: string; readonly table: StateTable }
  | { readonly kind: "addConstraint"; readonly key: string; readonly table: TableRef; readonly constraint: StateConstraint }
  | {
      readonly kind: "upsertRows";
      readonly key: string;
      readonly table: TableRef;
      readonly rows: readonly StateRow[];
      readonly before: readonly StateRow[];
    }
  | { readonly kind: "removeRows"; readonly key: string; readonly table: TableRef; readonly rows: readonly StateRow[] }
  | { readonly kind: "dropTable"; readonly key: string; readonly table: StateTable };

/** The kinds of change. */
export type ChangeKind = Change["kind"];

/** A table as a change names it: its words and its written name at the moment the change is made. */
export interface TableRef {
  readonly words: readonly string[];
  readonly name: string;
}

const same = <T>(a: readonly T[], b: readonly T[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
const w = (x: readonly string[]): string => x.join(".");
const ref = (t: StateTable): TableRef => ({ words: t.words, name: t.name });

/**
 * What differs between two states.
 *
 * @param from - the state a database is in; none for an empty database
 * @param to - the state wanted
 * @returns the changes, in the order they are to be made: renames, drops of constraints, changes of columns, new tables, new constraints, rows, drops of tables
 */
export function diff(from: State | undefined, to: State): readonly Change[] {
  const old = from?.tables ?? [];
  const renames: Change[] = [];
  const dropC: Change[] = [];
  const columnsC: Change[] = [];
  const created: Change[] = [];
  const addC: Change[] = [];
  const rowsC: Change[] = [];
  const dropped: Change[] = [];

  // match tables by words, then by what governance says they were called
  const matched = new Map<StateTable, StateTable>();
  const taken = new Set<StateTable>();
  for (const t of to.tables) {
    const m = old.find((o) => !taken.has(o) && same(o.words, t.words));
    if (m !== undefined) {
      matched.set(t, m);
      taken.add(m);
    }
  }
  for (const t of to.tables) {
    if (matched.has(t) || t.renamedFrom === undefined) continue;
    const m = old.find((o) => !taken.has(o) && same(o.words, t.renamedFrom ?? []));
    if (m !== undefined) {
      matched.set(t, m);
      taken.add(m);
    }
  }
  for (const t of to.tables) {
    const o = matched.get(t);
    if (o === undefined) {
      created.push({ kind: "createTable", key: `createTable:${w(t.words)}`, table: t });
      continue;
    }
    if (o.name !== t.name || !same(o.words, t.words))
      renames.push({
        kind: "renameTable",
        key: `renameTable:${w(o.words)}>${w(t.words)}`,
        fromWords: o.words,
        toWords: t.words,
        fromName: o.name,
        toName: t.name,
      });
    const tr = ref(t);

    // columns: by words, then by what governance says they were called
    const cm = new Map<StateColumn, StateColumn>();
    const ct = new Set<StateColumn>();
    for (const c of t.columns) {
      const m = o.columns.find((x) => !ct.has(x) && same(x.words, c.words));
      if (m !== undefined) {
        cm.set(c, m);
        ct.add(m);
      }
    }
    for (const c of t.columns) {
      if (cm.has(c) || c.renamedFrom === undefined) continue;
      const m = o.columns.find((x) => !ct.has(x) && same(x.words, c.renamedFrom ?? []));
      if (m !== undefined) {
        cm.set(c, m);
        ct.add(m);
      }
    }
    for (const c of t.columns) {
      const m = cm.get(c);
      const base = `${w(t.words)}.${w(c.words)}`;
      if (m === undefined) {
        columnsC.push({ kind: "addColumn", key: `addColumn:${base}`, table: tr, column: c });
        continue;
      }
      if (m.name !== c.name || !same(m.words, c.words))
        renames.push({ kind: "renameColumn", key: `renameColumn:${w(t.words)}.${w(m.words)}>${w(c.words)}`, table: tr, from: m, to: c });
      if (m.type !== c.type) columnsC.push({ kind: "alterType", key: `alterType:${base}`, table: tr, from: m, to: c });
      if (m.nullable !== c.nullable) columnsC.push({ kind: "alterNullable", key: `alterNullable:${base}`, table: tr, from: m, to: c });
      if (m.default !== c.default) columnsC.push({ kind: "alterDefault", key: `alterDefault:${base}`, table: tr, from: m, to: c });
    }
    for (const m of o.columns)
      if (!ct.has(m)) columnsC.push({ kind: "dropColumn", key: `dropColumn:${w(t.words)}.${w(m.words)}`, table: tr, column: m });

    // the primary key and the clause are compared by what they are made of
    const pk = (s: StateTable): string[] => s.primaryKey.map((n) => w(s.columns.find((c) => c.name === n)?.words ?? [n]));
    if (!same(pk(o), pk(t)))
      columnsC.push({ kind: "alterPrimaryKey", key: `alterPrimaryKey:${w(t.words)}`, table: tr, from: o.primaryKey, to: t.primaryKey });
    if (o.clause !== t.clause)
      columnsC.push({ kind: "alterClause", key: `alterClause:${w(t.words)}`, table: tr, from: o.clause, to: t.clause });

    // constraints: by what they are, so that a renamed one is a rename
    const sig = (c: StateConstraint): string => `${c.kind}|${c.signature}`;
    const oc = new Map(o.constraints.map((c) => [sig(c), c]));
    const tc = new Map(t.constraints.map((c) => [sig(c), c]));
    for (const [s, c] of oc) {
      const n = tc.get(s);
      if (n === undefined)
        dropC.push({ kind: "dropConstraint", key: `dropConstraint:${w(t.words)}:${c.kind}:${c.name}`, table: tr, constraint: c });
      else if (n.name !== c.name)
        dropC.push({
          kind: "renameConstraint",
          key: `renameConstraint:${w(t.words)}:${c.kind}:${c.name}>${n.name}`,
          table: tr,
          from: c,
          to: n,
        });
    }
    for (const [s, c] of tc)
      if (!oc.has(s))
        addC.push({ kind: "addConstraint", key: `addConstraint:${w(t.words)}:${c.kind}:${c.name}`, table: tr, constraint: c });

    // the rows of a code table
    const before = new Map(o.rows.map((r) => [r.code, r]));
    const changed = t.rows.filter((r) => {
      const b = before.get(r.code);
      return b === undefined || b.label !== r.label || b.description !== r.description;
    });
    if (changed.length > 0)
      rowsC.push({
        kind: "upsertRows",
        key: `upsertRows:${w(t.words)}`,
        table: tr,
        rows: changed,
        before: changed.flatMap((r) => before.get(r.code) ?? []),
      });
    const keep = new Set(t.rows.map((r) => r.code));
    const gone = o.rows.filter((r) => !keep.has(r.code));
    if (gone.length > 0) rowsC.push({ kind: "removeRows", key: `removeRows:${w(t.words)}`, table: tr, rows: gone });
  }
  for (const o of old) if (!taken.has(o)) dropped.push({ kind: "dropTable", key: `dropTable:${w(o.words)}`, table: o });
  return [...renames, ...dropC, ...columnsC, ...created, ...addC, ...rowsC, ...dropped];
}

const mapTable = (s: State, words: readonly string[], fn: (t: StateTable) => StateTable): State => ({
  ...s,
  tables: s.tables.map((t) => (same(t.words, words) ? fn(t) : t)),
});
const mapColumn = (t: StateTable, words: readonly string[], fn: (c: StateColumn) => StateColumn): StateTable => ({
  ...t,
  columns: t.columns.map((c) => (same(c.words, words) ? fn(c) : c)),
});
const sameConstraint = (a: StateConstraint, b: StateConstraint): boolean => a.kind === b.kind && a.signature === b.signature;

/**
 * The state a change leads to.
 *
 * @param state - the state before
 * @param change - the change
 * @returns the state after
 */
export function applyChange(state: State, change: Change): State {
  switch (change.kind) {
    case "renameTable":
      return mapTable(state, change.fromWords, (t) => ({ ...t, words: change.toWords, name: change.toName }));
    case "renameColumn":
      return mapTable(state, change.table.words, (t) =>
        mapColumn(t, change.from.words, (c) => ({ ...c, words: change.to.words, name: change.to.name })),
      );
    case "dropConstraint":
      return mapTable(state, change.table.words, (t) => ({
        ...t,
        constraints: t.constraints.filter((c) => !sameConstraint(c, change.constraint)),
      }));
    case "renameConstraint":
      return mapTable(state, change.table.words, (t) => ({
        ...t,
        constraints: t.constraints.map((c) => (sameConstraint(c, change.from) ? change.to : c)),
      }));
    case "addColumn":
      return mapTable(state, change.table.words, (t) => ({ ...t, columns: [...t.columns, change.column] }));
    case "dropColumn":
      return mapTable(state, change.table.words, (t) => ({ ...t, columns: t.columns.filter((c) => !same(c.words, change.column.words)) }));
    case "alterType":
      return mapTable(state, change.table.words, (t) => mapColumn(t, change.from.words, (c) => ({ ...c, type: change.to.type })));
    case "alterNullable":
      return mapTable(state, change.table.words, (t) => mapColumn(t, change.from.words, (c) => ({ ...c, nullable: change.to.nullable })));
    case "alterDefault":
      return mapTable(state, change.table.words, (t) =>
        mapColumn(t, change.from.words, (c) => {
          const { default: _d, ...rest } = c;
          return change.to.default === undefined ? rest : { ...rest, default: change.to.default };
        }),
      );
    case "alterPrimaryKey":
      return mapTable(state, change.table.words, (t) => ({ ...t, primaryKey: change.to }));
    case "alterClause":
      return mapTable(state, change.table.words, (t) => {
        const { clause: _c, ...rest } = t;
        return change.to === undefined ? rest : { ...rest, clause: change.to };
      });
    case "createTable":
      return { ...state, tables: [...state.tables, change.table] };
    case "addConstraint":
      return mapTable(state, change.table.words, (t) => ({ ...t, constraints: [...t.constraints, change.constraint] }));
    case "upsertRows":
      return mapTable(state, change.table.words, (t) => {
        const keep = new Map(t.rows.map((r) => [r.code, r]));
        for (const r of change.rows) keep.set(r.code, r);
        return { ...t, rows: [...keep.values()] };
      });
    case "removeRows":
      return mapTable(state, change.table.words, (t) => {
        const gone = new Set(change.rows.map((r) => r.code));
        return { ...t, rows: t.rows.filter((r) => !gone.has(r.code)) };
      });
    case "dropTable":
      return { ...state, tables: state.tables.filter((t) => !same(t.words, change.table.words)) };
  }
}

/**
 * The state that applying changes in order leads to.
 *
 * @param state - the state before; none for an empty database of the given dialect and naming
 * @param changes - the changes
 * @returns the state after
 */
export const applyChanges = (state: State, changes: readonly Change[]): State => changes.reduce(applyChange, state);
