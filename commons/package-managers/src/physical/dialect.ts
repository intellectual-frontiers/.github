// Spec: 0004-package-managers-dialect FR-001, FR-002, FR-003, FR-005
/**
 * The dialect of a manager, made from its `ManagerSpec` and the commands of the ontology: its guarantees as data (for Desired OS State and for Toolchain), the plan file it renders from an order and a plan,
 * one step for each tool (the manager's own command, with its check where the status of a missing package is known), and the observation that gives Desired OS State what is installed and at what version. Nothing is
 * built from source and nothing is run by a shell.
 *
 * @example
 * ```ts
 * import { managerDialect } from "./dialect.ts";
 * // managerDialect(spec, commands, { elevate: ["sudo", "-n"] }) is a Dialect for the port of Desired OS State
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { renderedOf, type Dialect, type DialectStep, type Rendered } from "@intellectual-frontiers/desired-os-state/dialect";
import { parseDialectId, parseKindId, type JsonValue, type Requirement, type RequirementId } from "@intellectual-frontiers/desired-os-state/governance";
import type { Order, Plan } from "@intellectual-frontiers/desired-os-state/logical";
import type { ToolDialect } from "@intellectual-frontiers/toolchain/logical";
import { sameVersion, specOf, versionIn, jobArgv, jobOf, planFileText, planLines, readPlanFile, type CommandSource, type ManagerSpec, type PackageJob } from "@intellectual-frontiers/package-managers/logical";
import * as path from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import { runWithin, type Run } from "./runner.ts";

/** What a dialect is made with. */
export type DialectOptions = {
  /** The program that raises the rights, put before a command of a manager that needs them (`["sudo", "-n"]`); none by default. */
  readonly elevate?: readonly string[];
  /** The folder the files of a render are written in, below the working folder; `.desired-os-state` by default. */
  readonly renderRoot?: string;
};

function must<T>(r: Result<T, string>): T {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The dialect as Toolchain reads it. */
export function toolDialectOf(spec: ManagerSpec): ToolDialect {
  return { id: must(parseDialectId(spec.id)), manager: spec.manager, guarantees: spec.guarantees };
}

function isRecord(v: JsonValue | undefined): v is { readonly [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The dialect, as the port of Desired OS State takes it. */
export function managerDialect(spec: ManagerSpec, commands: CommandSource, o: DialectOptions = {}): Dialect {
  const root = o.renderRoot ?? ".desired-os-state";
  const shape = { elevate: o.elevate ?? [] };
  const jobsFor = (requirements: readonly Requirement[], plan: Plan): readonly PackageJob[] => {
    const changing = new Set(plan.entries.filter((e) => e.action === "create" || e.action === "update").map((e) => e.id));
    return requirements.filter((r) => changing.has(r.id)).flatMap((r) => {
      const j = jobOf(spec, r);
      return j === undefined ? [] : [j];
    });
  };
  return {
    id: must(parseDialectId(spec.id)),
    tool: { name: spec.manager, version: "the version on the computer" },
    guarantees: { kinds: [must(parseKindId("tool"))], subjects: ["machine", "workstation"], plan: spec.missingExit === undefined ? "none" : "partial", idempotence: "unproven", destroy: false },
    render: async (order: Order, plan: Plan): Promise<Result<Rendered, readonly string[]>> => {
      const lines = planLines(spec, commands, jobsFor(order.requirements, plan), shape);
      if (lines.kind === "err") return err(lines.error);
      return renderedOf(new Map([[`${spec.id}/plan.json`, planFileText(spec, lines.value)]]));
    },
    steps: (plan: Plan, rendered: Rendered): readonly DialectStep[] => {
      const file0 = rendered.files.get(`${spec.id}/plan.json`);
      const read = file0 === undefined ? undefined : readPlanFile(file0);
      const ids = new Set(read?.kind === "ok" ? read.value.lines.map((l) => `tool.${l.tool}`) : []);
      const covers: RequirementId[] = plan.entries.filter((e) => (e.action === "create" || e.action === "update") && e.kind === "tool" && ids.has(e.id)).map((e) => e.id);
      if (covers.length === 0) return [];
      const file = `${root}/${rendered.digest}/${spec.id}/plan.json`;
      const run = (mode: "apply" | "check"): readonly string[] => [proc.execPath(), programPath(), mode, file];
      return [{ covers, summary: `install ${covers.length} tool${covers.length === 1 ? "" : "s"} with ${spec.id}`, apply: run("apply"), check: run("check"), changedExit: 2 }];
    },
  };
}

/** The program of the kit, next to this file with the same extension (the source in the repository, the compiled file in the package). */
function programPath(): string {
  const ext = path.extname(import.meta.url) || ".ts";
  return path.fromFileUrl(new URL(`./bin${ext}`, import.meta.url));
}

/** What Desired OS State is given of what is installed: the desired state itself for a tool installed at the version it asks, a state that differs for one installed at another, nothing for one that is absent or cannot be asked. */
export async function observeRequirements(spec: ManagerSpec, commands: CommandSource, requirements: readonly Requirement[], o: { readonly run?: Run } = {}): Promise<ReadonlyMap<RequirementId, JsonValue>> {
  const run = o.run ?? runWithin(10_000);
  const out = new Map<RequirementId, JsonValue>();
  for (const r of requirements) {
    const job = jobOf(spec, r);
    if (job === undefined) continue;
    const query = jobArgv(spec, commands, job, "QueryVersion", {});
    if (query.kind === "err") continue;
    const said = await run(query.value.argv);
    if (said === undefined || said.status !== 0) continue;
    const version = versionIn(said.stdout);
    if (version === undefined) continue;
    if (job.version === null || sameVersion(version, job.version)) out.set(r.id, r.desired);
    else if (isRecord(r.desired)) out.set(r.id, { ...r.desired, version, installedFrom: "manager" });
  }
  return out;
}


/** The dialect of a manager of the table by its key: the dialect of the kit made from the data of its row, or the keys of the table where the key is not one. */
export function packageDialect(key: string, commands: CommandSource, options: DialectOptions = {}): Result<Dialect, string> {
  const spec = specOf(key);
  return spec.kind === "err" ? spec : ok(managerDialect(spec.value, commands, options));
}

/** The dialect of a manager of the table as Toolchain reads it. */
export function toolDialectOfKey(key: string): Result<ToolDialect, string> {
  const spec = specOf(key);
  return spec.kind === "err" ? spec : ok(toolDialectOf(spec.value));
}
