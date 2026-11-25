// Spec: 0010-workload-runners FR-001, FR-004, FR-005, FR-011, FR-013
/**
 * The runner axis of the core. A runner is how a plan is carried out, and it replaces the executor port of the form contract. There are two kinds: a `native` runner is the TypeScript of the library, which interprets the
 * plan, is interactive and records the events of a run directly; an `integration` runner compiles the plan into an artifact that a foreign system runs and then hands off. Each runner declares the capabilities it has from one
 * closed list, a form says what its workload needs from the same list (derived from the nodes, never declared), and the choice of a runner is a policy a fleet owns and never a field of a workload. This module is the
 * types, the registry, the policy and the plan of calls that an artifact is made from; it imports nothing from a form.
 *
 * @example
 * ```ts
 * import { RUNNERS } from "./runner.ts";
 * RUNNERS.get("native")?.kind; // "native"
 * RUNNERS.get("bash")?.capabilities; // ["calls", "fan-out"]
 * ```
 *
 * @module
 */
import { err, formatDecodeError, ok, type Result, record, string } from "@intellectual-frontiers/core";
import type { Autonomy } from "@intellectual-frontiers/workbench/governance";
import { canonicalJson } from "./events.ts";
import { type RunnerId, runnerId } from "./ids.ts";
import { type BuiltFormId, isBuiltForm } from "./terms.ts";

/** The two kinds of runner: our TypeScript, and a compiler of an artifact that a foreign system runs. */
export const RUNNER_KINDS = ["native", "integration"] as const;
/** One kind of runner. */
export type RunnerKind = (typeof RUNNER_KINDS)[number];

/** What a runner can carry, a closed list. `calls` is a call of a verb by its id; `fan-out` a loop over a fixed list; `interactive` a stop for a person; `judge` a bounded judgement of an agent; `approval` the approval of a gate by a person, ingested as evidence; `logic` a computation of typed TypeScript (a branch, a diff, a plan); `compensate` an undo; `destroy` a destroy of a durable, git or external store. */
export const RUNNER_CAPABILITIES = ["calls", "fan-out", "interactive", "judge", "approval", "logic", "compensate", "destroy"] as const;
/** One capability of a runner. */
export type RunnerCapability = (typeof RUNNER_CAPABILITIES)[number];

/** A runner as registered: its id, its kind, what it says of itself and the capabilities it declares. */
export type Runner = { readonly id: RunnerId; readonly kind: RunnerKind; readonly title: string; readonly capabilities: readonly RunnerCapability[] };

/** A registry of runners by id. */
export type RunnerRegistry = { has(id: string): boolean; get(id: string): Runner | undefined; list(): readonly Runner[] };

/** A registry of runners, or the id it has twice. */
export function createRunnerRegistry(infos: readonly Runner[]): Result<RunnerRegistry, string> {
  const byId = new Map<string, Runner>();
  for (const r of infos) {
    if (byId.has(r.id)) return err(`the runner ${r.id} is registered twice`);
    byId.set(r.id, r);
  }
  const sorted = [...infos].sort((a, b) => (a.id < b.id ? -1 : 1));
  return ok({ has: (id) => byId.has(id), get: (id) => byId.get(id), list: () => sorted });
}

const named = (text: string): RunnerId => {
  const r = runnerId(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

/** The id of the native runner, the default of every policy. */
export const NATIVE_RUNNER: RunnerId = named("native");

/** The runners of the commons: the native runner, and the integration runners that emit a script of modern Bash and of modern PowerShell. */
export const RUNNERS: RunnerRegistry = (() => {
  const made = createRunnerRegistry([
    { id: NATIVE_RUNNER, kind: "native", title: "Native: the TypeScript of the library", capabilities: RUNNER_CAPABILITIES },
    { id: named("bash"), kind: "integration", title: "Bash 5 or later", capabilities: ["calls", "fan-out"] },
    { id: named("pwsh"), kind: "integration", title: "PowerShell 7 or later", capabilities: ["calls", "fan-out"] },
  ]);
  if (made.kind === "err") throw new Error(made.error);
  return made.value;
})();

/** What a workload needs of a runner, from one node: the capability, the node and why. */
export type RunnerNeed = { readonly capability: RunnerCapability; readonly node: string; readonly why: string };

/** The capabilities that only the native runner has: a person, an agent, typed logic, an undo and a destroy are never carried by a script. */
export const NATIVE_ONLY: readonly RunnerCapability[] = ["interactive", "judge", "logic", "compensate", "destroy"];

/** The policy a fleet owns that chooses a runner. */
export type RunnerPolicy = {
  /** The runner of every run that nothing else chooses: `native` unless the fleet says another. */
  readonly default: RunnerId;
  /** By workload: the id of a workload. */
  readonly perWorkload: Readonly<Record<string, RunnerId>>;
  /** By form: the id of a form that has code. */
  readonly perForm: Readonly<Record<string, RunnerId>>;
  /** By operator: the preference of a person. */
  readonly perOperator: Readonly<Record<string, RunnerId>>;
};

/** The policy of a fleet that has chosen nothing: every run is native. */
export const DEFAULT_RUNNER_POLICY: RunnerPolicy = { default: NATIVE_RUNNER, perWorkload: {}, perForm: {}, perOperator: {} };

/** A policy from a value that came from outside, or every reason it is not one: each runner named must be registered, and the default is `native` where absent. */
export function decodeRunnerPolicy(input: unknown, registry: RunnerRegistry = RUNNERS): Result<RunnerPolicy, readonly string[]> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return err(["a runner policy is an object"]);
  const problems: string[] = [];
  const pick = (value: unknown, where: string): RunnerId | undefined => {
    const r = runnerId(value);
    if (r.kind === "err") {
      problems.push(`${where}: ${r.error}`);
      return undefined;
    }
    if (!registry.has(r.value)) {
      problems.push(`${where}: the runner ${r.value} is not registered`);
      return undefined;
    }
    return r.value;
  };
  const map = (key: string): Readonly<Record<string, RunnerId>> => {
    const raw: unknown = Reflect.get(input, key);
    if (raw === undefined) return {};
    const shape = record(string)(raw, `$.${key}`);
    if (shape.kind === "err") {
      problems.push(formatDecodeError(shape.error));
      return {};
    }
    const out: Record<string, RunnerId> = {};
    for (const [k, v] of Object.entries(shape.value)) {
      const d = pick(v, `$.${key}.${k}`);
      if (d !== undefined) out[k] = d;
    }
    return out;
  };
  const rawDefault: unknown = Reflect.get(input, "default");
  const dflt = rawDefault === undefined ? NATIVE_RUNNER : pick(rawDefault, "$.default");
  const policy = { perWorkload: map("perWorkload"), perForm: map("perForm"), perOperator: map("perOperator") };
  for (const form of Object.keys(policy.perForm)) if (!isBuiltForm(form)) problems.push(`$.perForm.${form}: ${form} is not a form that has code`);
  return problems.length > 0 || dflt === undefined ? err(problems) : ok({ default: dflt, ...policy });
}

/** One argument of a call: its name and its value, which is a text or an input of the run read from the environment. */
export type CallArg = { readonly name: string; readonly value: { readonly kind: "literal"; readonly text: string } | { readonly kind: "input"; readonly name: string } };

/** A call of one verb by its id, with the derived autonomy of its node; `as` says whether the node is a verb or a check, which an artifact only says in a comment. */
export type Call = { readonly kind: "call"; readonly step: string; readonly as: "verb" | "check"; readonly verb: string; readonly args: readonly CallArg[]; readonly autonomy: Autonomy };

/** A loop over a fixed list: the calls of its body, once for each member. */
export type Fan = { readonly kind: "each"; readonly step: string; readonly over: string; readonly members: readonly string[]; readonly body: readonly Call[]; readonly autonomy: Autonomy };

/** One step of a plan of calls: the closed subset an artifact is made from. */
export type PlanStep = Call | Fan;

/** The plan of calls of a workload: what an artifact says and nothing else. */
export type CallPlan = {
  readonly workload: string;
  readonly version: string;
  readonly form: BuiltFormId;
  /** The names of the inputs of the run that a call reads from the environment, sorted. */
  readonly inputs: readonly string[];
  /** The names of the credentials the workload needs, sorted: names only, read from the environment by the verb. */
  readonly credentials: readonly string[];
  readonly steps: readonly PlanStep[];
};

/** The calls of a plan in the order a script makes them: a loop's body once for each member. Two artifacts of one plan make the same list. */
export function sequenceOf(plan: CallPlan): readonly { readonly step: string; readonly verb: string; readonly args: readonly CallArg[]; readonly member?: string }[] {
  return plan.steps.flatMap((s) => (s.kind === "call" ? [{ step: s.step, verb: s.verb, args: s.args }] : s.members.flatMap((m) => s.body.map((c) => ({ step: c.step, verb: c.verb, args: c.args, member: m })))));
}

/** The canonical text of a plan: the same bytes for the same plan, whatever the order its keys were made in. */
export const canonicalPlan = (plan: CallPlan): string => JSON.stringify(canonicalJson(plan));

/** Whether a text is a digest: 64 lower case hexadecimal digits. */
export const isDigest = (text: string): boolean => /^[0-9a-f]{64}$/u.test(text);

/** Whether a text is printable ASCII with no control character: the only text an artifact holds. */
export const isSafeText = (text: string): boolean => /^[\x20-\x7e]*$/u.test(text);
