// Spec: 0019-sql-convergence FR-004, FR-005, FR-006
/**
 * Proposals (commons data 0019-sql-convergence FR-004 to FR-006): the plan from the state a database is in to the state wanted, pinned to the state it was computed from. A reviewed proposal is
 * a file a person reads and approves; applying it checks that the text is the one that was approved and that the database is still in the state it was pinned to.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type Applied,
  type Desired,
  type Driver,
  execute,
  plan,
  type Plan,
  type PlanError,
  type PlanOptions,
  type Repeatable,
  type RunError,
  type RunOptions,
  type RunStep,
  type State,
  snapshotOf,
  stateHash,
  type StepStatement,
  type Verification,
} from "@intellectual-frontiers/data/sql/lifecycle";
import type { LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import type { Artifact, Dialect } from "@intellectual-frontiers/data/sql/physical";
import { readState, type ReadError } from "./read.ts";
import { sha256Hex } from "@intellectual-frontiers/data/sql/lifecycle";

/** A step as a proposal holds it. */
export interface ProposalStep {
  readonly number: number;
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly class: string;
  readonly why?: string;
  readonly reversibility: string;
  readonly idempotency?: string;
  readonly from: string;
  readonly to: string;
  readonly of: readonly string[];
  readonly up: readonly StepStatement[];
  readonly down?: readonly StepStatement[];
  readonly verify?: Verification;
}

/** A plan pinned to the state it was computed from. */
export interface Proposal {
  readonly format: 1;
  readonly dialect: string;
  /** The hash of the state the database was in. */
  readonly base: string;
  /** The hash of the state the plan ends in. */
  readonly to: string;
  readonly steps: readonly ProposalStep[];
  /** What is in the database and not in the model, and is held: no step touches it. */
  readonly held?: readonly string[];
  readonly repeatable: readonly {
    readonly key: string;
    readonly hash: string;
    readonly of: readonly string[];
    readonly statements: readonly StepStatement[];
  }[];
}

/** What is wrong with a proposal. */
export type ProposeError =
  { readonly kind: "read"; readonly errors: readonly ReadError[] } | { readonly kind: "plan"; readonly errors: readonly PlanError[] };
/** What is wrong with applying one. */
export type ApplyError =
  | { readonly kind: "unapproved"; readonly approved: string; readonly actual: string }
  | { readonly kind: "unreadable"; readonly why: string }
  | { readonly kind: "read"; readonly errors: readonly ReadError[] }
  | { readonly kind: "stale"; readonly pinned: string; readonly found: string }
  | RunError;

/** What a proposal is made with. */
export interface ProposeOptions extends PlanOptions {
  /** The names of tables the reader leaves out, besides the ledger's. */
  readonly ignore?: readonly string[];
  /** The ledger's table; `lifecycle_ledger` by default. */
  readonly ledgerTable?: string;
}

/** The state wanted, as a value. */
export function desiredState(schema: LogicalSchema, desired: Desired): State | undefined {
  const r = snapshotOf(schema, {
    dialect: desired.dialect,
    ...(desired.naming === undefined ? {} : { naming: desired.naming }),
    ...(desired.schema === undefined ? {} : { schema: desired.schema }),
    ...(desired.tableClauses === undefined ? {} : { tableClauses: desired.tableClauses }),
  });
  return r.kind === "ok" ? r.value : undefined;
}

/**
 * The plan from the state a database is in to the state wanted, pinned.
 *
 * @param driver - the database
 * @param schema - the logical schema wanted
 * @param desired - the dialect, naming, schema and what extensions add
 * @param options - what `plan` is given, and the names the reader leaves out
 * @returns the proposal and what it is made of, or why not
 */
export async function propose(
  driver: Driver,
  schema: LogicalSchema,
  desired: Desired,
  options: ProposeOptions = {},
): Promise<
  Result<{ readonly proposal: Proposal; readonly plan: Plan; readonly live: State; readonly wanted: State }, readonly ProposeError[]>
> {
  const wanted = desiredState(schema, desired);
  if (wanted === undefined) return err([{ kind: "plan", errors: [{ kind: "write", errors: [] }] }]);
  const held: string[] = [];
  const live = await readState(driver, desired.dialect, wanted, {
    ignore: [options.ledgerTable ?? "lifecycle_ledger", ...(options.ignore ?? [])],
    held,
  });
  if (live.kind === "err") return err([{ kind: "read", errors: live.error }]);
  const { ignore: _ignore, ledgerTable: _ledger, ...planOptions } = options;
  const p = plan(live.value, schema, desired, planOptions);
  if (p.kind === "err") return err([{ kind: "plan", errors: p.error }]);
  const proposal: Proposal = {
    format: 1,
    dialect: desired.dialect.name,
    base: stateHash(live.value),
    to: p.value.to,
    ...(held.length === 0 ? {} : { held }),
    steps: p.value.steps.map((s, i) => ({
      number: i + 1,
      id: s.id,
      name: s.name,
      kind: s.kind,
      class: s.class,
      ...(s.why === undefined ? {} : { why: s.why }),
      reversibility: s.reversibility,
      ...(s.idempotency === undefined ? {} : { idempotency: s.idempotency }),
      from: s.from,
      to: s.to,
      of: s.of,
      up: s.up,
      ...(s.down === undefined ? {} : { down: s.down }),
      ...(s.verify === undefined ? {} : { verify: s.verify }),
    })),
    repeatable: p.value.repeatable.map((r) => ({ key: r.key, hash: r.hash, of: r.of, statements: r.statements })),
  };
  return ok({ proposal, plan: p.value, live: live.value, wanted });
}

/** The text a person approves: the proposal, the same every time. */
export const proposalText = (p: Proposal): string => `${JSON.stringify(p, null, 2)}\n`;

/**
 * The files of a proposal: the text that is approved and a page to read it by.
 *
 * @param p - the proposal
 * @param stem - what the files are called
 * @returns the files
 */
export function renderProposal(p: Proposal, stem: string): readonly Artifact[] {
  const md = [
    `# Proposal: ${stem}`,
    "",
    `For ${p.dialect}. Pinned to state \`${p.base.slice(0, 12)}\`; ends in state \`${p.to.slice(0, 12)}\`. Approve the hash of \`${stem}.${p.to.slice(0, 8)}.plan.json\`.`,
    "",
    ...(p.steps.length === 0 ? ["No step: the database is in the state wanted."] : []),
    ...p.steps.flatMap((s) => [
      `## ${s.number}. ${s.name}`,
      "",
      `${s.class}, ${s.reversibility}${s.idempotency === undefined ? "" : `, ${s.idempotency}`}${s.why === undefined ? "" : `. ${s.why.replace(/\s+/g, " ")}`}`,
      "",
      "```sql",
      ...s.up.map((u) => u.sql),
      "```",
      "",
    ]),
  ];
  return [
    { path: `convergence/${stem}.${p.to.slice(0, 8)}.plan.json`, text: proposalText(p) },
    { path: `convergence/${stem}.${p.to.slice(0, 8)}.plan.md`, text: `${md.join("\n")}\n` },
  ];
}

/**
 * Applies a proposal that was approved.
 *
 * @param text - the proposal's text
 * @param approved - the hash of the text that was approved
 * @param driver - the database
 * @param dialect - its dialect
 * @param wanted - the state wanted, to read the database against
 * @param options - what the run is given and the names the reader leaves out
 * @returns what was applied, or why not
 */
export async function applyProposal(
  text: string,
  approved: string,
  driver: Driver,
  dialect: Dialect,
  wanted: State,
  options: Omit<RunOptions, "empty"> & { readonly ignore?: readonly string[] } = {},
): Promise<Result<Applied, readonly ApplyError[]>> {
  const actual = sha256Hex(text);
  if (actual !== approved) return err([{ kind: "unapproved", approved, actual }]);
  let proposal: Proposal;
  try {
    proposal = JSON.parse(text) as Proposal;
  } catch {
    return err([{ kind: "unreadable", why: "the proposal is not JSON" }]);
  }
  const live = await readState(driver, dialect, wanted, { ignore: [options.ledgerTable ?? "lifecycle_ledger", ...(options.ignore ?? [])] });
  if (live.kind === "err") return err([{ kind: "read", errors: live.error }]);
  const found = stateHash(live.value);
  if (found !== proposal.base && found !== proposal.to) return err([{ kind: "stale", pinned: proposal.base, found }]);
  const steps: RunStep[] = proposal.steps.map((s) => ({
    id: s.id,
    name: s.name,
    from: s.from,
    to: s.to,
    up: s.up,
    of: s.of as RunStep["of"],
    ...(s.verify === undefined ? {} : { verify: s.verify }),
  }));
  const repeatable: Repeatable[] = proposal.repeatable.map((r) => ({
    key: r.key,
    hash: r.hash,
    of: r.of as Repeatable["of"],
    statements: r.statements,
  }));
  const { ignore: _i, ...run } = options;
  return execute({ from: proposal.base, to: proposal.to, steps, repeatable }, driver, dialect, { ...run, empty: found });
}
