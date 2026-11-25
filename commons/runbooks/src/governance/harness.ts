// Spec: 0007-runbooks-harness FR-001, FR-002
/**
 * The dialects and the policy that chooses one. A runbook never names a harness: a harness is a dialect, the set of dialects is a registry, and a harness added later is one entry registered with no change to any
 * runbook. A `HarnessPolicy` is data a fleet owns: a default, a choice by skill, a preference by operator and a choice by workload. The choice resolves in one order and is held to the dialects that can carry the runbook.
 *
 * @example
 * ```ts
 * import { DIALECTS } from "./harness.ts";
 * DIALECTS.get("claude-code")?.holder; // "agent"
 * ```
 *
 * @module
 */
import { err, formatDecodeError, ok, type Result, record, string } from "@intellectual-frontiers/core";
import type { RequirementKind } from "@intellectual-frontiers/workbench/governance";
import { type DialectId, dialectId } from "./ids.ts";

/** A dialect as registered: its id, who holds it, what it says of itself and the kinds of requirement it can express. */
export type DialectInfo = {
  readonly id: DialectId;
  readonly holder: "agent" | "human";
  readonly title: string;
  /** The kinds of requirement of the workbench the dialect carries; a requirement of another kind is unexpressed. */
  readonly expresses: readonly RequirementKind[];
  /** Whether the dialect reads a skill file of its own; where it does not, its projection is text for `AGENTS.md`. */
  readonly skillFiles: boolean;
};

/** A registry of dialects by id. */
export type DialectRegistry = { has(id: string): boolean; get(id: string): DialectInfo | undefined; list(): readonly DialectInfo[] };

/** A registry of dialects, or the id it has twice. */
export function createDialectRegistry(infos: readonly DialectInfo[]): Result<DialectRegistry, string> {
  const byId = new Map<string, DialectInfo>();
  for (const d of infos) {
    if (byId.has(d.id)) return err(`the dialect ${d.id} is registered twice`);
    byId.set(d.id, d);
  }
  const sorted = [...infos].sort((a, b) => (a.id < b.id ? -1 : 1));
  return ok({ has: (id) => byId.has(id), get: (id) => byId.get(id), list: () => sorted });
}

const dialectNamed = (text: string): DialectId => {
  const r = dialectId(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

const ALL_KINDS = ["program", "credential", "network", "git", "install", "authority"] as const satisfies readonly RequirementKind[];

/** The dialects of the commons today: the two harnesses and a person. */
export const DIALECTS: DialectRegistry = (() => {
  const made = createDialectRegistry([
    { id: dialectNamed("claude-code"), holder: "agent", title: "Claude Code", expresses: ALL_KINDS, skillFiles: true },
    { id: dialectNamed("codex"), holder: "agent", title: "Codex", expresses: ALL_KINDS, skillFiles: false },
    { id: dialectNamed("human"), holder: "human", title: "A person", expresses: ALL_KINDS, skillFiles: false },
  ]);
  if (made.kind === "err") throw new Error(made.error);
  return made.value;
})();

/** The policy a fleet owns that chooses a dialect. */
export type HarnessPolicy = {
  readonly default: DialectId;
  /** By skill (the id of a runbook). */
  readonly perSkill: Readonly<Record<string, DialectId>>;
  /** By operator: the preference of a person. */
  readonly perOperator: Readonly<Record<string, DialectId>>;
  /** By workload. */
  readonly perWorkload: Readonly<Record<string, DialectId>>;
};

/** A policy from a value that came from outside, or every reason it is not one: each dialect named must be registered. */
export function decodePolicy(input: unknown, registry: DialectRegistry = DIALECTS): Result<HarnessPolicy, readonly string[]> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return err(["a harness policy is an object with a default dialect"]);
  const problems: string[] = [];
  const pick = (value: unknown, where: string): DialectId | undefined => {
    const r = dialectId(value);
    if (r.kind === "err") {
      problems.push(`${where}: ${r.error}`);
      return undefined;
    }
    if (!registry.has(r.value)) {
      problems.push(`${where}: the dialect ${r.value} is not registered`);
      return undefined;
    }
    return r.value;
  };
  const map = (key: string): Readonly<Record<string, DialectId>> => {
    const raw: unknown = Reflect.get(input, key);
    if (raw === undefined) return {};
    const shape = record(string)(raw, `$.${key}`);
    if (shape.kind === "err") {
      problems.push(formatDecodeError(shape.error));
      return {};
    }
    const out: Record<string, DialectId> = {};
    for (const [k, v] of Object.entries(shape.value)) {
      const d = pick(v, `$.${key}.${k}`);
      if (d !== undefined) out[k] = d;
    }
    return out;
  };
  const dflt = pick(Reflect.get(input, "default"), "$.default");
  const policy = { perSkill: map("perSkill"), perOperator: map("perOperator"), perWorkload: map("perWorkload") };
  return problems.length > 0 || dflt === undefined ? err(problems) : ok({ default: dflt, ...policy });
}
