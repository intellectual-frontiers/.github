// Spec: 0005-workbench-resolution FR-004, FR-005
/**
 * Ready: whether the workbench is ready for a task, and, only when asked, making it so. Without a selection it checks the base alone; with one it checks the base and the contributions of exactly the units the task is about. It
 * installs nothing unless asked (`ensure`), and then only what the findings say an agent may fix, by the argument vector the requirement names, never a shell, never a safety rule and never a gate; then it looks again.
 *
 * @example
 * ```ts
 * import { ready } from "./ready.ts";
 * // const r = await ready({ contract, task: "test", selection: { units: ["anyfs-sql"] }, root, env, today, ensure: false });
 * ```
 *
 * @module
 */
import { type Contract, type Finding, type Requirement, type Task } from "@intellectual-frontiers/workbench/governance";
import { compose, evaluate, type Selection } from "@intellectual-frontiers/workbench/logical";
import { proc } from "@intellectual-frontiers/system";
import { probe } from "./probe.ts";

/** What `ready` is asked. */
export type ReadyOptions = {
  readonly contract: Contract;
  readonly task: Task;
  readonly selection: Selection;
  readonly root: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Today, as a day: it decides whether a finding is a hint or an error. */
  readonly today: string;
  /** Obtain what an agent may obtain. Nothing is obtained without it. */
  readonly ensure: boolean;
  /** Runs an argument vector: the system's by default; a test gives its own. */
  readonly run?: (argv: readonly string[], cwd: string) => Promise<{ readonly success: boolean }>;
};

/** What `ready` found and did. */
export type ReadyResult = {
  readonly requirements: readonly Requirement[];
  readonly findings: readonly Finding[];
  /** What was obtained, and for which requirement. */
  readonly obtained: readonly { readonly requirement: string; readonly argv: readonly string[]; readonly success: boolean }[];
  /** 1 where a finding is an error, else 0: a hint or a warning never fails. */
  readonly exit: 0 | 1;
};

const defaultRun = async (argv: readonly string[], cwd: string): Promise<{ readonly success: boolean }> => {
  const out = await proc.run([...argv], { cwd }).catch(() => undefined);
  return { success: out?.success === true };
};

/** The task is ready, or what is not and who can fix it. */
export async function ready(o: ReadyOptions): Promise<ReadyResult> {
  const requirements = compose(o.contract, o.task, o.selection);
  const run = o.run ?? defaultRun;
  const look = async (): Promise<readonly Finding[]> => evaluate(requirements, await probe(requirements, { root: o.root, env: o.env }), o.today, o.contract.enforceFrom);
  let findings = await look();
  const obtained: { requirement: string; argv: readonly string[]; success: boolean }[] = [];
  if (o.ensure) {
    for (const f of findings) {
      const r = requirements.find((x) => x.id === f.requirement);
      if (r === undefined || r.safety || f.fixer !== "agent" || (r.kind !== "program" && r.kind !== "install") || r.install === undefined) continue;
      obtained.push({ requirement: r.id, argv: r.install, success: (await run(r.install, r.kind === "install" ? `${o.root}/${r.folder}` : o.root)).success });
    }
    if (obtained.length > 0) findings = await look();
  }
  return { requirements, findings, obtained, exit: findings.some((f) => f.severity === "error") ? 1 : 0 };
}
