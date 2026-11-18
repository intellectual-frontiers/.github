// Spec: 0014-sql-protected-access FR-008, FR-009
/**
 * The layer's transform of the lifecycle (commons data 0014-sql-protected-access FR-009): a step that renames, alters or drops a table or a column drops the views of the table before it, and
 * makes them again after it from the state it leaves, in the same transaction, so that a view never blocks the change it wraps and a consumer never sees the table half changed.
 *
 * @module
 */
import { type LogicalId, sameWords } from "@intellectual-frontiers/data/sql/logical";
import type { State, StateTable, StepContext, StepDraft, StepStatement, StepTransform } from "@intellectual-frontiers/data/sql/lifecycle";
import { enforcement } from "./guard.ts";
import type { Protection } from "./settings.ts";
import { dropView, type ViewTable, viewStatements } from "./view.ts";

const WRAPPED = new Set(["createTable", "dropTable", "renameTable", "addColumn", "dropColumn", "renameColumn", "alterType"]);

const viewTable = (t: StateTable, state: State, context: StepContext): ViewTable => ({
  words: t.words,
  name: t.name,
  qualifier: state.qualifier,
  columns: t.columns.map((c) => ({ name: c.name, words: c.words, type: c.type })),
  primaryKey: t.primaryKey,
  comment: context.schema.tables.find((x) => sameWords(x.name, t.words))?.comment ?? "",
  of: [t.id as LogicalId, ...t.columns.map((c) => c.id as LogicalId)],
});

/** The table a change is about, as it was before and as it is after. */
function tablesOf(draft: StepDraft, context: StepContext): { readonly before?: StateTable; readonly after?: StateTable } {
  const c = draft.change;
  const find = (s: State, words: readonly string[]): StateTable | undefined => s.tables.find((t) => sameWords(t.words, words));
  switch (c.kind) {
    case "createTable":
      return { ...(find(context.after, c.table.words) === undefined ? {} : { after: find(context.after, c.table.words) as StateTable }) };
    case "dropTable":
      return {
        ...(find(context.before, c.table.words) === undefined ? {} : { before: find(context.before, c.table.words) as StateTable }),
      };
    case "renameTable": {
      const before = find(context.before, c.fromWords);
      const after = find(context.after, c.toWords);
      return { ...(before === undefined ? {} : { before }), ...(after === undefined ? {} : { after }) };
    }
    default: {
      if (!("table" in c) || !("words" in c.table)) return {};
      const before = find(context.before, c.table.words);
      const after = find(context.after, c.table.words);
      return { ...(before === undefined ? {} : { before }), ...(after === undefined ? {} : { after }) };
    }
  }
}

/**
 * The transform of a project's settings.
 *
 * @param settings - the settings, with every default filled
 * @returns the transform
 */
export function protectionTransform(settings: Protection): StepTransform {
  return (draft, context): StepDraft => {
    if (!WRAPPED.has(draft.kind)) return draft;
    const { enforced } = enforcement(context.dialect, {
      ...settings,
      enforcement: settings.enforcement === "enforced" ? "auto" : settings.enforcement,
    });
    const vc = { dialect: context.dialect, naming: context.naming, schema: context.schema, settings, enforced };
    const { before, after } = tablesOf(draft, context);
    // a view is made again only where the table has the columns it shows, so that a step run again over a table that is further on does no harm
    const made = (t: StateTable, state: State): readonly StepStatement[] => {
      const probes = context.dialect.probes;
      const query =
        probes === undefined
          ? undefined
          : `SELECT 1 WHERE ${t.columns.map((c) => `EXISTS (${probes.column(t.name, c.name, state.qualifier)})`).join(" AND ")}`;
      return viewStatements(viewTable(t, state, context), vc).statements.map((s) =>
        query === undefined ? s : { ...s, guard: { query, skipWhen: "none" as const } },
      );
    };
    const around = (
      down: StateTable | undefined,
      up: StateTable | undefined,
      state: State,
      other: State,
      statements: readonly StepStatement[],
    ): readonly StepStatement[] => [
      ...(down === undefined ? [] : [dropView(viewTable(down, state, context), vc)]),
      ...statements,
      ...(up === undefined ? [] : made(up, other)),
    ];
    return {
      ...draft,
      up: around(before, after, context.before, context.after, draft.up),
      ...(draft.down === undefined ? {} : { down: around(after, before, context.after, context.before, draft.down) }),
    };
  };
}
