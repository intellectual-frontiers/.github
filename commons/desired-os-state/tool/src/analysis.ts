// Spec: 0002-tool-command FR-002, FR-003
/**
 * The analysis of a selection of tools: which tools, resolved to which dialects (or why not), what is installed, the order and the plan Desired OS State makes, and for each dialect its render and its plan of steps.
 * It writes nothing and runs nothing but what the dialects observe with; `writeRendered` is the one place files are written, and `ensure` the one place steps are run.
 *
 * @example
 * ```ts
 * import { selectNames } from "./analysis.ts";
 * // selectNames(config, { phase: "core", names: [] }) is the tools of that phase, or the names given
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Rendered } from "@intellectual-frontiers/desired-os-state/dialect";
import { executionPlanOf } from "@intellectual-frontiers/desired-os-state/dialect";
import { parseSubjectName, type JsonValue, type Requirement, type RequirementId } from "@intellectual-frontiers/desired-os-state/governance";
import { buildOrder, planOf, type Order, type Plan } from "@intellectual-frontiers/desired-os-state/logical";
import type { ExecutionPlan } from "@intellectual-frontiers/headless/logical";
import { PHASES, type Phase } from "@intellectual-frontiers/toolchain/governance";
import { requirementsFor, resolveTools, type Resolution, type ResolveProblem } from "@intellectual-frontiers/toolchain/logical";
import * as fs from "@intellectual-frontiers/system/fs";
import * as path from "@intellectual-frontiers/system/path";
import type { ToolPluginConfig, ToolRuntime } from "./config.ts";

/** A phase from its word, or why it is not one. */
export function parsePhase(text: string): Result<Phase, string> {
  const p = PHASES.find((x) => x === text);
  return p === undefined ? err(`${JSON.stringify(text)} is not a phase (${PHASES.join(", ")})`) : ok(p);
}

/** The names of the tools a selection asks for: the names given, each of which must be in the catalog; otherwise every tool of the phase, or every tool where there is no phase. */
export function selectNames(config: ToolPluginConfig, sel: { readonly phase?: Phase | undefined; readonly names: readonly string[] }): Result<readonly string[], string> {
  const tools = [...config.catalog.tools.values()];
  const known = new Set<string>(tools.map((t) => String(t.name)));
  if (sel.names.length > 0) {
    const unknown = sel.names.filter((n) => !known.has(n));
    return unknown.length > 0 ? err(`not in the catalog: ${unknown.join(", ")} (it has ${[...known].sort().join(", ") || "no tool"})`) : ok([...sel.names]);
  }
  const chosen = tools.filter((t) => sel.phase === undefined || t.phases.includes(sel.phase)).map((t) => String(t.name));
  return ok(chosen.sort());
}

/** A reason a tool cannot be resolved, as sentences: one for the tool, then one for each dialect that was not chosen. */
export function describeProblems(problems: readonly ResolveProblem[]): readonly string[] {
  return problems.flatMap((p) => (p.kind === "unknown-tool" ? [`${p.tool} is not in the catalog`] : [`${p.tool} cannot be carried out here:`, ...p.reasons.map((r) => `  ${r.dialect}: ${r.reason}`)]));
}

/** One dialect's share of an analysis: what it renders, the steps it needs, and the plan of steps Headless runs. */
export type Share = { readonly runtime: ToolRuntime; readonly rendered: Rendered; readonly exec: ExecutionPlan | undefined };

/** What an analysis found. */
export type Analysis = {
  readonly resolution: Resolution;
  readonly requirements: readonly Requirement[];
  readonly observed: ReadonlyMap<RequirementId, JsonValue>;
  readonly order: Order;
  readonly plan: Plan;
  readonly shares: readonly Share[];
};

/** The analysis of the named tools, or every reason it cannot be made. */
export async function analyse(config: ToolPluginConfig, names: readonly string[]): Promise<Result<Analysis, readonly string[]>> {
  const resolution = resolveTools(config.catalog, names, config.runtimes.map((r) => r.tool), config.pins, { ...config.policy, preference: config.preference });
  if (resolution.kind === "err") return err(describeProblems(resolution.error));
  const reqs = requirementsFor(resolution.value, { by: "all" });
  if (reqs.kind === "err") return err(reqs.error);
  const observed = new Map<RequirementId, JsonValue>();
  for (const rt of config.runtimes) {
    const mine = reqs.value.filter((r) => isOf(r, String(rt.tool.id)));
    for (const [id, state] of await rt.observe(mine)) observed.set(id, state);
  }
  const subject = parseSubjectName(config.subject);
  if (subject.kind === "err") return err([`the name of this computer is not a subject name: ${subject.error}`]);
  const order = buildOrder({ subject: { name: subject.value, class: "workstation" }, assurance: config.assurance, layers: [{ layer: "baseline", requirements: reqs.value }] });
  if (order.kind === "err") return err(order.error.map((p) => JSON.stringify(p)));
  const plan = planOf(order.value, observed);
  const shares: Share[] = [];
  const problems: string[] = [];
  for (const rt of config.runtimes) {
    if (!reqs.value.some((r) => isOf(r, String(rt.tool.id)))) continue;
    const rendered = await rt.dialect.render(order.value, plan);
    if (rendered.kind === "err") {
      problems.push(...rendered.error.map((m) => `${rt.tool.id}: ${m}`));
      continue;
    }
    const exec = executionPlanOf(plan, rendered.value, rt.dialect.steps(plan, rendered.value));
    if (exec.kind === "err") problems.push(...exec.error.map((p) => `${rt.tool.id}: ${JSON.stringify(p)}`));
    else shares.push({ runtime: rt, rendered: rendered.value, exec: exec.value });
  }
  return problems.length > 0 ? err(problems) : ok({ resolution: resolution.value, requirements: reqs.value, observed, order: order.value, plan, shares });
}

function isOf(r: Requirement, dialect: string): boolean {
  const d = r.desired;
  if (typeof d !== "object" || d === null || Array.isArray(d)) return false;
  return (d as { readonly [key: string]: JsonValue })["dialect"] === dialect;
}

/** Writes what a dialect rendered below `<folder>/.desired-os-state/<digest>/`, where its steps read it, and says the paths. */
export async function writeRendered(folder: string, rendered: Rendered): Promise<readonly string[]> {
  const written: string[] = [];
  for (const [file, text] of rendered.files) {
    const target = path.join(folder, ".desired-os-state", rendered.digest, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeTextFile(target, text);
    written.push(target);
  }
  return written;
}
