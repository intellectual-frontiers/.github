// Spec: 0002-converge-command FR-002, FR-003, FR-004, FR-005
/**
 * The convergence of one asset: what is observed on the machine (by reading only), the order of the requirements, the plan between them, what the dialect renders and the steps it gives, the plan of steps of Headless with its hash, and the run of those steps, approved by that hash.
 * After an apply the plan is made again and must be empty. Archon orchestrates and the dialect converges: nothing here changes a machine but by the steps of the plan.
 *
 * @example
 * ```ts
 * import { describe } from "./run.ts";
 * // describe(planned) is the text a person reads before approving a plan
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Dialect } from "@intellectual-frontiers/archon/dialect";
import { executionPlanOf } from "@intellectual-frontiers/archon/dialect";
import { parseSubjectName, type Requirement } from "@intellectual-frontiers/archon/governance";
import { buildOrder, planOrder, type Plan } from "@intellectual-frontiers/archon/logical";
import { planHash, runPlan, textOf, type ExecEvent, type ExecutionPlan, type ExecutionResult, type Executor } from "@intellectual-frontiers/headless/logical";
import { observeRequirements } from "@intellectual-frontiers/linux-observe/physical";
import type { ConvergeSubject } from "./config.ts";

/** What a plan of convergence is: the entries, the steps and their hash. */
export type Planned = {
  readonly plan: Plan;
  readonly exec: ExecutionPlan | undefined;
  readonly hash: string | undefined;
  readonly rendered: ReadonlyMap<string, string>;
  readonly digest: string;
  readonly unexpressed: readonly Requirement[];
};

/** What a plan is made with. */
export type Made = { readonly dialect: Dialect; readonly asset: string; readonly subject: ConvergeSubject };

/** The plan of an asset: observe, order, plan, render and steps; or why it cannot be made. */
export async function planFor(m: Made): Promise<Result<Planned, string>> {
  const name = parseSubjectName(m.asset);
  if (name.kind === "err") return name;
  const order = buildOrder({ subject: { name: name.value, class: "machine" }, assurance: "solo", layers: [{ layer: "fleet", requirements: m.subject.requirements }] });
  if (order.kind === "err") return err(`the order cannot be made: ${JSON.stringify(order.error)}`);
  const observed = await observeRequirements(m.subject.executor, order.value.requirements, m.subject.elevate);
  const plan = planOrder(order.value, observed);
  const rendered = await m.dialect.render(order.value, plan);
  if (rendered.kind === "err") return err(rendered.error.join("; "));
  const elevate = m.subject.elevate;
  const steps = m.dialect.steps(plan, rendered.value).map((s) => ({ ...s, apply: [...elevate, ...s.apply], check: s.check === undefined ? undefined : [...elevate, ...s.check] }));
  const exec = executionPlanOf(plan, rendered.value, steps);
  if (exec.kind === "err") return err(exec.error.map((p) => JSON.stringify(p)).join("; "));
  return ok({ plan, exec: exec.value, hash: exec.value === undefined ? undefined : planHash(exec.value), rendered: rendered.value.files, digest: rendered.value.digest, unexpressed: m.subject.unexpressed });
}

/** The text a person reads before approving a plan: each change, what no dialect carries, and the hash. */
export function describe(p: Planned): string {
  const lines = p.plan.entries.filter((e) => e.action !== "none").map((e) => `${e.action.padEnd(6)} ${e.id}  (${e.kind}, ${e.change})`);
  const same = p.plan.entries.filter((e) => e.action === "none").length;
  const left = p.unexpressed.map((q) => `not converged: ${q.id} (${q.kind}): no dialect carries this kind yet`);
  return [`${lines.length} change${lines.length === 1 ? "" : "s"}, ${same} already as declared`, ...lines, ...left, p.hash === undefined ? "the plan is empty" : `plan hash ${p.hash}`].join("\n");
}

/** Puts the render on the machine, in the folder named by its digest. */
export async function deliver(executor: Executor, root: string, p: Planned, elevate: readonly string[]): Promise<Result<true, string>> {
  for (const [path, text] of p.rendered) {
    const full = `${root}/${p.digest}/${path}`;
    const dir = full.slice(0, full.lastIndexOf("/"));
    const made = await executor.exec([...elevate, "mkdir", "-p", dir]);
    if (!made.success) return err(`cannot make ${dir}: ${textOf(made.stderr).trim()}`);
    const wrote = await executor.exec([...elevate, "tee", full], { input: text });
    if (!wrote.success) return err(`cannot write ${full}: ${textOf(wrote.stderr).trim()}`);
  }
  return ok(true);
}

/** The version of the tool on the machine must be the one the dialect pins. */
export async function checkToolVersion(executor: Executor, elevate: readonly string[], argv: readonly string[], dialect: Dialect): Promise<Result<string, string>> {
  const r = await executor.exec([...elevate, ...argv]);
  if (!r.success) return err(`${dialect.tool.name} is not on the machine: install it first`);
  const first = textOf(r.stdout).split("\n")[0] ?? "";
  return first.includes(dialect.tool.version) ? ok(first) : err(`the machine has "${first}", and the dialect pins ${dialect.tool.name} ${dialect.tool.version}`);
}

/** What a run came to. */
export type Applied = { readonly result: ExecutionResult; readonly output: readonly string[]; readonly after: Planned | undefined };

/** Applies an approved plan, then makes the plan again: an apply that leaves a plan that is not empty is reported as such. */
export async function applyPlan(m: Made & { readonly renderRoot: string; readonly toolVersion: readonly string[]; readonly approvedHash: string; readonly destroy: boolean; readonly onEvent?: (e: ExecEvent) => void }): Promise<Result<Applied, string>> {
  const p = await planFor(m);
  if (p.kind === "err") return p;
  if (p.value.exec === undefined || p.value.hash === undefined) return ok({ result: { mode: "apply", planHash: m.approvedHash as never, steps: [], outcome: "unchanged" }, output: ["nothing to do"], after: p.value });
  if (p.value.hash !== m.approvedHash) return err(`the plan changed: you approved ${m.approvedHash} and it is now ${p.value.hash}; read it again with plan`);
  const destructive = p.value.exec.steps.some((s) => s.effect === "destructive");
  if (destructive && !m.destroy) return err("the plan removes something: read it, and add --allow-removal yes to carry it out");
  const version = await checkToolVersion(m.subject.executor, m.subject.elevate, m.toolVersion, m.dialect);
  if (version.kind === "err") return version;
  const delivered = await deliver(m.subject.executor, m.renderRoot, p.value, m.subject.elevate);
  if (delivered.kind === "err") return delivered;
  const output: string[] = [];
  const ran = await runPlan(m.subject.executor, p.value.exec, { mode: "apply", approval: { kind: "hash", hash: planHash(p.value.exec) } }, {
    onEvent: (e) => {
      if (e.kind === "line") output.push(e.text);
      m.onEvent?.(e);
    },
  });
  if (ran.kind === "err") return err(`the plan changed: ${JSON.stringify(ran.error)}`);
  const after = ran.value.outcome === "applied" ? await planFor(m) : undefined;
  return ok({ result: ran.value, output, after: after?.kind === "ok" ? after.value : undefined });
}
