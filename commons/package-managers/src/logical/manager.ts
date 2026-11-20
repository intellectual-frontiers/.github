// Spec: 0003-package-managers-logical FR-005, FR-006, FR-007
/**
 * A manager as a dialect needs it, as data (`ManagerSpec`: the dialect's id, the manager of the ontology it drives, what it guarantees, how it writes an exact version and the status its query of
 * an installed package ends with where there is none), the job a requirement of kind `tool` asks of it, the command lines of a job, and the plan file that names them. A job is the packages of
 * the tool's binding for this manager; where the tool is at a version, the version is written for the first package.
 *
 * @example
 * ```ts
 * import { jobOf } from "./manager.ts";
 * // jobOf(spec, requirement) is a job where the requirement asks this manager, and nothing where it asks another
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { GENERATED_MARK } from "@intellectual-frontiers/archon/dialect";
import type { JsonValue, Requirement } from "@intellectual-frontiers/archon/governance";
import type { ManagerId } from "@intellectual-frontiers/toolchain/governance";
import type { ToolGuarantees } from "@intellectual-frontiers/toolchain/logical";
import { commandArgv, type Argv, type Shape } from "./argv.ts";
import type { CommandSpec, Operation, Versioning } from "@intellectual-frontiers/package-managers/governance";

/** A manager as a dialect needs it. */
export type ManagerSpec = {
  /** The id of the dialect (`apt`). */
  readonly id: string;
  readonly manager: ManagerId;
  readonly summary: string;
  readonly guarantees: ToolGuarantees;
  readonly versioning: Versioning;
  /** The exit status of the query of an installed package that means it is not installed; none where it is not known, and then the dialect has no check. */
  readonly missingExit: number | undefined;
};

/** Where the commands of a manager come from: the packaging ontology, through its reader. */
export type CommandSource = (manager: string, operation: Operation) => Result<CommandSpec, string>;

/** What a tool asks of a manager. */
export type PackageJob = {
  readonly requirement: string;
  readonly tool: string;
  readonly program: string;
  readonly alsoNamed: readonly string[];
  readonly versionArgs: readonly string[];
  readonly version: string | null;
  readonly packages: readonly string[];
};

function isRecord(v: JsonValue | undefined): v is { readonly [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function textsOf(v: JsonValue | undefined): readonly string[] {
  return Array.isArray(v) ? v.flatMap((x) => (typeof x === "string" ? [x] : [])) : [];
}

/** The job a requirement asks of the manager, or nothing where it is not a tool, asks another dialect or another manager. */
export function jobOf(spec: ManagerSpec, r: Requirement): PackageJob | undefined {
  const d = r.desired;
  if (r.kind !== "tool" || !isRecord(d) || d["dialect"] !== spec.id) return undefined;
  const source = d["source"];
  const tool = d["tool"];
  const program = d["program"];
  if (typeof tool !== "string" || typeof program !== "string" || !isRecord(source) || source["kind"] !== "package" || source["manager"] !== spec.manager) return undefined;
  const packages = textsOf(source["packages"]);
  if (packages.length === 0) return undefined;
  const v = d["version"];
  return { requirement: r.id, tool, program, alsoNamed: textsOf(d["alsoNamed"]), versionArgs: textsOf(d["versionArgs"]), version: typeof v === "string" ? v : null, packages };
}

/** The command a job asks for one operation, or why it cannot be made. */
export function jobArgv(spec: ManagerSpec, commands: CommandSource, job: PackageJob, op: Operation, shape: Shape): Result<Argv, string> {
  const command = commands(spec.manager, op);
  if (command.kind === "err") return err(`${job.tool}: ${command.error}`);
  const subject = op === "Install" ? { packages: job.packages, version: job.version ?? undefined } : { packages: job.packages.slice(0, 1) };
  const made = commandArgv(command.value, subject, spec.versioning, shape);
  return made.kind === "err" ? err(`${job.tool}: ${made.error}`) : made;
}

/** One line of the plan file: what is installed and the commands that do and check it. */
export type PlanLine = {
  readonly tool: string;
  readonly version: string | null;
  readonly packages: readonly string[];
  readonly install: readonly string[];
  readonly check: readonly string[] | null;
  /** The exit status of the check that means the package is not installed; none where there is no check. */
  readonly missingExit: number | null;
  readonly admin: boolean;
  readonly verified: boolean;
};

/** The text of a plan file: JSON that says it is generated, with its keys in a fixed order. It names what the steps run, so that the digest of a render covers it. */
export function planFileText(spec: ManagerSpec, lines: readonly PlanLine[]): string {
  const body = {
    format: "package-manager-plan/1",
    dialect: spec.id,
    manager: spec.manager,
    tools: lines.map((l) => ({ tool: l.tool, version: l.version, packages: [...l.packages], install: [...l.install], check: l.check === null ? null : [...l.check], missingExit: l.missingExit, admin: l.admin, verified: l.verified })),
  };
  return JSON.stringify({ _generated: GENERATED_MARK, ...body }, null, 2) + "\n";
}

/** The plan lines of jobs, or every reason one cannot be made. */
export function planLines(spec: ManagerSpec, commands: CommandSource, jobs: readonly PackageJob[], shape: Shape): Result<readonly PlanLine[], readonly string[]> {
  const lines: PlanLine[] = [];
  const problems: string[] = [];
  for (const job of jobs) {
    const install = jobArgv(spec, commands, job, "Install", shape);
    if (install.kind === "err") {
      problems.push(install.error);
      continue;
    }
    const check = spec.missingExit === undefined ? undefined : jobArgv(spec, commands, job, "QueryInstalled", shape);
    lines.push({ tool: job.tool, version: job.version, packages: job.packages, install: install.value.argv, check: check?.kind === "ok" ? check.value.argv : null, missingExit: check?.kind === "ok" ? (spec.missingExit ?? null) : null, admin: install.value.admin, verified: install.value.verified });
  }
  return problems.length > 0 ? err(problems) : ok(lines);
}

function strings(v: unknown): readonly string[] | undefined {
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? v.map(String) : undefined;
}

/** A plan file from its text, or why it is not one: what the program of the kit runs, and refuses anything else. */
export function readPlanFile(text: string): Result<{ readonly dialect: string; readonly manager: string; readonly lines: readonly PlanLine[] }, string> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err("the plan file is not JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return err("the plan file is not an object");
  const o = raw as Readonly<Record<string, unknown>>;
  if (o["format"] !== "package-manager-plan/1") return err("the plan file is not of the format package-manager-plan/1");
  if (typeof o["dialect"] !== "string" || typeof o["manager"] !== "string" || !Array.isArray(o["tools"])) return err("the plan file names no dialect, manager and tools");
  const lines: PlanLine[] = [];
  for (const [i, t] of o["tools"].entries()) {
    if (typeof t !== "object" || t === null || Array.isArray(t)) return err(`tool ${i + 1} is not an object`);
    const x = t as Readonly<Record<string, unknown>>;
    const install = strings(x["install"]);
    const packages = strings(x["packages"]);
    const check = x["check"] === null ? null : strings(x["check"]);
    const version = x["version"];
    const missing = x["missingExit"];
    if (typeof x["tool"] !== "string" || install === undefined || install.length === 0 || packages === undefined || check === undefined) return err(`tool ${i + 1} names no tool, install command and packages`);
    if (version !== null && typeof version !== "string") return err(`tool ${i + 1}: the version is a text or null`);
    if (missing !== null && !Number.isInteger(missing)) return err(`tool ${i + 1}: the missing status is a whole number or null`);
    if (check !== null && missing === null) return err(`tool ${i + 1}: a check needs the status that means missing`);
    lines.push({ tool: x["tool"], version, packages, install, check, missingExit: missing as number | null, admin: x["admin"] === true, verified: x["verified"] === true });
  }
  return ok({ dialect: o["dialect"], manager: o["manager"], lines });
}
