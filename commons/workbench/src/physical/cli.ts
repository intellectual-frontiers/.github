// Spec: 0005-workbench-resolution FR-004
// Spec: 0004-workbench-catalog FR-003
// Spec: 0006-workbench-dialects FR-004
/**
 * The command `workbench`: `ready` (the base, or what a task needs with `--for`, and with `--ensure` obtaining only that), `project` (the generated files of a dialect or a projection) and `explain` (one code of the
 * catalog). It reads the contract from a module (`workbench.contract.ts` by default) that exports `contract`. It exits 0 where nothing is an error, 1 where a finding is, 2 for a usage mistake and 3 where it cannot run.
 *
 * @example
 * ```ts
 * import { main } from "./cli.ts";
 * // await main(["ready", "--for", "test", "--unit", "anyfs-sql"], io)
 * ```
 *
 * @module
 */
import { defineContract, describeFinding, explain, type Contract, TASKS, type Task } from "@intellectual-frontiers/workbench/governance";
import { agentsBlock, ciStep, containerfile, matrixMarkdown, matrixOf, matrixFindings, setupScript } from "@intellectual-frontiers/workbench/logical";
import { fs, path } from "@intellectual-frontiers/system";
import { dialect as claude, render as renderClaude } from "@intellectual-frontiers/workbench/dialects/claude-code";
import { dialect as codex, render as renderCodex } from "@intellectual-frontiers/workbench/dialects/codex";
import { dialect as human, render as renderHuman } from "@intellectual-frontiers/workbench/dialects/human";
import { ready } from "./ready.ts";

/** What the command is run with: where it is, the environment, the day and where to write. */
export type Io = { readonly cwd: string; readonly env: Readonly<Record<string, string | undefined>>; readonly today: string; readonly out: (text: string) => void; readonly err: (text: string) => void };

const DIALECTS = [claude, codex, human];

type Parsed = { readonly verb: string; readonly operands: readonly string[]; readonly options: Readonly<Record<string, string | true | readonly string[]>> };

function parse(argv: readonly string[]): Parsed {
  const [verb = "", ...rest] = argv;
  const operands: string[] = [];
  const options: Record<string, string | true | string[]> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i] ?? "";
    if (!a.startsWith("--")) {
      operands.push(a);
      continue;
    }
    const name = a.slice(2);
    const next = rest[i + 1];
    const takes = ["for", "unit", "contract", "files", "name"].includes(name);
    if (takes && next !== undefined) {
      i += 1;
      const prev = options[name];
      options[name] = name === "unit" ? [...(Array.isArray(prev) ? prev : []), next] : next;
    } else options[name] = true;
  }
  return { verb, operands, options };
}

async function load(io: Io, file: string): Promise<Contract | string> {
  const full = path.resolve(io.cwd, file);
  if (!(await fs.exists(full))) return `${file} is not there: write the contract of this repository there, or name it with --contract`;
  const loaded = (await import(path.toFileUrl(full).href).catch((e: unknown) => e)) as Record<string, unknown> | Error;
  if (loaded instanceof Error) return `${file} cannot be loaded: ${loaded.message}`;
  const made = defineContract(loaded["contract"] as Contract);
  return made.kind === "ok" ? made.value : `${file} is not a contract: ${made.error.join("; ")}`;
}

/** The command. */
export async function main(argv: readonly string[], io: Io): Promise<0 | 1 | 2 | 3> {
  const p = parse(argv);
  if (p.verb === "explain") {
    const e = explain(p.operands[0] ?? "");
    io.out(`${e.code}  ${e.title}\n  concept: ${e.concept}; who fixes it: ${e.fixer}${e.safety ? "; a safety rule: always strict" : ""}\n  ${e.what}\n  fix: ${e.fix}\n`);
    return 0;
  }
  if (p.verb !== "ready" && p.verb !== "project") {
    io.err("usage: workbench ready [--for TASK] [--unit UNIT]... [--files FILE,...] [--all] [--ensure] [--ci] [--json] | project setup|container|ci|agents|runbook|matrix|dialect NAME | explain CODE  (--contract FILE)\n");
    return 2;
  }
  const contract = await load(io, typeof p.options["contract"] === "string" ? p.options["contract"] : "workbench.contract.ts");
  if (typeof contract === "string") {
    io.err(`${contract}\n`);
    return 3;
  }
  if (p.verb === "project") {
    const what = p.operands[0] ?? "";
    const text =
      what === "setup" ? setupScript(contract)
      : what === "container" ? containerfile(contract)
      : what === "ci" ? ciStep()
      : what === "agents" ? agentsBlock(contract)
      : what === "runbook" ? (renderHuman(contract)[0]?.text ?? "")
      : what === "matrix" ? matrixMarkdown(matrixOf([...contract.base, ...contract.contributions.flatMap((c) => c.requirements)], contract, DIALECTS))
      : what === "dialect" ? [...(p.operands[1] === "claude-code" ? renderClaude(contract) : p.operands[1] === "codex" ? renderCodex(contract) : p.operands[1] === "human" ? renderHuman(contract) : [])].map((f) => `# ${f.path}\n${f.text}`).join("\n")
      : undefined;
    if (text === undefined || text === "") {
      io.err("project what? setup, container, ci, agents, runbook, matrix or dialect claude-code|codex|human\n");
      return 2;
    }
    io.out(text);
    return what === "matrix" && matrixFindings(matrixOf([...contract.base, ...contract.contributions.flatMap((c) => c.requirements)], contract, DIALECTS), DIALECTS).length > 0 ? 1 : 0;
  }
  const taskText = typeof p.options["for"] === "string" ? p.options["for"] : "any";
  if (!(TASKS as readonly string[]).includes(taskText)) {
    io.err(`${taskText} is not a task; the tasks are ${TASKS.join(", ")}\n`);
    return 2;
  }
  const task = taskText as Task;
  const units = p.options["all"] === true ? ("all" as const) : Array.isArray(p.options["unit"]) ? (p.options["unit"] as readonly string[]) : [];
  const files = typeof p.options["files"] === "string" ? p.options["files"].split(",").filter((f) => f !== "") : undefined;
  const result = await ready({ contract, task, selection: files === undefined ? { units } : { units, files }, root: io.cwd, env: io.env, today: io.today, ensure: p.options["ensure"] === true });
  if (p.options["json"] === true) io.out(`${JSON.stringify({ task, requirements: result.requirements.map((r) => r.id), findings: result.findings, obtained: result.obtained }, null, 2)}\n`);
  else {
    io.out(result.findings.length === 0 ? `ready for ${task}: ${result.requirements.length} requirements, all met\n` : `${result.findings.map(describeFinding).join("\n")}\n`);
    for (const o of result.obtained) io.out(`obtained for ${o.requirement}: ${o.argv.join(" ")} (${o.success ? "done" : "failed"})\n`);
  }
  return p.options["ci"] === true ? (result.findings.some((f) => f.severity !== "hint") ? 1 : 0) : result.exit;
}
