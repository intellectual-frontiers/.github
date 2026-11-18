// Spec: 0016-sql-plan-report FR-001 to FR-008
/**
 * The plan report (commons data 0016-sql-plan-report): what a plan does, in the words of governance. It is made from a plan and the logical schemas before and after it, and is the same text every
 * time: a summary, a table of steps with the lock each takes, what governance says of what each step touches, what governance itself changes, who has to approve and why, and what is new.
 *
 * @module
 */
import { type Annotation, vocabularies, words } from "@intellectual-frontiers/data/governance";
import { carriedOf, type Column, type LogicalId, type LogicalSchema, type Table } from "@intellectual-frontiers/data/sql/logical";
import type { Plan, Step } from "@intellectual-frontiers/data/sql/lifecycle";
import { type Artifact, type Dialect, type Naming, naming as defaultNaming } from "@intellectual-frontiers/data/sql/physical";
import { type Report, type ReportSettings, settingsOf } from "./settings.ts";

const { privacy, security, ownership, quality, requirements } = vocabularies;

/** What governance says of one element a step is made from. */
export interface ElementGovernance {
  readonly element: string;
  readonly personal?: { readonly category?: string; readonly class?: string; readonly purposes: readonly string[] };
  readonly classification?: string;
  readonly access?: { readonly read: readonly string[]; readonly write: readonly string[] };
  readonly scope?: string;
  readonly mask?: string;
  readonly retentionDays?: number;
  readonly cites: readonly string[];
}

/** A role that has to approve a step, and why. */
export interface Approver {
  readonly role: string;
  readonly because: string;
}

/** What the report says of one step. */
export interface StepReport {
  readonly number: number;
  readonly name: string;
  readonly kind: string;
  readonly key: string;
  readonly class: string;
  readonly why?: string;
  readonly reversibility: string;
  readonly idempotency?: string;
  readonly lock: string;
  readonly elements: readonly ElementGovernance[];
  readonly approvers: readonly Approver[];
}

/** A change of what governance says. */
export interface GovernanceChange {
  readonly element: string;
  readonly annotation: string;
  readonly change: "added" | "removed" | "changed";
  readonly before?: unknown;
  readonly after?: unknown;
}

/** The report as data. */
export interface ReportData {
  readonly domain: string;
  readonly dialect: string;
  readonly from: string;
  readonly to: string;
  readonly counts: {
    readonly steps: number;
    readonly byClass: Readonly<Record<string, number>>;
    readonly byReversibility: Readonly<Record<string, number>>;
    readonly byIdempotency: Readonly<Record<string, number>>;
  };
  readonly steps: readonly StepReport[];
  /** What governance changes between the schemas; none where the schema before was not given. */
  readonly governanceChanges: readonly GovernanceChange[] | null;
  readonly added: readonly { readonly element: string; readonly description: string }[];
  readonly approvals: readonly { readonly role: string; readonly steps: readonly number[] }[];
}

/** What a report is made from. */
export interface ReportInput {
  readonly plan: Plan;
  /** The logical schema the database was made from; none for an empty database or where it is not known. */
  readonly before?: LogicalSchema;
  readonly after: LogicalSchema;
  readonly dialect: Dialect;
  readonly naming?: Naming;
  readonly settings?: ReportSettings;
}

interface Indexed {
  readonly label: string;
  readonly governance: readonly Annotation[];
  readonly table: Table | undefined;
  readonly schemaLevel: boolean;
}

function indexOf(schema: LogicalSchema | undefined, naming: Naming): Map<string, Indexed> {
  const out = new Map<string, Indexed>();
  if (schema === undefined) return out;
  const w = (x: readonly string[]): string => naming.names.write(x);
  for (const t of schema.tables) {
    out.set(t.id, { label: w(t.name), governance: t.governance, table: t, schemaLevel: false });
    for (const c of t.columns)
      out.set(c.id, { label: `${w(t.name)}.${w(c.name)}`, governance: c.governance, table: t, schemaLevel: false });
  }
  return out;
}

const lockOf = (step: Step, dialect: Dialect): string => {
  if (dialect.locks === undefined) return "the engine allows one writer; no table lock of its own (estimate)";
  const c = step.change;
  const brief = "ACCESS EXCLUSIVE, held briefly";
  switch (c.kind) {
    case "createTable":
      return "none on a table that exists (estimate)";
    case "addColumn":
    case "dropColumn":
    case "renameTable":
    case "renameColumn":
    case "dropConstraint":
    case "dropTable":
    case "alterDefault":
      return `${brief} (estimate)`;
    case "alterType":
      return "ACCESS EXCLUSIVE, held for the length of a rewrite of the table (estimate)";
    case "alterNullable":
      return c.to.nullable ? `${brief} (estimate)` : "ACCESS EXCLUSIVE while the table is scanned (estimate)";
    case "addConstraint":
      return c.constraint.kind === "index"
        ? "SHARE, which blocks writes while the index is built (estimate)"
        : step.up.some((s) => /NOT VALID/.test(s.sql))
          ? "SHARE ROW EXCLUSIVE briefly, then SHARE UPDATE EXCLUSIVE while the rows are checked (estimate)"
          : "SHARE ROW EXCLUSIVE while the rows are checked (estimate)";
    case "upsertRows":
    case "removeRows":
      return "row locks on the rows it changes (estimate)";
    default:
      return `${brief} (estimate)`;
  }
};

function governanceOf(e: Indexed): ElementGovernance {
  const p = carriedOf(e, privacy.personal)[0];
  const r = carriedOf(e, quality.retention)[0];
  const cl = carriedOf(e, security.classification)[0];
  const ac = carriedOf(e, security.access)[0];
  const sc = carriedOf(e, security.scope)[0];
  const mk = carriedOf(e, security.mask)[0];
  return {
    element: e.label,
    ...(p === undefined
      ? {}
      : {
          personal: {
            ...(p.category === undefined ? {} : { category: p.category, class: privacy.dpvClassOf(p.category) }),
            purposes: p.purposes ?? [],
          },
        }),
    ...(cl === undefined ? {} : { classification: cl }),
    ...(ac === undefined ? {} : { access: ac }),
    ...(sc === undefined ? {} : { scope: sc.name }),
    ...(mk === undefined ? {} : { mask: mk }),
    ...(r === undefined ? {} : { retentionDays: r.days }),
    cites: carriedOf(e, requirements.cites).flat(),
  };
}

const isEmpty = (g: ElementGovernance): boolean => Object.keys(g).length === 2 && g.cites.length === 0;

/** What governance changes between two schemas: each annotation added, removed or changed, by element. */
function changesBetween(before: LogicalSchema, after: LogicalSchema, naming: Naming): readonly GovernanceChange[] {
  const flat = (schema: LogicalSchema): Map<string, unknown> => {
    const out = new Map<string, unknown>();
    for (const [, e] of indexOf(schema, naming)) {
      const byKind = new Map<string, unknown[]>();
      for (const a of e.governance) byKind.set(a.kind, [...(byKind.get(a.kind) ?? []), a.value]);
      for (const [k, v] of byKind) out.set(`${e.label}|${k}`, v.length === 1 ? v[0] : v);
    }
    return out;
  };
  const a = flat(before);
  const b = flat(after);
  const out: GovernanceChange[] = [];
  for (const key of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const [element = "", annotation = ""] = key.split("|");
    const x = a.get(key);
    const y = b.get(key);
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    out.push({
      element,
      annotation,
      change: x === undefined ? "added" : y === undefined ? "removed" : "changed",
      ...(x === undefined ? {} : { before: x }),
      ...(y === undefined ? {} : { after: y }),
    });
  }
  return out;
}

/**
 * The report of a plan, as data.
 *
 * @param input - the plan, the schemas, the dialect and the settings
 * @returns the report
 */
export function reportData(input: ReportInput): ReportData {
  const naming = input.naming ?? defaultNaming();
  const settings: Report = settingsOf(input.settings);
  const after = indexOf(input.after, naming);
  const before = indexOf(input.before, naming);
  const known = (id: LogicalId): Indexed | undefined => after.get(id) ?? before.get(id);
  const steps = input.plan.steps.map((s, i): StepReport => {
    const elements = s.of.flatMap((id) => {
      const e = known(id);
      return e === undefined ? [] : [governanceOf(e)];
    });
    const touched = s.of.flatMap((id) => {
      const e = known(id);
      return e?.table === undefined ? [] : [e];
    });
    const approvers: Approver[] = [];
    const add = (role: string, because: string): void =>
      void (approvers.some((a) => a.role === role && a.because === because) || approvers.push({ role, because }));
    if (settings.steward) {
      const owned = new Set<Table>();
      for (const e of touched) if (e.table !== undefined) owned.add(e.table);
      for (const t of owned) {
        const who =
          carriedOf(t, ownership.steward)[0] ??
          carriedOf(t, ownership.owner)[0] ??
          carriedOf(input.after, ownership.steward)[0] ??
          carriedOf(input.after, ownership.owner)[0];
        if (who !== undefined) add(who, `it answers for ${naming.names.write(t.name)}`);
      }
    }
    for (const g of elements.filter((x) => !isEmpty(x))) {
      if (g.personal !== undefined)
        add(
          settings.personalRole,
          `${g.element} holds personal data${g.personal.category === undefined ? "" : ` (${g.personal.category})`}`,
        );
      if (g.classification === "restricted") add(settings.restrictedRole, `${g.element} is restricted`);
    }
    if (s.class === "destructive" || s.class === "manual")
      add(settings.destructiveRole, s.class === "manual" ? "a person wrote this step" : "it destroys data");
    return {
      number: i + 1,
      name: s.name,
      kind: s.kind,
      key: s.key,
      class: s.class,
      ...(s.why === undefined ? {} : { why: s.why }),
      reversibility: s.reversibility,
      ...(s.idempotency === undefined ? {} : { idempotency: s.idempotency }),
      lock: lockOf(s, input.dialect),
      elements: elements.filter((x) => !isEmpty(x)),
      approvers,
    };
  });
  const count = (f: (s: StepReport) => string | undefined): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const s of steps) {
      const k = f(s);
      if (k !== undefined) out[k] = (out[k] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(out).sort(([x], [y]) => (x < y ? -1 : 1)));
  };
  const roles = new Map<string, number[]>();
  for (const s of steps) for (const a of s.approvers) roles.set(a.role, [...(roles.get(a.role) ?? []), s.number]);
  const added: { element: string; description: string }[] = [];
  for (const s of input.plan.steps) {
    const c = s.change;
    if (c.kind === "createTable") {
      const t = input.after.tables.find((x) => x.id === c.table.id);
      if (t !== undefined) added.push({ element: naming.names.write(t.name), description: t.comment });
    } else if (c.kind === "addColumn") {
      for (const id of s.of) {
        const e = after.get(id);
        const col = e?.table?.columns.find((x: Column) => x.id === id);
        if (e !== undefined && col !== undefined) added.push({ element: e.label, description: col.comment });
      }
    }
  }
  return {
    domain: input.after.domain,
    dialect: input.dialect.name,
    from: input.plan.from,
    to: input.plan.to,
    counts: {
      steps: steps.length,
      byClass: count((s) => s.class),
      byReversibility: count((s) => s.reversibility),
      byIdempotency: count((s) => s.idempotency),
    },
    steps,
    governanceChanges: input.before === undefined ? null : changesBetween(input.before, input.after, naming),
    added,
    approvals: [...roles].sort(([x], [y]) => (x < y ? -1 : 1)).map(([role, s]) => ({ role, steps: s })),
  };
}

const cell = (t: string): string => t.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
const one = (t: string): string => t.replace(/\s*\r?\n\s*/g, " ").trim();
const counts = (c: Readonly<Record<string, number>>): string =>
  Object.keys(c).length === 0
    ? "none"
    : Object.entries(c)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ");

/** The report as Markdown. */
export function reportMarkdown(d: ReportData): string {
  const out: string[] = [
    `# Plan: ${d.domain}`,
    "",
    `Dialect ${d.dialect}. From state \`${d.from.slice(0, 12)}\` to state \`${d.to.slice(0, 12)}\`.`,
    "",
    "## Summary",
    "",
  ];
  if (d.counts.steps === 0) out.push("The plan has no step: the database is in the state wanted.");
  else
    out.push(
      `${d.counts.steps} steps. By class: ${counts(d.counts.byClass)}. By reversibility: ${counts(d.counts.byReversibility)}. By idempotency: ${counts(d.counts.byIdempotency)}.`,
    );
  if (d.steps.length > 0) {
    out.push("", "## Steps", "", "| # | Step | Class | Reversibility | Idempotency | Lock |", "| --- | --- | --- | --- | --- | --- |");
    for (const s of d.steps)
      out.push(`| ${s.number} | ${cell(s.name)} | ${s.class} | ${s.reversibility} | ${s.idempotency ?? ""} | ${cell(s.lock)} |`);
    const detailed = d.steps.filter((s) => s.why !== undefined || s.elements.length > 0 || s.approvers.length > 0);
    if (detailed.length > 0) out.push("", "## What governance says of each step");
    for (const s of detailed) {
      out.push("", `### ${s.number}. ${one(s.name)}`, "");
      if (s.why !== undefined) out.push(`Why it is not plain: ${one(s.why)}.`, "");
      for (const e of s.elements) {
        const says = [
          e.personal === undefined
            ? undefined
            : `personal data${e.personal.category === undefined ? "" : ` ${e.personal.category}${e.personal.class === undefined ? "" : ` (${e.personal.class})`}`}${e.personal.purposes.length === 0 ? "" : `, held for ${e.personal.purposes.join(", ")}`}`,
          e.classification === undefined ? undefined : `classification ${e.classification}`,
          e.access === undefined
            ? undefined
            : `read by ${e.access.read.join(", ") || "none"}, written by ${e.access.write.join(", ") || "none"}`,
          e.scope === undefined ? undefined : `scope ${e.scope}`,
          e.mask === undefined ? undefined : `mask ${e.mask}`,
          e.retentionDays === undefined ? undefined : `kept ${e.retentionDays} days`,
          e.cites.length === 0 ? undefined : `serves ${e.cites.join(", ")}`,
        ].filter((x): x is string => x !== undefined);
        out.push(`- \`${e.element}\`: ${one(says.join("; "))}`);
      }
      if (s.approvers.length > 0) out.push("", `Approvals: ${s.approvers.map((a) => `${a.role} (${one(a.because)})`).join("; ")}.`);
    }
  }
  out.push("", "## What governance changes", "");
  if (d.governanceChanges === null)
    out.push(
      "The schema before the plan was not given, so what governance changes, and what governance said of what is removed, is not known.",
    );
  else if (d.governanceChanges.length === 0) out.push("Governance says the same of every element.");
  else
    for (const c of d.governanceChanges)
      out.push(
        `- \`${c.element}\` ${c.annotation}: ${c.change}${c.before === undefined ? "" : `, was ${one(JSON.stringify(c.before))}`}${c.after === undefined ? "" : `, now ${one(JSON.stringify(c.after))}`}`,
      );
  out.push("", "## Approvals", "");
  if (d.approvals.length === 0) out.push("No role has to approve.");
  else for (const a of d.approvals) out.push(`- ${a.role}: steps ${a.steps.join(", ")}`);
  out.push("", "## What is new", "");
  if (d.added.length === 0) out.push("Nothing is made.");
  else for (const a of d.added) out.push(`- \`${a.element}\`: ${one(a.description)}`);
  return `${out.join("\n")}\n`;
}

/**
 * The report as files: Markdown and JSON.
 *
 * @param input - what the report is made from
 * @returns the two files
 */
export function reportArtifacts(input: ReportInput): readonly Artifact[] {
  const naming = input.naming ?? defaultNaming();
  const data = reportData(input);
  const stem = naming.names.write(words(input.after.domain));
  return [
    { path: `${stem}.plan.md`, text: reportMarkdown(data) },
    { path: `${stem}.plan.json`, text: `${JSON.stringify(data, null, 2)}\n` },
  ];
}
