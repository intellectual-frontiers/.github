// Spec: 0003-workbench-contract FR-001, FR-002, FR-003, FR-005
/**
 * The contract: a small base that every task needs and contributions from the units (a library of commons, a service or capability of erga) that need more, each as data in the unit's own manifest. A requirement is one of six
 * kinds and belongs to a concept, a task and, where it is a safety rule, stays strict whatever the date. Names are validated where they are made: a credential is a name and never a value, a program a plain name, an install an
 * argument vector and never a shell line.
 *
 * @example
 * ```ts
 * import { defineContract } from "./contract.ts";
 * const made = defineContract({ name: "demo", enforceFrom: "2027-01-01", roles: [], gates: [], stages: [], base: [], contributions: [] });
 * made.kind; // "ok"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Concept } from "./terms.ts";
import { isConcept } from "./terms.ts";
import { AUTONOMY, type Gate, HOLDERS, type Role, type Stage } from "./roles.ts";

/** What a requirement is for: `any` is the base every task needs, the others a task a unit contributes to. */
export const TASKS = ["any", "build", "test", "verify", "release", "run"] as const;
/** One task. */
export type Task = (typeof TASKS)[number];

/** The six kinds of requirement: a closed list. */
export const REQUIREMENT_KINDS = ["program", "credential", "network", "git", "install", "authority"] as const;
/** One kind of requirement. */
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

type Common = { readonly id: string; readonly concept: Concept; readonly task: Task; readonly safety: boolean; readonly summary: string };

/** A requirement: what must be so for a role to do a task. */
export type Requirement =
  | (Common & { readonly kind: "program"; readonly name: string; readonly minimum?: string; readonly probe?: readonly string[]; readonly install?: readonly string[] })
  | (Common & { readonly kind: "credential"; readonly name: string; readonly aliases?: readonly string[]; readonly scope?: string })
  | (Common & { readonly kind: "network"; readonly host: string; readonly access: "read" | "write" })
  | (Common & { readonly kind: "git"; readonly check: "ref-present" | "identity-set"; readonly ref?: string })
  | (Common & { readonly kind: "install"; readonly folder: string; readonly install?: readonly string[] })
  | (Common & { readonly kind: "authority"; readonly gate: string });

/** Which test files of a unit need which requirements, so that a runner knows what a selected test needs before it runs: a glob and the ids of the requirements. */
export type TestNeed = { readonly glob: string; readonly needs: readonly string[] };

/** What one unit contributes: its requirements and its test needs. */
export type Contribution = { readonly unit: string; readonly requirements: readonly Requirement[]; readonly tests?: readonly TestNeed[] };

/** A contract. */
export type Contract = {
  readonly name: string;
  /** The command that runs the workbench in this repository, as the generated files say it (`workbench` where not given). */
  readonly command?: string;
  /** The day from which the checks are prescriptive; before it every finding but a safety rule is a hint. */
  readonly enforceFrom: string;
  readonly roles: readonly Role[];
  readonly gates: readonly Gate[];
  readonly stages: readonly Stage[];
  /** What every task needs. */
  readonly base: readonly Requirement[];
  readonly contributions: readonly Contribution[];
};

const ID = /^[a-z][a-z0-9-]*$/u;
const PROGRAM = /^[a-z0-9][a-z0-9._+-]*$/u;
const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/u;
const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/u;
const DAY = /^\d{4}-\d{2}-\d{2}$/u;
const SHELL = /[|&;<>`$(){}\n\\]/u;

function problemsOf(r: Requirement): readonly string[] {
  const out: string[] = [];
  if (!ID.test(r.id)) out.push(`${JSON.stringify(r.id)} is not an id: lower case words joined by hyphens`);
  if (!isConcept(r.concept)) out.push(`${r.id}: ${String(r.concept)} is not a concept`);
  if (!(TASKS as readonly string[]).includes(r.task)) out.push(`${r.id}: ${String(r.task)} is not a task`);
  if (r.summary.trim() === "") out.push(`${r.id}: it has no summary`);
  const argv = (what: string, v: readonly string[] | undefined): void => {
    if (v === undefined) return;
    if (v.length === 0 || v.some((a) => a === "" || SHELL.test(a))) out.push(`${r.id}: ${what} is an argument vector with no shell in it`);
  };
  switch (r.kind) {
    case "program":
      if (!PROGRAM.test(r.name)) out.push(`${r.id}: ${JSON.stringify(r.name)} is not a program name`);
      argv("probe", r.probe);
      argv("install", r.install);
      break;
    case "credential":
      if ([r.name, ...(r.aliases ?? [])].some((n) => !ENV_NAME.test(n))) out.push(`${r.id}: a credential is the NAME of an environment variable, in capitals and underscores, and one of its names is not one (a value is never written here, and is never repeated in a message)`);
      break;
    case "network":
      if (!HOST.test(r.host)) out.push(`${r.id}: ${JSON.stringify(r.host)} is not a host name`);
      break;
    case "git":
      if (r.check === "ref-present" && (r.ref === undefined || r.ref === "")) out.push(`${r.id}: a ref-present check names the ref`);
      break;
    case "install":
      if (r.folder === "" || r.folder.startsWith("/") || r.folder.split("/").includes("..")) out.push(`${r.id}: the folder is a relative path inside the repository`);
      argv("install", r.install);
      break;
    case "authority":
      if (!ID.test(r.gate)) out.push(`${r.id}: ${JSON.stringify(r.gate)} is not a gate id`);
      break;
    default:
      return out;
  }
  return out;
}

/** A contract, or every reason it is not one: an id used twice, a name that is not a name, a stage that names no gate, a gate whose approver is not held by a person, a test need for a requirement that is not there, a date that is not a day. */
export function defineContract(input: Contract): Result<Contract, readonly string[]> {
  const problems: string[] = [];
  if (!ID.test(input.name)) problems.push(`${JSON.stringify(input.name)} is not a contract name`);
  if (input.command !== undefined && !/^[A-Za-z0-9_./ -]+$/u.test(input.command)) problems.push("command is words and a path with no shell syntax in it");
  if (!DAY.test(input.enforceFrom)) problems.push(`enforceFrom ${JSON.stringify(input.enforceFrom)} is not a day (YYYY-MM-DD)`);
  const all = [...input.base, ...input.contributions.flatMap((c) => c.requirements)];
  // two units may need the same thing and say so: an id may be stated again where it asks for exactly the same (its words aside), and is used twice where it does not
  const seen = new Map<string, string>();
  for (const r of all) {
    const said = JSON.stringify({ ...r, summary: "" });
    const before = seen.get(r.id);
    if (before === undefined) problems.push(...problemsOf(r));
    else if (before !== said) problems.push(`${r.id} is used twice, and says something different each time`);
    seen.set(r.id, said);
  }
  const roleIds = new Set<string>();
  for (const role of input.roles) {
    if (roleIds.has(role.id)) problems.push(`the role ${role.id} is used twice`);
    roleIds.add(role.id);
    if (!(HOLDERS as readonly string[]).includes(role.holder)) problems.push(`the role ${role.id} has a holder that is none of ${HOLDERS.join(", ")}`);
  }
  const gateIds = new Set<string>();
  for (const g of input.gates) {
    if (gateIds.has(g.id)) problems.push(`the gate ${g.id} is used twice`);
    gateIds.add(g.id);
    const approver = input.roles.find((r) => r.id === g.approver);
    if (approver === undefined) problems.push(`the gate ${g.id} names the approver ${g.approver}, which is no role`);
    else if (approver.holder !== "human") problems.push(`the gate ${g.id}: its approver ${g.approver} must be held by a person, not by ${approver.holder}`);
  }
  const stageIds = new Set<string>();
  for (const s of input.stages) {
    if (stageIds.has(s.id)) problems.push(`the stage ${s.id} is used twice`);
    stageIds.add(s.id);
    if (!(AUTONOMY as readonly string[]).includes(s.level)) problems.push(`the stage ${s.id} has a level that is none of ${AUTONOMY.join(", ")}`);
    for (const g of s.gates) if (!gateIds.has(g)) problems.push(`the stage ${s.id} names the gate ${g}, which is none`);
  }
  for (const r of all) if (r.kind === "authority" && !gateIds.has(r.gate)) problems.push(`${r.id} names the gate ${r.gate}, which is none`);
  const units = new Set<string>();
  for (const c of input.contributions) {
    if (units.has(c.unit)) problems.push(`the unit ${c.unit} contributes twice`);
    units.add(c.unit);
    for (const t of c.tests ?? []) for (const n of t.needs) if (!seen.has(n)) problems.push(`${c.unit}: the test glob ${t.glob} needs ${n}, which is no requirement`);
  }
  return problems.length === 0 ? ok(input) : err(problems);
}

const DEFAULT_CONCEPT: Readonly<Record<RequirementKind, Concept>> = { program: "workshop", credential: "workbench", network: "workshop", git: "workspace", install: "workspace", authority: "workstation" };

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === "object" && x !== null && !Array.isArray(x);
const text = (o: Readonly<Record<string, unknown>>, k: string): string | undefined => (typeof o[k] === "string" ? o[k] : undefined);
const texts = (o: Readonly<Record<string, unknown>>, k: string): readonly string[] | undefined => (Array.isArray(o[k]) && (o[k] as readonly unknown[]).every((e) => typeof e === "string") ? (o[k] as readonly string[]) : undefined);

/**
 * What a unit's manifest says it contributes, as data read from the manifest (`library.workbench` of a library of commons, `workbench` of a part of erga), made into a contribution or every reason it is not one. A manifest
 * is terse: a requirement says its `kind`, `id`, `summary` and what its kind needs, and the concept (by kind), the task (`any`) and whether it is a safety rule (no) are the defaults. The names are validated by `defineContract`.
 */
export function decodeContribution(unit: string, raw: unknown): Result<Contribution, readonly string[]> {
  if (!isRecord(raw)) return err([`${unit}: the workbench field is an object with requirements and, optionally, tests`]);
  const problems: string[] = [];
  const requirements: Requirement[] = [];
  const list = raw["requirements"] ?? [];
  if (!Array.isArray(list)) problems.push(`${unit}: requirements is a list`);
  else
    for (const [i, item] of (list as readonly unknown[]).entries()) {
      if (!isRecord(item)) {
        problems.push(`${unit}: requirement ${i} is an object`);
        continue;
      }
      const kind = text(item, "kind");
      const id = text(item, "id") ?? "";
      if (kind === undefined || !(REQUIREMENT_KINDS as readonly string[]).includes(kind)) {
        problems.push(`${unit}: requirement ${id || i} has a kind that is none of ${REQUIREMENT_KINDS.join(", ")}`);
        continue;
      }
      const k = kind as RequirementKind;
      const concept = text(item, "concept") ?? DEFAULT_CONCEPT[k];
      const task = (text(item, "task") ?? "any") as Task;
      const common = { id, concept: concept as Concept, task, safety: item["safety"] === true, summary: text(item, "summary") ?? "" };
      const opt = <T,>(key: string, v: T | undefined): Record<string, T> => (v === undefined ? {} : { [key]: v });
      switch (k) {
        case "program":
          requirements.push({ ...common, kind: "program", name: text(item, "name") ?? "", ...opt("minimum", text(item, "minimum")), ...opt("probe", texts(item, "probe")), ...opt("install", texts(item, "install")) });
          break;
        case "credential":
          requirements.push({ ...common, kind: "credential", name: text(item, "name") ?? "", ...opt("aliases", texts(item, "aliases")), ...opt("scope", text(item, "scope")) });
          break;
        case "network":
          requirements.push({ ...common, kind: "network", host: text(item, "host") ?? "", access: item["access"] === "write" ? "write" : "read" });
          break;
        case "git":
          requirements.push({ ...common, kind: "git", check: item["check"] === "identity-set" ? "identity-set" : "ref-present", ...opt("ref", text(item, "ref")) });
          break;
        case "install":
          requirements.push({ ...common, kind: "install", folder: text(item, "folder") ?? "", ...opt("install", texts(item, "install")) });
          break;
        case "authority":
          requirements.push({ ...common, kind: "authority", gate: text(item, "gate") ?? "" });
          break;
        default:
          return absurd(k);
      }
    }
  const tests: TestNeed[] = [];
  const tlist = raw["tests"] ?? [];
  if (!Array.isArray(tlist)) problems.push(`${unit}: tests is a list`);
  else
    for (const [i, t] of (tlist as readonly unknown[]).entries()) {
      const glob = isRecord(t) ? text(t, "glob") : undefined;
      const needs = isRecord(t) ? texts(t, "needs") : undefined;
      if (glob === undefined || needs === undefined) problems.push(`${unit}: test need ${i} has a glob and a list of the ids it needs`);
      else tests.push({ glob, needs });
    }
  return problems.length > 0 ? err(problems) : ok({ unit, requirements, ...(tests.length === 0 ? {} : { tests }) });
}
