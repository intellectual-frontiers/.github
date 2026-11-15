/**
 * Lint: rules as typed values whose findings are data (commons 0006-sql-aide FR-025, FR-026, FR-027). A rule looks at the tables of a
 * model and at the documentation the context carries; a caller may add its own.
 *
 * @module
 */
import type { TableSpec } from "../algebra/table.ts";
import type { EmitContext } from "../emit/context.ts";

/** What a rule found: where, and one sentence saying what is wrong there. */
export interface Finding {
  /** The rule that found it. */
  readonly rule: string;
  /** The table it is in. */
  readonly table: string;
  /** The column, where it is about one. */
  readonly column?: string;
  /** What is wrong. */
  readonly message: string;
}

/** What a rule is given: a table as data, and the table itself, by which its documentation is found. */
export interface Linted {
  /** The table as data. */
  readonly spec: TableSpec;
}

/** A lint rule. */
export interface LintRule {
  /** The rule's name. */
  readonly id: string;
  /** What it finds in one table. */
  readonly check: (table: Linted, ctx: EmitContext) => readonly Finding[];
}

/** A table must have a primary key. */
export const primaryKeyRule: LintRule = {
  id: "primary-key",
  check: ({ spec }) => (spec.primaryKey.length === 0 ? [{ rule: "primary-key", table: spec.name, message: "has no primary key" }] : []),
};

/** Names are lower-case words joined by underscores. */
export const namingRule: LintRule = {
  id: "naming",
  check: ({ spec }) => {
    const snake = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
    const out: Finding[] = [];
    if (!snake.test(spec.name)) out.push({ rule: "naming", table: spec.name, message: "is not lower-case words joined by underscores" });
    for (const [name] of spec.columns) {
      if (!snake.test(name))
        out.push({ rule: "naming", table: spec.name, column: name, message: "is not lower-case words joined by underscores" });
    }
    return out;
  },
};

/** A table and each of its columns must have a description, from a TSDoc comment or said outright (FR-025). */
export const descriptionRule: LintRule = {
  id: "description",
  check: (table, ctx) => {
    const { spec } = table;
    const docs = ctx.docs.get(table);
    const out: Finding[] = [];
    if (spec.doc === undefined && docs?.summary === undefined)
      out.push({ rule: "description", table: spec.name, message: "has no description" });
    for (const [name, c] of spec.columns) {
      if (c.doc === undefined && docs?.members[name] === undefined)
        out.push({ rule: "description", table: spec.name, column: name, message: "has no description" });
    }
    return out;
  },
};

/** A table must say who answers for it (FR-025). */
export const ownerRule: LintRule = {
  id: "owner",
  check: ({ spec }) => (spec.owner === undefined ? [{ rule: "owner", table: spec.name, message: "has no owner" }] : []),
};

/** A column said to hold personal data must name its category in DPV's Personal Data extension (FR-026). */
export const personalDataRule: LintRule = {
  id: "personal-data",
  check: ({ spec }) =>
    spec.columns.flatMap(([name, c]) =>
      c.personal !== undefined && c.category === undefined
        ? [
            {
              rule: "personal-data",
              table: spec.name,
              column: name,
              message: "holds personal data but names no category of the vocabulary",
            },
          ]
        : [],
    ),
};

/** The rules a model is held to unless it says otherwise. */
export const typicalRules: readonly LintRule[] = [primaryKeyRule, namingRule, descriptionRule, ownerRule, personalDataRule];

/**
 * Runs rules over the tables of a model.
 *
 * @param tables - the tables
 * @param ctx - the context, whose documentation the rules read
 * @param rules - the rules, the typical ones where none are given; the rules of the context's plugins are added to them
 */
export function lint(tables: readonly Linted[], ctx: EmitContext, rules: readonly LintRule[] = typicalRules): readonly Finding[] {
  const all = [...rules, ...ctx.plugins.flatMap((p) => p.hooks?.lint ?? [])];
  return tables.flatMap((t) => all.flatMap((r) => r.check(t, ctx)));
}
